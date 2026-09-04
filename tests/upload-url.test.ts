import assert from "node:assert/strict";
import test from "node:test";
import {
  isAllowedUploadUrl,
  publicStoredUploadUrl,
  toSameOriginUploadUrl,
} from "../src/lib/upload-url";

test("upload URLs are rewritten to /api/media paths", () => {
  assert.equal(
    toSameOriginUploadUrl("/uploads/notifications/a.png"),
    "/api/media/notifications/a.png",
  );
  assert.equal(
    toSameOriginUploadUrl("https://cdn.example.r2.dev/uploads/reading/document/bumi.pdf"),
    "/api/media/reading/document/bumi.pdf",
  );
  assert.equal(
    toSameOriginUploadUrl("https://cdn.example.r2.dev/media/uploads/notifications/a.png"),
    "/api/media/notifications/a.png",
  );
  assert.equal(
    toSameOriginUploadUrl("/api/media/notifications/a.png"),
    "/api/media/notifications/a.png",
  );
  assert.equal(
    toSameOriginUploadUrl("/uploads/app-display/logo/a.png"),
    "/uploads/app-display/logo/a.png",
  );
  assert.equal(
    toSameOriginUploadUrl("https://drive.google.com/file/d/abc"),
    "https://drive.google.com/file/d/abc",
  );
});

test("stored objects expose a public app media path instead of the R2 CDN host", () => {
  assert.equal(
    publicStoredUploadUrl({
      key: "uploads/notifications/a.png",
      url: "https://cdn.example.r2.dev/uploads/notifications/a.png",
    }),
    "/api/media/notifications/a.png",
  );
  assert.equal(
    publicStoredUploadUrl({
      key: "files/a.png",
      url: "https://cdn.example.r2.dev/uploads/reading/cover/a.png",
    }),
    "/api/media/reading/cover/a.png",
  );
});

test("api media paths are accepted as upload URLs", () => {
  assert.equal(isAllowedUploadUrl("/api/media/notifications/a.png", "notifications"), true);
  assert.equal(isAllowedUploadUrl("/uploads/reading/document/a.pdf", "reading"), true);
  assert.equal(isAllowedUploadUrl("/api/media/reading/document/a.pdf", "reading"), true);
});

test("avatar uploads rewrite like notifications", () => {
  assert.equal(
    toSameOriginUploadUrl("/uploads/avatars/u-1.png"),
    "/api/media/avatars/u-1.png",
  );
  assert.equal(
    toSameOriginUploadUrl("https://cdn.example.r2.dev/uploads/avatars/u-1.png"),
    "/api/media/avatars/u-1.png",
  );
  assert.equal(
    publicStoredUploadUrl({
      key: "uploads/avatars/u-1.png",
      url: "https://cdn.example.r2.dev/uploads/avatars/u-1.png",
    }),
    "/api/media/avatars/u-1.png",
  );
});
