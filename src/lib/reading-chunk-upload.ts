import "server-only";

import { createHash, randomUUID } from "crypto";
import {
  appendFile,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  unlink,
  writeFile,
} from "fs/promises";
import path from "path";
import { storeObjectFromFile, type StoreObjectResult } from "@/lib/object-storage";
import { publicStoredUploadUrl } from "@/lib/upload-url";
import {
  READING_PDF_CHUNK_BYTES,
  READING_PDF_MAX_BYTES,
  readingPdfChunkCount,
} from "@/lib/reading-upload-limits";

const SESSION_TTL_MS = 60 * 60 * 1000;
const COMPLETE_TTL_MS = 15 * 60 * 1000;
const UPLOAD_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type UploadMetadata = {
  actorId: string;
  totalChunks: number;
  totalSize: number;
  updatedAt: number;
  complete?: boolean;
  result?: StoreObjectResult;
};

export class ReadingChunkUploadError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

function uploadRoot() {
  return path.join(process.cwd(), ".runtime", "reading-uploads");
}

function sessionPath(uploadId: string) {
  if (!UPLOAD_ID_PATTERN.test(uploadId)) {
    throw new ReadingChunkUploadError("ID upload tidak valid.");
  }
  return path.join(uploadRoot(), uploadId);
}

function chunkPath(sessionDir: string, index: number) {
  return path.join(sessionDir, `${index}.part`);
}

async function removeIfPresent(target: string) {
  await unlink(target).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
}

let lastCleanupAt = 0;

async function cleanupExpiredSessions(now = Date.now()) {
  if (now - lastCleanupAt < 60_000) return;
  lastCleanupAt = now;
  const root = uploadRoot();
  const entries = await readdir(root, { withFileTypes: true }).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return [];
      throw error;
    },
  );
  await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && UPLOAD_ID_PATTERN.test(entry.name))
      .map(async (entry) => {
        const dir = path.join(root, entry.name);
        const metadataPath = path.join(dir, "metadata.json");
        const metadata = await readMetadata(metadataPath).catch(() => null);
        const age = now - (metadata?.updatedAt ?? (await stat(dir)).mtimeMs);
        const ttl = metadata?.complete ? COMPLETE_TTL_MS : SESSION_TTL_MS;
        if (age > ttl) await rm(dir, { recursive: true, force: true });
      }),
  );
}

async function readMetadata(metadataPath: string) {
  return JSON.parse(await readFile(metadataPath, "utf8")) as UploadMetadata;
}

