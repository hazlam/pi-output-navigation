import assert from "node:assert/strict";
import { test } from "node:test";
import { OutputNavigation, type FocusTarget, type NavigationTui } from "../src/navigation.ts";

function fixture(mode = "fullscreen") {
  let draft = "a draft\nwith two lines";
  const editor: FocusTarget = {
    render: () => [], invalidate: () => {},
    handleInput: (data) => { draft += data; },
  };
  let focus: FocusTarget | null = editor;
  const calls: (string | number)[] = [];
  const statuses: boolean[] = [];
  const tui: NavigationTui = {
    mode, terminal: { rows: 24 },
    getFocusedComponent: () => focus,
    setFocus: (target) => { focus = target; },
    requestRender: () => {},
    scrollBy: (lines) => { calls.push(lines); },
    scrollToTop: () => { calls.push("top"); },
    scrollToBottom: () => { calls.push("bottom"); },
  };
  const nav = new OutputNavigation(tui, (data, key) => data === key, "ctrl+j", (value) => statuses.push(value));
  return { editor, nav, tui, calls, statuses, getFocus: () => focus, getDraft: () => draft };
}

test("switches focus, scrolls, and restores the same editor without changing its draft", () => {
  const f = fixture();
  assert.equal(f.nav.enter(), true);
  assert.equal(f.getFocus(), f.nav);
  for (const key of ["j", "k", "ctrl+d", "ctrl+u", "g", "g", "G", "unrelated text"]) f.getFocus()?.handleInput?.(key);
  assert.deepEqual(f.calls, [1, -1, 12, -12, "top", "bottom"]);
  assert.equal(f.getDraft(), "a draft\nwith two lines");
  f.getFocus()?.handleInput?.("ctrl+j");
  assert.equal(f.getFocus(), f.editor);
  assert.deepEqual(f.statuses, [true, false]);
});

test("j at the bottom restores prompt focus; down arrow remains a scroll key", () => {
  const f = fixture();
  let following = false;
  Object.defineProperty(f.tui, "isFollowingOutput", { get: () => following });
  f.nav.enter();
  f.nav.handleInput("j");
  assert.deepEqual(f.calls, [1]);
  assert.equal(f.getFocus(), f.nav);
  following = true;
  f.nav.handleInput("down");
  assert.equal(f.getFocus(), f.nav);
  f.nav.handleInput("j");
  assert.equal(f.getFocus(), f.editor);
  assert.deepEqual(f.calls, [1, 1]);
  assert.equal(f.getDraft(), "a draft\nwith two lines");
});

test("regular mode and renderers without scroll support are rejected without moving focus", () => {
  const regular = fixture("regular");
  assert.equal(regular.nav.enter(), false);
  assert.equal(regular.getFocus(), regular.editor);
  const unsupported = fixture();
  (unsupported.tui as unknown as { scrollBy?: unknown }).scrollBy = undefined;
  assert.equal(unsupported.nav.enter(), false);
  assert.equal(unsupported.getFocus(), unsupported.editor);
});

test("cleanup does not steal focus from a dialog", () => {
  const f = fixture();
  f.nav.enter();
  const dialog: FocusTarget = { render: () => [], invalidate: () => {} };
  f.tui.setFocus(dialog);
  f.nav.leave();
  assert.equal(f.getFocus(), dialog);
  assert.deepEqual(f.statuses, [true, false]);
});

test("pending g resets on unrelated input and on leaving", () => {
  const f = fixture();
  f.nav.enter();
  for (const key of ["g", "x", "g", "ctrl+j"]) f.nav.handleInput(key);
  f.nav.enter();
  f.nav.handleInput("g");
  assert.deepEqual(f.calls, []);
});

test("release events do not reset pending output commands", () => {
  const f = fixture();
  f.nav.enter();
  f.nav.handleInput("g");
  f.nav.handleInput("\x1b[103;1:3u");
  f.nav.handleInput("g");
  assert.deepEqual(f.calls, ["top"]);
});

test("focus reconciliation retains temporary owners but clears permanent prompt return", () => {
  const f = fixture();
  f.nav.enter();
  const dialog: FocusTarget = { render: () => [], invalidate: () => {} };
  f.tui.setFocus(dialog);
  assert.equal(f.nav.reconcileFocus(), false);
  assert.equal(f.getFocus(), dialog);
  assert.deepEqual(f.statuses, [true]);
  f.tui.setFocus(f.nav);
  assert.equal(f.nav.reconcileFocus(), true);
  f.tui.setFocus(f.editor);
  assert.equal(f.nav.reconcileFocus(), false);
  assert.deepEqual(f.statuses, [true, false]);
  assert.equal(f.getFocus(), f.editor);
  f.nav.reconcileFocus();
  assert.deepEqual(f.statuses, [true, false]);
});
