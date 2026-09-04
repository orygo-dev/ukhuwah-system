import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { readResponseJson } from "../src/lib/http-json";

test("readResponseJson preserves a typed successful payload", async () => {
  const data = await readResponseJson<{ message: { id: string } }>(
    new Response(JSON.stringify({ message: { id: "message-1" } })),
  );
  assert.equal(data.message.id, "message-1");
});

test("readResponseJson reports empty responses without JSON.parse errors", async () => {
  await assert.rejects(
    readResponseJson(new Response("", { status: 502 })),
    /Respons server tidak valid\. \(HTTP 502\)\./,
  );
});

test("readResponseJson never defaults its generic to any", () => {
  const source = readFileSync("src/lib/http-json.ts", "utf8");
  assert.doesNotMatch(source, /<T\s*=\s*any>/);
  assert.match(source, /T extends object = Record<string, unknown>/);
});
