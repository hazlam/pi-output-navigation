import assert from "node:assert/strict";
import { test } from "node:test";
import { JkEscape } from "../src/jk-escape.ts";

function fixture() {
  let mode = "insert";
  const input: string[] = [];
  const editor = { getMode: () => mode, handleInput: (data: string) => { input.push(data); if (data === "\x1b") mode = "normal"; } };
  return { editor, input, setMode: (value: string) => { mode = value; } };
}

test("jk sends Escape only in insert mode", () => {
  const f = fixture();
  const keys = new JkEscape(() => {});
  assert.equal(keys.handle("j", f.editor), true);
  assert.equal(keys.handle("k", f.editor), true);
  assert.deepEqual(f.input, ["\x1b"]);
  assert.equal(keys.handle("j", f.editor), false);
});

test("a lone j is delivered, and other input flushes it first", () => {
  const f = fixture();
  const keys = new JkEscape(() => {});
  assert.equal(keys.handle("j", f.editor), true);
  assert.equal(keys.handle("x", f.editor), false);
  assert.deepEqual(f.input, ["j"]);
  keys.handle("j", f.editor);
  keys.flush();
  assert.deepEqual(f.input, ["j", "j"]);
});

test("a delayed k does not trigger Escape", async () => {
  const f = fixture();
  const keys = new JkEscape(() => {}, 5);
  keys.handle("j", f.editor);
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(keys.handle("k", f.editor), false);
  assert.deepEqual(f.input, ["j"]);
});

test("different editors and pasted chunks never trigger jk", () => {
  const first = fixture();
  const second = fixture();
  const keys = new JkEscape(() => {});
  assert.equal(keys.handle("jk", first.editor), false);
  keys.handle("j", first.editor);
  assert.equal(keys.handle("k", second.editor), false);
  assert.deepEqual(first.input, ["j"]);
  assert.deepEqual(second.input, []);
});

test("Kitty j release leaves the chord pending until encoded k press or repeat", () => {
  for (const event of ["1", "2"]) {
    const f = fixture();
    const keys = new JkEscape(() => {});
    assert.equal(keys.handle(`\x1b[106;1:${event}u`, f.editor), true);
    assert.equal(keys.handle("\x1b[106;1:3u", f.editor), false);
    assert.deepEqual(f.input, []);
    assert.equal(keys.handle(`\x1b[107;1:${event}u`, f.editor), true);
    assert.deepEqual(f.input, ["\x1b"]);
  }
});