async function writeMetadata(metadataPath: string, metadata: UploadMetadata) {
  const temporaryPath = `${metadataPath}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(metadata), { flag: "wx" });
  await rename(temporaryPath, metadataPath);
}

function sha256(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function waitForCompletedUpload(
  metadataPath: string,
  totalChunks: number,
) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    const metadata = await readMetadata(metadataPath).catch(() => null);
    if (metadata?.complete && metadata.result) {
      return {
        complete: true as const,
        receivedChunks: totalChunks,
        url: publicStoredUploadUrl(metadata.result),
        storage: metadata.result.driver,
      };
    }
  }
  return null;
}

async function persistChunk(target: string, bytes: Buffer) {
  try {
    await writeFile(target, bytes, { flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const existing = await readFile(target);
    if (existing.length !== bytes.length || sha256(existing) !== sha256(bytes)) {
      throw new ReadingChunkUploadError("Retry upload berisi data chunk yang berbeda.", 409);
    }
  }
}

export async function receiveReadingPdfChunk(input: {
  actorId: string;
  uploadId: string;
  chunkIndex: number;
  totalChunks: number;
  totalSize: number;
  chunk: File;
}): Promise<{ complete: boolean; receivedChunks: number; url?: string; storage?: string }> {
  await cleanupExpiredSessions();

  const { actorId, uploadId, chunkIndex, totalChunks, totalSize, chunk } = input;
  const expectedChunks = readingPdfChunkCount(totalSize);
  if (totalSize <= 0 || totalSize > READING_PDF_MAX_BYTES) {
    throw new ReadingChunkUploadError("Ukuran PDF tidak valid.");
  }
  if (totalChunks !== expectedChunks || chunkIndex < 0 || chunkIndex >= totalChunks) {
    throw new ReadingChunkUploadError("Urutan chunk upload tidak valid.");
  }
  const expectedSize = Math.min(
    READING_PDF_CHUNK_BYTES,
    totalSize - chunkIndex * READING_PDF_CHUNK_BYTES,
  );
  if (chunk.size !== expectedSize) {
    throw new ReadingChunkUploadError("Ukuran chunk upload tidak valid.");
  }

  const sessionDir = sessionPath(uploadId);
  const metadataPath = path.join(sessionDir, "metadata.json");
  await mkdir(sessionDir, { recursive: true });

  let metadata = await readMetadata(metadataPath).catch(() => null);
  if (!metadata) {
    if (chunkIndex !== 0) {
      throw new ReadingChunkUploadError("Sesi upload tidak ditemukan. Mulai ulang upload.", 409);
    }
    metadata = { actorId, totalChunks, totalSize, updatedAt: Date.now() };
    await writeMetadata(metadataPath, metadata);
  }
  if (
    metadata.actorId !== actorId ||
    metadata.totalChunks !== totalChunks ||
    metadata.totalSize !== totalSize
  ) {
    throw new ReadingChunkUploadError("Sesi upload tidak sesuai.", 409);
  }
  if (metadata.complete && metadata.result) {
    return {
      complete: true,
      receivedChunks: totalChunks,
      url: publicStoredUploadUrl(metadata.result),
      storage: metadata.result.driver,
    };
  }

  const bytes = Buffer.from(await chunk.arrayBuffer());
  await persistChunk(chunkPath(sessionDir, chunkIndex), bytes);

  const receivedChunks = (
    await readdir(sessionDir, { withFileTypes: true })
  ).filter((entry) => entry.isFile() && entry.name.endsWith(".part")).length;
  if (receivedChunks < totalChunks) {
    metadata.updatedAt = Date.now();
    await writeMetadata(metadataPath, metadata);
    return { complete: false, receivedChunks };
  }

  const lockPath = path.join(sessionDir, "finalizing.lock");
  try {
    await writeFile(lockPath, actorId, { flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      const completed = await waitForCompletedUpload(metadataPath, totalChunks);
      if (completed) return completed;
      throw new ReadingChunkUploadError("Upload sedang diselesaikan. Coba kembali.", 409);
    }
    throw error;
  }

  const assembledPath = path.join(sessionDir, "document.pdf");
  try {
    await removeIfPresent(assembledPath);
    for (let index = 0; index < totalChunks; index += 1) {
      await appendFile(assembledPath, await readFile(chunkPath(sessionDir, index)));
    }
    const assembledStat = await stat(assembledPath);
    if (assembledStat.size !== totalSize) {
      throw new ReadingChunkUploadError("PDF hasil upload tidak lengkap.");
    }
    const signature = Buffer.alloc(5);
    (await readFile(chunkPath(sessionDir, 0))).copy(signature, 0, 0, 5);
    if (signature.toString("ascii") !== "%PDF-") {
      throw new ReadingChunkUploadError("Isi file bukan dokumen PDF yang valid.");
    }

    const result = await storeObjectFromFile({
      folder: "reading/document",
      extension: "pdf",
      sourcePath: assembledPath,
      contentType: "application/pdf",
    });
    metadata = { ...metadata, complete: true, result, updatedAt: Date.now() };
    await writeMetadata(metadataPath, metadata);
    await Promise.all(
      Array.from({ length: totalChunks }, (_, index) =>
        removeIfPresent(chunkPath(sessionDir, index)),
      ),
    );
    await removeIfPresent(assembledPath);
    return {
      complete: true,
      receivedChunks: totalChunks,
      url: publicStoredUploadUrl(result),
      storage: result.driver,
    };
  } finally {
    await removeIfPresent(lockPath);
  }
}
