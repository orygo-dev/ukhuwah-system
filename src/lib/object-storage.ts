import "server-only";
import { randomUUID } from "crypto";
import { createReadStream } from "fs";
import { copyFile, mkdir, readFile, stat, unlink, writeFile } from "fs/promises";
import path from "path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  getR2PublicBaseUrl,
  markR2TestResult,
  resolveR2Credentials,
  type ResolvedR2Credentials,
} from "@/lib/r2-settings";
import { isAllowedUploadUrl } from "@/lib/upload-url";

export { isAllowedUploadUrl } from "@/lib/upload-url";

export type StorageDriver = "local" | "r2";

export type StoreObjectInput = {
  /** Folder relative to uploads/, e.g. "spotlight", "mading", "reading/cover", "app-display/logo" */
  folder: string;
  filename?: string;
  extension: string;
  bytes: Buffer;
  contentType: string;
  /** Optional filename prefix before UUID, e.g. userId */
  namePrefix?: string;
};

export type StoreObjectResult = {
  url: string;
  key: string;
  driver: StorageDriver;
  filename: string;
};

export type StoreObjectFileInput = Omit<StoreObjectInput, "bytes"> & {
  sourcePath: string;
};

const R2_REQUEST_TIMEOUT_MS = 30_000;
const R2_LARGE_UPLOAD_TIMEOUT_MS = 300_000;

async function withR2Timeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs = R2_REQUEST_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await operation(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(
        `Penyimpanan R2 tidak merespons dalam ${Math.ceil(timeoutMs / 1000)} detik. Periksa koneksi dan pengaturan R2.`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function storeLocalFile(
  folder: string,
  filename: string,
  sourcePath: string,
): Promise<StoreObjectResult> {
  const relativeDir = path.join("uploads", ...folder.split("/"));
  const absoluteDir = path.join(process.cwd(), "public", relativeDir);
  await mkdir(absoluteDir, { recursive: true });
  await copyFile(sourcePath, path.join(absoluteDir, filename));
  const key = `${relativeDir.replace(/\\/g, "/")}/${filename}`;
  return { url: `/${key}`, key, driver: "local", filename };
}

function sanitizeFolder(folder: string) {
  const cleaned = folder
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\.\./g, "");
  if (!cleaned || cleaned.includes("..")) {
    throw new Error("Folder upload tidak valid.");
  }
  return cleaned;
}

function buildFilename(extension: string, namePrefix?: string) {
  const ext = extension.replace(/^\./, "").toLowerCase();
  const id = randomUUID();
  return namePrefix ? `${namePrefix}-${id}.${ext}` : `${id}.${ext}`;
}

function uploadKeyFromUrlOrPath(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes("..") || trimmed.includes("\\")) return null;
  if (trimmed.startsWith("uploads/")) return trimmed;
  if (trimmed.startsWith("/uploads/")) return trimmed.slice(1);
  try {
    const parsed = new URL(trimmed);
    if (parsed.pathname.startsWith("/uploads/")) {
      return parsed.pathname.slice(1);
    }
  } catch {
    /* ignore */
  }
  return null;
}

