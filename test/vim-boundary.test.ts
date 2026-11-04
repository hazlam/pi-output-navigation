import assert from "node:assert/strict";
import { test } from "node:test";
import { isIdleNormalAtFirstLine } from "../src/vim-boundary.ts";

function editor() {
  return {
    getMode: () => "normal", getCursor: () => ({ line: 0, col: 0 }),
    pendingMotion: null, pendingTextObject: null, pendingOperator: null, pendingExCommand: null,
    pendingReplace: false, pendingG: false, prefixCount: "", operatorCount: "", pendingGCount: "",
    discardingBracketedPasteInNormalMode: false, replayingRepeat: false,
  };
}

test("only idle normal mode at the first logical line is eligible", () => {
  assert.equal(isIdleNormalAtFirstLine(editor()), true);
  assert.equal(isIdleNormalAtFirstLine({ ...editor(), getMode: () => "insert" }), false);
  assert.equal(isIdleNormalAtFirstLine({ ...editor(), getMode: () => "visual" }), false);
  assert.equal(isIdleNormalAtFirstLine({ ...editor(), getCursor: () => ({ line: 1 }) }), false);
  assert.equal(isIdleNormalAtFirstLine({ ...editor(), getCursor: () => { throw new Error("bad"); } }), false);
  assert.equal(isIdleNormalAtFirstLine({ getMode: () => "normal", getCursor: () => ({ line: 0 }) }), false);
});

test("pending operators, character searches, counts, commands, and unknown state stay with pi-vim", () => {
  for (const change of [
    { pendingOperator: "d" }, { pendingMotion: "f" }, { pendingTextObject: "i" },
    { pendingExCommand: ":" }, { pendingReplace: true }, { pendingG: true },
    { prefixCount: "2" }, { operatorCount: "2" }, { pendingGCount: "2" },
    { discardingBracketedPasteInNormalMode: true }, { replayingRepeat: true },
    { pendingMotion: undefined },
  ]) assert.equal(isIdleNormalAtFirstLine({ ...editor(), ...change }), false, JSON.stringify(change));
});
