import { isKeyRelease, matchesKey } from "@earendil-works/pi-tui";

export interface InsertEditor {
  getMode(): string;
  handleInput(data: string): void;
}

/** Delay a single j briefly so jk can be translated into an Escape. */
export class JkEscape {
  private pending: { editor: InsertEditor; timer: ReturnType<typeof setTimeout> } | undefined;

  constructor(private readonly requestRender: () => void, private readonly delayMs = 300) {}

  handle(data: string, editor: InsertEditor | null): boolean {
    if (isKeyRelease(data)) return false;
    if (this.pending) {
      const pending = this.pending;
      if (editor === pending.editor && editor.getMode() === "insert" && matchesKey(data, "k")) {
        clearTimeout(pending.timer);
        this.pending = undefined;
        editor.handleInput("\x1b");
        this.requestRender();
        return true;
      }
      this.flush();
    }
    if (editor?.getMode() !== "insert" || !matchesKey(data, "j")) return false;
    const timer = setTimeout(() => this.flush(), this.delayMs);
    this.pending = { editor, timer };
    return true;
  }

  flush(): void {
    const pending = this.pending;
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pending = undefined;
    pending.editor.handleInput("j");
    this.requestRender();
  }
}
