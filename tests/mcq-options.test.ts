import assert from "node:assert/strict";
import test from "node:test";
import { normalizeMcqOptions } from "../src/lib/mcq-options";

test("drops blank options and remaps the correct index", () => {
  const result = normalizeMcqOptions(["A", "", "C", "D"], 2);
  assert.deepEqual(result, { options: ["A", "C", "D"], correctOptionIndex: 1 });
});

test("returns null when the correct option was blank", () => {
  assert.equal(normalizeMcqOptions(["A", "B", "", "D"], 2), null);
});

test("returns null with fewer than two remaining options", () => {
  assert.equal(normalizeMcqOptions(["A", "", "", ""], 0), null);
});
