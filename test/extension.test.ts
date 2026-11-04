import assert from "node:assert/strict";
import { test } from "node:test";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import extension from "../src/index.ts";
import type { FocusTarget } from "../src/navigation.ts";

test("input interception only enters from the editor and restores focus on Ctrl+J", () => {
  const hooks = new Map<string, (...args: any[]) => any>();
  const pi = { on: (name: string, handler: (...args: any[]) => any) => hooks.set(name, handler) } as unknown as ExtensionAPI;
  extension(pi);
  const inputs: string[] = [];
  let mode = "insert";
  let line = 0;
  let following = false;
  const editor = {
    render: () => [], invalidate: () => {}, getText: () => "draft", getMode: () => mode,
    getCursor: () => ({ line, col: 0 }),
    pendingMotion: null as string | null, pendingTextObject: null, pendingOperator: null, pendingExCommand: null,
    pendingReplace: false, pendingG: false, prefixCount: "", operatorCount: "", pendingGCount: "",
    discardingBracketedPasteInNormalMode: false, replayingRepeat: false,
    handleInput: (data: string) => inputs.push(data), actionHandlers: new Map(),
  };
  let focus: FocusTarget | null = editor;
  let overlay = false;
  const scrolls: number[] = [];
  const statuses: (string | undefined)[] = [];
  let listener: (data: string) => { consume?: boolean } | undefined = () => undefined;
  let unsubscribed = false;
  const tui = {
    mode: "fullscreen", terminal: { rows: 30 }, hasOverlay: () => overlay,
    get isFollowingOutput() { return following; },
    getFocusedComponent: () => focus,
    setFocus: (target: FocusTarget | null) => { focus = target; },
    requestRender: () => {}, scrollBy: (n: number) => scrolls.push(n),
    scrollToTop: () => {}, scrollToBottom: () => {},
  };
  const ui = {
    theme: { bg: (_token: string, text: string) => `<bg>${text}</bg>`, fg: (_token: string, text: string) => text },
    setWidget: (_key: string, factory?: (tui: unknown) => unknown) => factory?.(tui),
    setStatus: (_key: string, value: string | undefined) => statuses.push(value),
    onTerminalInput: (fn: typeof listener) => { listener = fn; return () => { unsubscribed = true; }; },
    notify: () => assert.fail("unexpected warning"),
  };
  const ctx = { mode: "tui", ui };
  hooks.get("session_start")?.({}, ctx);
  assert.equal(listener("\x1b[200~"), undefined);
  assert.equal(listener("j"), undefined);
  assert.equal(listener("k"), undefined);
  assert.equal(listener("\x1b[201~"), undefined);
  assert.deepEqual(listener("j"), { consume: true });
  assert.deepEqual(listener("k"), { consume: true });
  assert.deepEqual(inputs, ["\x1b"]);
  overlay = true;
  assert.equal(listener("\x0b"), undefined);
  overlay = false;
  assert.deepEqual(listener("\x0b"), { consume: true });
  assert.notEqual(focus, editor);
  (focus as FocusTarget | null)?.handleInput?.("j");
  (focus as FocusTarget | null)?.handleInput?.("\n"); // legacy-terminal Ctrl+J
  assert.deepEqual(scrolls, [1]);
  assert.equal(focus, editor);
  assert.deepEqual(statuses, []);
  mode = "normal";
  line = 1;
  assert.equal(listener("k"), undefined);
  line = 0;
  editor.pendingMotion = "f";
  assert.equal(listener("k"), undefined);
  editor.pendingMotion = null;
  assert.deepEqual(listener("k"), { consume: true });
  assert.notEqual(focus, editor);
  following = true;
  (focus as FocusTarget | null)?.handleInput?.("j");
  assert.equal(focus, editor);
  listener("\x0b");
  hooks.get("session_shutdown")?.({}, ctx);
  assert.equal(focus, editor);
  assert.deepEqual(statuses, []);
  assert.equal(unsubscribed, true);
});