function createR2Client(creds: ResolvedR2Credentials) {
  return new S3Client({
    region: "auto",
    maxAttempts: 2,
    endpoint: `https://${creds.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
    },
  });
}

async function storeLocal(
  folder: string,
  filename: string,
  bytes: Buffer
): Promise<StoreObjectResult> {
  const relativeDir = path.join("uploads", ...folder.split("/"));
  const absoluteDir = path.join(process.cwd(), "public", relativeDir);
  await mkdir(absoluteDir, { recursive: true });
  await writeFile(path.join(absoluteDir, filename), bytes);
  const key = `${relativeDir.replace(/\\/g, "/")}/${filename}`;
  return {
    url: `/${key}`,
    key,
    driver: "local",
    filename,
  };
}

async function storeR2(
  creds: ResolvedR2Credentials,
  folder: string,
  filename: string,
  bytes: Buffer,
  contentType: string
): Promise<StoreObjectResult> {
  const key = `uploads/${folder}/${filename}`;
  const client = createR2Client(creds);
  await withR2Timeout((signal) =>
    client.send(
      new PutObjectCommand({
        Bucket: creds.bucket,
        Key: key,
        Body: bytes,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
      { abortSignal: signal },
    ),
  );
  return {
    url: `${creds.publicBaseUrl}/${key}`,
    key,
    driver: "r2",
    filename,
  };
}

async function storeR2File(
  creds: ResolvedR2Credentials,
  folder: string,
  filename: string,
  sourcePath: string,
  contentType: string,
): Promise<StoreObjectResult> {
  const key = `uploads/${folder}/${filename}`;
  const sourceStat = await stat(sourcePath);
  const client = createR2Client(creds);
  const body = createReadStream(sourcePath);
  try {
    await withR2Timeout(
      (signal) =>
        client.send(
          new PutObjectCommand({
            Bucket: creds.bucket,
            Key: key,
            Body: body,
            ContentLength: sourceStat.size,
            ContentType: contentType,
            CacheControl: "public, max-age=31536000, immutable",
          }),
          { abortSignal: signal },
        ),
      R2_LARGE_UPLOAD_TIMEOUT_MS,
    );
  } finally {
    body.destroy();
  }
  return {
    url: `${creds.publicBaseUrl}/${key}`,
    key,
    driver: "r2",
    filename,
  };
}

export async function getActiveStorageDriver(): Promise<StorageDriver> {
  const creds = await resolveR2Credentials();
  return creds ? "r2" : "local";
}

export async function storeObject(
  input: StoreObjectInput
): Promise<StoreObjectResult> {
  const folder = sanitizeFolder(input.folder);
  const filename =
    input.filename || buildFilename(input.extension, input.namePrefix);
  const creds = await resolveR2Credentials();
  if (creds) {
    const stored = await storeR2(creds, folder, filename, input.bytes, input.contentType);
    await storeLocal(folder, filename, input.bytes).catch((error) => {
      console.error("[object-storage local mirror]", error);
    });
    return stored;
  }
  return storeLocal(folder, filename, input.bytes);
}

/** Store a file without first copying the entire payload into the Node.js heap. */
export async function storeObjectFromFile(
  input: StoreObjectFileInput,
): Promise<StoreObjectResult> {
  const folder = sanitizeFolder(input.folder);
  const filename =
    input.filename || buildFilename(input.extension, input.namePrefix);
  const creds = await resolveR2Credentials();
  if (creds) {
    const stored = await storeR2File(
      creds,
      folder,
      filename,
      input.sourcePath,
      input.contentType,
    );
    await storeLocalFile(folder, filename, input.sourcePath).catch((error) => {
      console.error("[object-storage local mirror]", error);
    });
    return stored;
  }
  return storeLocalFile(folder, filename, input.sourcePath);
}

export async function deleteStoredObject(url: string | null | undefined) {
  if (!url?.trim()) return;
  const trimmed = url.trim();
  const key = uploadKeyFromUrlOrPath(trimmed);

  if (key?.startsWith("uploads/")) {
    const root = path.resolve(process.cwd(), "public", "uploads");
    const absolutePath = path.resolve(process.cwd(), "public", key);
    if (absolutePath.startsWith(root + path.sep)) {
      try {
        await unlink(absolutePath);
      } catch {
        /* ignore missing */
      }
    }

    const creds = await resolveR2Credentials();
    if (!creds) return;
    try {
      const client = createR2Client(creds);
      await withR2Timeout((signal) =>
        client.send(
          new DeleteObjectCommand({
            Bucket: creds.bucket,
            Key: key,
          }),
          { abortSignal: signal },
        ),
      );
    } catch (error) {
      console.error("[object-storage delete]", error);
    }
    return;
  }

  const creds = await resolveR2Credentials();
  if (!creds) return;
  if (!trimmed.startsWith(`${creds.publicBaseUrl}/`)) return;
  const remoteKey = trimmed.slice(creds.publicBaseUrl.length + 1);
  if (!remoteKey.startsWith("uploads/") || remoteKey.includes("..")) return;
  try {
    const client = createR2Client(creds);
    await withR2Timeout((signal) =>
      client.send(
        new DeleteObjectCommand({
          Bucket: creds.bucket,
          Key: remoteKey,
        }),
        { abortSignal: signal },
      ),
    );
  } catch (error) {
    console.error("[object-storage delete]", error);
  }
}

export async function testR2Connection(): Promise<{
  ok: boolean;
  message: string;
}> {
  const creds = await resolveR2Credentials();
  if (!creds) {
    const message =
      "R2 belum dikonfigurasi atau belum diaktifkan. Simpan kredensial lengkap terlebih dahulu.";
    await markR2TestResult(false, message).catch(() => undefined);
    return { ok: false, message };
  }
  try {
    const client = createR2Client(creds);
    await withR2Timeout((signal) =>
      client.send(
        new HeadBucketCommand({ Bucket: creds.bucket }),
        { abortSignal: signal },
      ),
    );
    const message = `Koneksi R2 berhasil · bucket ${creds.bucket}`;
    await markR2TestResult(true, message);
    return { ok: true, message };
  } catch (error) {
    const message =
      error instanceof Error
        ? `Koneksi R2 gagal: ${error.message}`
        : "Koneksi R2 gagal.";
    await markR2TestResult(false, message).catch(() => undefined);
    return { ok: false, message };
  }
}

export async function isAllowedUploadUrlAsync(
  value: string,
  folders: string | string[],
  options?: { allowAnyHttps?: boolean; extensions?: string[] }
): Promise<boolean> {
  const publicBaseUrl = await getR2PublicBaseUrl();
  return isAllowedUploadUrl(value, folders, {
    ...options,
    publicBaseUrl,
  });
}

async function readLocalUpload(key: string): Promise<{
  bytes: Buffer;
  contentType?: string;
} | null> {
  const root = path.resolve(process.cwd(), "public", "uploads");
  const absolutePath = path.resolve(process.cwd(), "public", key);
  if (!absolutePath.startsWith(root + path.sep)) return null;
  try {
    const bytes = await readFile(absolutePath);
    return { bytes };
  } catch {
    return null;
  }
}

async function readR2Upload(key: string): Promise<{
  bytes: Buffer;
  contentType?: string;
} | null> {
  const creds = await resolveR2Credentials();
  if (!creds) return null;
  try {
    const client = createR2Client(creds);
    const result = await withR2Timeout((signal) =>
      client.send(
        new GetObjectCommand({
          Bucket: creds.bucket,
          Key: key,
        }),
        { abortSignal: signal },
      ),
    );
    if (!result.Body) return null;
    const bytes = Buffer.from(await result.Body.transformToByteArray());
    return {
      bytes,
      contentType: result.ContentType || undefined,
    };
  } catch (error) {
    console.error("[object-storage get]", error);
    return null;
  }
}

/** Serve an uploaded object from local disk, falling back to R2. */
export async function readStoredUpload(urlOrKey: string): Promise<{
  bytes: Buffer;
  contentType?: string;
  key: string;
} | null> {
  const key = uploadKeyFromUrlOrPath(urlOrKey);
  if (!key || !key.startsWith("uploads/")) return null;
  const local = await readLocalUpload(key);
  if (local) return { ...local, key };
  const remote = await readR2Upload(key);
  if (remote) return { ...remote, key };
  return null;
}
