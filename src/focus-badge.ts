import { sliceByColumn, stripTerminalSequences, visibleWidth } from "@earendil-works/pi-tui";
import type { FocusTarget } from "./navigation.ts";

/** Add a badge to the editor's bottom border without replacing the editor instance. */
export function addFocusBadge(editor: FocusTarget, style: (text: string) => string, isActive: () => boolean = () => true): () => void {
  const original = editor.render;
  const wrapped = function (this: FocusTarget, width: number): string[] {
    const lines = original.call(this, width);
    if (!isActive() || lines.length === 0) return lines;
    const last = lines.length - 1;
    const line = lines[last];
    const plain = stripTerminalSequences(line);
    // pi-vim's right-hand label includes the entire pending EX command, including spaces.
    const label = plain.match(/ (?:INSERT|NORMAL|VISUAL|V-LINE|EX)(?: .*)? $/)?.[0] ?? "";
    const badge = " OUTPUT ";
    const suffixWidth = visibleWidth(label);
    const start = width - suffixWidth - visibleWidth(badge);
    if (start < 1 || visibleWidth(line) < width) return lines;
    const result = [...lines];
    result[last] = sliceByColumn(line, 0, start) + style(badge) + sliceByColumn(line, start + visibleWidth(badge), suffixWidth);
    return result;
  };
  editor.render = wrapped;
  return () => {
    if (editor.render === wrapped) editor.render = original;
  };
}
