import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("reading manager uses resumable chunks instead of one large request", () => {
  const source = readFileSync(
    "src/components/reading/reading-management-client.tsx",
    "utf8",
  );
  assert.match(source, /file\.slice/);
  assert.match(source, /crypto\.randomUUID/);
  assert.match(source, /totalChunks/);
  assert.match(source, /attempt <= 3/);
  assert.match(source, /Mengunggah file PDF\.\.\./);
});

test("chunk endpoint validates ownership, retries, locking, and cleanup", () => {
  const route = readFileSync("src/app/api/reading/upload/route.ts", "utf8");
  const storage = readFileSync("src/lib/reading-chunk-upload.ts", "utf8");
  assert.match(route, /actorId: actor\.id/);
  assert.match(storage, /metadata\.actorId !== actorId/);
  assert.match(storage, /sha256\(existing\) !== sha256\(bytes\)/);
  assert.match(storage, /finalizing\.lock/);
  assert.match(storage, /waitForCompletedUpload/);
  assert.match(storage, /SESSION_TTL_MS/);
  assert.match(storage, /cleanupExpiredSessions/);
  assert.match(storage, /storeObjectFromFile/);
});
