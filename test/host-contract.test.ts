import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { TuiAltScreen, stripTerminalSequences, type Terminal } from "@earendil-works/pi-tui";
import extension from "../src/index.ts";

function fixture(t: TestContext, enterKey?: string) {
  const noop = () => {};
  let onInput: (data: string) => void = () => assert.fail("terminal not started");
  const terminal: Terminal = {
    columns: 60, rows: 12, kittyProtocolActive: true,
    start: (listener) => { onInput = listener; }, stop: noop, drainInput: async () => {},
    write: noop, moveBy: noop, hideCursor: noop, showCursor: noop,
    clearLine: noop, clearFromCursor: noop, clearScreen: noop, setTitle: noop,
    setProgress: noop, setProgramStatus: noop,
  };
  const tui = new TuiAltScreen(terminal);
  const inputs: string[] = [];
  let mode = "insert";
  let autocomplete = false;
  const render = (width: number) => ["─".repeat(width - 8) + " INSERT "];
  const editor = {
    render, invalidate: noop, getText: () => "unchanged draft", getMode: () => mode,
    getCursor: () => ({ line: 0, col: 3 }), actionHandlers: new Map(),
    pendingMotion: null as string | null, pendingTextObject: null, pendingOperator: null, pendingExCommand: null,
    pendingReplace: false, pendingG: false, prefixCount: "", operatorCount: "", pendingGCount: "",
    discardingBracketedPasteInNormalMode: false, replayingRepeat: false,
    isShowingAutocomplete: () => autocomplete,
    handleInput: (data: string) => { inputs.push(data); if (data === "\x1b") mode = "normal"; },
    handleMouse: () => ({ focus: true }),
  };
  tui.addChild(editor);
  tui.setFocus(editor);
  const hooks = new Map<string, (...args: any[]) => any>();
  const pi = { on: (name: string, handler: (...args: any[]) => any) => hooks.set(name, handler) } as unknown as ExtensionAPI;
  // Only factory startup reads the environment; restore it before running each scenario.
  const saved = [process.env.PI_OUTPUT_NAV_ENTER, process.env.PI_OUTPUT_NAV_EXIT];
  try {
    if (enterKey) process.env.PI_OUTPUT_NAV_ENTER = enterKey;
    else delete process.env.PI_OUTPUT_NAV_ENTER;
    delete process.env.PI_OUTPUT_NAV_EXIT;
    extension(pi);
  } finally {
    for (const [i, name] of ["PI_OUTPUT_NAV_ENTER", "PI_OUTPUT_NAV_EXIT"].entries()) {
      if (saved[i] === undefined) delete process.env[name];
      else process.env[name] = saved[i];
    }
  }
  const ctx = { mode: "tui", ui: {
    theme: { bg: (_: string, text: string) => text, fg: (_: string, text: string) => text },
    setWidget: (_: string, factory?: (tui: unknown) => unknown) => factory?.(tui),
    onTerminalInput: (listener: any) => tui.addInputListener(listener),
    notify: () => assert.fail("unexpected warning"),
  } };
  hooks.get("session_start")?.({}, ctx);
  t.after(() => { hooks.get("session_shutdown")?.({}, ctx); tui.stop(); });
  tui.start();
  // Exercise the real Pi dispatch order: viewport listener, extension listener, release filter, focus target.
  const input = (data: string) => onInput(data);
  const border = () => stripTerminalSequences(editor.render(60)[0]);
  return { tui, editor, render, inputs, input, border, setMode: (value: string) => { mode = value; }, setAutocomplete: (value: boolean) => { autocomplete = value; } };
}

test("host Kitty releases do not flush pending j or enter output", (t) => {
  const f = fixture(t);
  f.input("j");
  f.input("\x1b[106;1:3u");
  assert.deepEqual(f.inputs, []);
  f.input("k");
  assert.deepEqual(f.inputs, ["\x1b"]);
  f.input("\x1b[107;5:3u"); // Ctrl+K release
  f.input("\x1b[107;1:3u"); // boundary k release in Normal
  assert.equal(f.tui.getFocusedComponent(), f.editor);
  assert.deepEqual(f.inputs, ["\x1b"]);
});

test("host encoded printable press and repeat events recognize jk without swallowing modifiers", (t) => {
  const f = fixture(t);
  for (const event of ["", ":1", ":2"]) {
    f.setMode("insert");
    f.input(`\x1b[106;1${event}u`);
    f.input("\x1b[106;1:3u");
    f.input(`\x1b[107;1${event}u`);
  }
  assert.deepEqual(f.inputs, ["\x1b", "\x1b", "\x1b"]);
  f.setMode("insert");
  f.input("\x1b[106;2u"); // Shift+J, not j
  f.input("k");
  f.input("j");
  f.input("\x1b[107;3u"); // Alt+K, not k
  assert.deepEqual(f.inputs.slice(3), ["\x1b[106;2u", "k", "j", "\x1b[107;3u"]);
});

