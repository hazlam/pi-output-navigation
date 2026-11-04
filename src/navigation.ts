import { isKeyRelease } from "@earendil-works/pi-tui";

export interface FocusTarget {
  handleInput?(data: string): void;
  render(width: number): string[];
  invalidate(): void;
}

/** The additional renderer capabilities used here are not part of the generic TUI interface. */
export interface NavigationTui {
  readonly mode: string;
  readonly terminal: { rows: number };
  readonly isFollowingOutput?: boolean;
  getFocusedComponent(): FocusTarget | null;
  hasOverlay?(): boolean;
  setFocus(component: FocusTarget | null): void;
  requestRender(): void;
  scrollBy(lines: number): void;
  scrollToTop(): void;
  scrollToBottom(): void;
}

export type KeyMatcher = (data: string, key: string) => boolean;

export class OutputNavigation implements FocusTarget {
  private previous: FocusTarget | null = null;
  private pendingG = false;
  constructor(
    private readonly tui: NavigationTui,
    private readonly matches: KeyMatcher,
    private readonly exitKey: string,
    private readonly setStatus: (active: boolean) => void,
  ) {}

  enter(): boolean {
    if (this.tui.mode !== "fullscreen" || typeof this.tui.scrollBy !== "function" ||
        typeof this.tui.scrollToTop !== "function" || typeof this.tui.scrollToBottom !== "function" ||
        typeof this.tui.getFocusedComponent !== "function") return false;
    const focused = this.tui.getFocusedComponent();
    if (!focused || focused === this) return false;
    this.previous = focused;
    this.pendingG = false;
    this.tui.setFocus(this);
    this.setStatus(true);
    this.tui.requestRender();
    return true;
  }

  leave(): void {
    const wasFocused = typeof this.tui.getFocusedComponent === "function" && this.tui.getFocusedComponent() === this;
    const previous = this.previous;
    this.previous = null;
    this.pendingG = false;
    if (wasFocused) this.tui.setFocus(previous);
    this.setStatus(false);
    this.tui.requestRender();
  }

  /** Prompt return is permanent; other focus owners may restore us (search/overlays). */
  reconcileFocus(): boolean {
    const focused = this.tui.getFocusedComponent?.();
    if (this.previous && focused === this.previous && !this.tui.hasOverlay?.()) this.leave();
    return focused === this;
  }

  handleInput(data: string): void {
    if (isKeyRelease(data)) return;
    if (this.matches(data, this.exitKey)) {
      this.leave();
      return;
    }
    if (this.pendingG) {
      this.pendingG = false;
      if (this.matches(data, "g")) {
        this.tui.scrollToTop();
        return;
      }
    }
    if (this.matches(data, "g")) this.pendingG = true;
    else if (data === "G" || this.matches(data, "shift+g")) this.tui.scrollToBottom();
    else if (this.matches(data, "j") && this.tui.isFollowingOutput === true) this.leave();
    else if (this.matches(data, "j") || this.matches(data, "down")) this.tui.scrollBy(1);
    else if (this.matches(data, "k") || this.matches(data, "up")) this.tui.scrollBy(-1);
    else if (this.matches(data, "ctrl+d")) this.tui.scrollBy(Math.max(1, Math.floor(this.tui.terminal.rows / 2)));
    else if (this.matches(data, "ctrl+u")) this.tui.scrollBy(-Math.max(1, Math.floor(this.tui.terminal.rows / 2)));
    // Other input is intentionally consumed, so it cannot change the draft.
  }

  render(_width: number): string[] { return []; }
  invalidate(): void {}
}
