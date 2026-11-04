import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isKeyRelease, matchesKey, type KeyId } from "@earendil-works/pi-tui";
import { OutputNavigation, type FocusTarget, type NavigationTui } from "./navigation.ts";
import { addFocusBadge } from "./focus-badge.ts";
import { JkEscape, type InsertEditor } from "./jk-escape.ts";
import { isIdleNormalAtFirstLine } from "./vim-boundary.ts";

const WIDGET = "pi-output-navigation-tui";

export default function outputNavigationExtension(pi: ExtensionAPI): void {
  // Configured before startup.
  const enterKey = (process.env.PI_OUTPUT_NAV_ENTER || "ctrl+k") as KeyId;
  const exitKey = (process.env.PI_OUTPUT_NAV_EXIT || "ctrl+j") as KeyId;
  let navigation: OutputNavigation | undefined;
  let unsubscribe: (() => void) | undefined;
  let restoreBadge: (() => void) | undefined;
  let jkEscape: JkEscape | undefined;

  pi.on("session_start", (_event, ctx) => {
    if (ctx.mode !== "tui") return;
    ctx.ui.setWidget(WIDGET, (tui) => {
      // Pi passes a forwarding reference; these renderer methods are checked at use time.
      navigation = new OutputNavigation(
        tui as unknown as NavigationTui,
        (data, key) => matchesKey(data, key as KeyId),
        exitKey,
        (active) => {
          if (!active) {
            restoreBadge?.();
            restoreBadge = undefined;
          }
        },
      );
      jkEscape = new JkEscape(() => tui.requestRender());
      let inPaste = false;
      unsubscribe?.();
      unsubscribe = ctx.ui.onTerminalInput((data) => {
        const startsPaste = data.includes("\x1b[200~");
        const endsPaste = data.includes("\x1b[201~");
        if (startsPaste || inPaste) {
          if (startsPaste) jkEscape?.flush();
          inPaste = !endsPaste;
          return undefined;
        }
        if (isKeyRelease(data)) return undefined;
        navigation?.reconcileFocus();
        const host = tui as unknown as Partial<NavigationTui>;
        const focused = host.getFocusedComponent?.() as (FocusTarget & { getText?: unknown; actionHandlers?: unknown; getMode?: () => string; isShowingAutocomplete?: () => boolean }) | null | undefined;
        // CustomEditor (including pi-vim) owns these; dialogs and other components should keep their keys.
        const isEditor = !!focused && typeof focused.getText === "function" && focused.actionHandlers instanceof Map && !tui.hasOverlay() && !focused.isShowingAutocomplete?.();
        const vimEditor = isEditor && typeof focused.getMode === "function" && typeof focused.handleInput === "function" ? focused as InsertEditor : null;
        const explicitEntry = isEditor && matchesKey(data, enterKey);
        if (explicitEntry) jkEscape?.flush();
        else if (jkEscape?.handle(data, vimEditor)) return { consume: true };
        if (!isEditor) return undefined;
        const boundaryEntry = matchesKey(data, "k") && isIdleNormalAtFirstLine(focused);
        if (!explicitEntry && !boundaryEntry) return undefined;
        if (!navigation?.enter()) {
          if (!explicitEntry) return undefined;
          ctx.ui.notify("Output navigation requires Pi fullscreen mode (1.4.0 or newer)", "warning");
        } else {
          restoreBadge?.();
          restoreBadge = addFocusBadge(focused, (text) => ctx.ui.theme.bg("selectedBg", ctx.ui.theme.fg("text", text)), () => navigation?.reconcileFocus() ?? false);
          tui.requestRender();
        }
        return { consume: true };
      });
      return { render: () => [], invalidate: () => {} };
    });
  });

  pi.on("session_shutdown", (_event, ctx) => {
    unsubscribe?.();
    unsubscribe = undefined;
    jkEscape?.flush();
    jkEscape = undefined;
    navigation?.leave();
    restoreBadge?.();
    restoreBadge = undefined;
    navigation = undefined;
    if (ctx.mode === "tui") {
      ctx.ui.setWidget(WIDGET, undefined);
    }
  });
}
