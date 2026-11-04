import assert from "node:assert/strict";
import { test } from "node:test";
import { stripTerminalSequences, visibleWidth } from "@earendil-works/pi-tui";
import { addFocusBadge } from "../src/focus-badge.ts";

test("badge is on the editor border immediately before the pi-vim label", () => {
  const render = (_width: number) => ["─".repeat(32) + " INSERT "];
  const editor = { render, invalidate: () => {} };
  const restore = addFocusBadge(editor, (s) => `\x1b[7m${s}\x1b[27m`);
  const line = editor.render(40)[0];
  assert.equal(stripTerminalSequences(line), "─".repeat(24) + " OUTPUT  INSERT ");
  assert.match(line, /\x1b\[7m OUTPUT \x1b\[27m/);
  restore();
  assert.equal(editor.render, render);
});

test("badge restoration does not overwrite a subsequent renderer", () => {
  const editor = { render: (_width: number) => ["border"], invalidate: () => {} };
  const restore = addFocusBadge(editor, (s) => s);
  const other = () => ["other"];
  editor.render = other;
  restore();
  assert.equal(editor.render, other);
});

test("badge preserves full argument-bearing EX labels with ANSI and wide Unicode", () => {
  for (const label of [" EX :foo bar_ ", " EX :model 日本 語_ "]) {
    const width = 60;
    const source = ["─".repeat(width - visibleWidth(label)) + `\x1b[32m${label}\x1b[0m`];
    const editor = { render: (_width: number) => source, invalidate: () => {} };
    const restore = addFocusBadge(editor, (s) => `\x1b[7m${s}\x1b[27m`);
    const line = editor.render(width)[0];
    assert.equal(stripTerminalSequences(line), "─".repeat(width - visibleWidth(label) - 8) + " OUTPUT " + label);
    assert.equal(visibleWidth(line), width);
    assert.ok(line.includes(`\x1b[32m${label}`));
    assert.equal(source[0].includes("OUTPUT"), false);
    restore();
  }
});

test("badge leaves a narrow border and complete EX label intact when it cannot fit", () => {
  const line = "─ EX :foo bar_ ";
  const editor = { render: (_width: number) => [line], invalidate: () => {} };
  addFocusBadge(editor, (s) => s);
  assert.deepEqual(editor.render(visibleWidth(line)), [line]);
});
