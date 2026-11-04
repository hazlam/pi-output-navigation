/**
 * pi-vim 0.14.x does not expose pending commands publicly. Only switch when
 * all known state fields exist and have their exact idle values; unknown or
 * changed implementations retain normal pi-vim behavior.
 */
export function isIdleNormalAtFirstLine(editor: unknown): boolean {
  if (!editor || typeof editor !== "object") return false;
  const e = editor as Record<string, unknown>;
  if (typeof e.getMode !== "function" || typeof e.getCursor !== "function") return false;
  try {
    const mode = (e.getMode as () => unknown).call(editor);
    const cursor = (e.getCursor as () => unknown).call(editor);
    if (mode !== "normal" || !cursor || typeof cursor !== "object" || (cursor as { line?: unknown }).line !== 0) return false;
    return e.pendingMotion === null && e.pendingTextObject === null && e.pendingOperator === null &&
      e.pendingExCommand === null && e.pendingReplace === false && e.pendingG === false &&
      e.prefixCount === "" && e.operatorCount === "" && e.pendingGCount === "" &&
      e.discardingBracketedPasteInNormalMode === false && e.replayingRepeat === false;
  } catch {
    return false;
  }
}