test("host pastes and autocomplete bypass the chord and entry binding", (t) => {
  const f = fixture(t);
  f.input("j");
  f.input("\x1b[200~jk\x1b[106;1:3u\x1b[201~");
  f.input("\x1b[200~");
  f.input("j");
  f.input("k");
  f.input("\x1b[201~");
  assert.deepEqual(f.inputs, ["j", "\x1b[200~jk\x1b[106;1:3u\x1b[201~", "\x1b[200~", "j", "k", "\x1b[201~"]);
  f.setAutocomplete(true);
  f.input("j");
  f.input("k");
  f.input("\x0b");
  assert.equal(f.tui.getFocusedComponent(), f.editor);
  assert.deepEqual(f.inputs.slice(-3), ["j", "k", "\x0b"]);
});

test("configured j entry wins over Insert jk and configured k flushes an earlier j", (t) => {
  const j = fixture(t, "j");
  j.input("\x1b[106;1u");
  assert.notEqual(j.tui.getFocusedComponent(), j.editor);
  assert.deepEqual(j.inputs, []);
  j.input("\n");
  assert.equal(j.tui.getFocusedComponent(), j.editor);
  const k = fixture(t, "k");
  k.input("j");
  k.input("k");
  assert.notEqual(k.tui.getFocusedComponent(), k.editor);
  assert.deepEqual(k.inputs, ["j"]);
  assert.equal(k.editor.getMode(), "insert");
});

test("encoded standalone boundary keys retain Normal guards and bottom return semantics", (t) => {
  const f = fixture(t);
  f.setMode("normal");
  f.editor.pendingMotion = "f";
  f.input("\x1b[107;1u");
  assert.equal(f.tui.getFocusedComponent(), f.editor);
  f.editor.pendingMotion = null;
  f.input("\x1b[107;1:2u");
  const navigation = f.tui.getFocusedComponent();
  assert.notEqual(navigation, f.editor);
  f.input("\x1b[106;1:3u");
  assert.equal(f.tui.getFocusedComponent(), navigation);
  f.tui.scrollToBottom();
  f.input("\x1b[106;1u");
  assert.equal(f.tui.getFocusedComponent(), f.editor);
});

test("actual renderer mouse prompt focus clears badge without waiting for another key", (t) => {
  const f = fixture(t);
  f.input("\x0b");
  assert.match(f.border(), / OUTPUT  INSERT $/);
  f.tui.renderNow();
  const row = f.tui.getScreenLines().findIndex((line) => stripTerminalSequences(line).includes("OUTPUT"));
  assert.ok(row >= 0);
  f.input(`\x1b[<0;2;${row + 1}M`);
  assert.equal(f.tui.getFocusedComponent(), f.editor);
  f.tui.renderNow();
  assert.doesNotMatch(f.border(), /OUTPUT/);
  assert.equal(f.editor.render, f.render);
  f.input("x");
  assert.deepEqual(f.inputs, ["x"]);
});

test("dialog-to-editor restoration clears badge, but temporary overlays and native search restore navigation", (t) => {
  const f = fixture(t);
  f.input("\x0b");
  const navigation = f.tui.getFocusedComponent();
  const dialog = { render: () => ["dialog"], invalidate: () => {} };
  const overlay = f.tui.showOverlay(dialog);
  assert.doesNotMatch(f.border(), /OUTPUT/);
  overlay.hide();
  assert.equal(f.tui.getFocusedComponent(), navigation);
  assert.match(f.border(), /OUTPUT/);
  f.input("\x1b[102;6u"); // native Ctrl+Shift+F search precedes extension listener
  assert.equal(f.tui.hasOverlay(), true);
  assert.doesNotMatch(f.border(), /OUTPUT/);
  f.input("\x1b");
  assert.equal(f.tui.getFocusedComponent(), navigation);
  assert.match(f.border(), /OUTPUT/);
  // Same editor-slot/focus transitions as InteractiveMode.showTopExtensionDialog().
  f.tui.clear();
  f.tui.addChild(dialog);
  f.tui.setFocus(dialog);
  f.tui.renderNow();
  assert.equal(f.tui.getFocusedComponent(), dialog);
  f.tui.clear();
  f.tui.addChild(f.editor);
  f.tui.setFocus(f.editor);
  f.tui.renderNow();
  assert.doesNotMatch(f.border(), /OUTPUT/);
  assert.equal(f.editor.render, f.render);
  assert.equal(f.tui.getFocusedComponent(), f.editor);
  f.input("\x0b");
  f.input("\n");
  assert.equal(f.tui.getFocusedComponent(), f.editor);
  assert.equal(f.editor.getText(), "unchanged draft");
  assert.deepEqual(f.editor.getCursor(), { line: 0, col: 3 });
  assert.deepEqual(f.inputs, []);
});
