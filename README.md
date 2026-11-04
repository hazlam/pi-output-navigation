# Pi output navigation

A standalone Pi extension for keyboard navigation of the fullscreen conversation output. It does not replace or modify the prompt editor and can be used alongside [pi-vim](https://github.com/lajarre/pi-vim).

## Install

With [Pi](https://github.com/earendil-works/pi) installed:

```sh
pi install git:github.com/hazlam/pi-output-navigation
pi --tui-mode fullscreen
```

This installs the extension for your user. Add `--local` to the install command for a project-scoped installation. Restart an existing Pi session or run `/reload` to load it. Load pi-vim separately if you want its Vim editing modes; basic output navigation does not require it.

To remove it:

```sh
pi remove git:github.com/hazlam/pi-output-navigation
```

The extension uses renderer capabilities introduced in Pi 1.4.0; the current automated test suite targets Pi 1.5.0. Other versions are not currently tested. It requires Pi's **fullscreen** TUI mode and does not control terminal-owned scrollback in regular mode.

## Try it without installing

From a local checkout:

```sh
pi --tui-mode fullscreen -e ./src/index.ts
```

## Keys

| Key | Action |
| --- | --- |
| `Ctrl+K` | Enter output mode from the prompt |
| `Ctrl+J` | Return to the prompt |
| `jk` | In pi-vim Insert mode, switch to Normal mode |
| `j` / `k` or down / up | Scroll one line down / up; `j` at the bottom returns to the prompt |
| `k` in pi-vim Normal mode | At the first logical prompt line, enter output mode |
| `Ctrl+D` / `Ctrl+U` | Scroll approximately half a terminal height down / up |
| `gg` / `G` | Jump to the top / bottom |
| `Page Up` / `Page Down` | Use Pi's native transcript paging |

A theme-colored `OUTPUT` badge appears on the right side of the prompt border next to pi-vim's mode label while output mode owns focus. The existing editor object is restored on exit, so its draft, cursor, and undo state are not reset. Other keystrokes in output mode are consumed rather than inserted into the prompt. **This includes `Escape` and `Ctrl+C`**; return to the prompt first to use the editor's application shortcuts. Pi's native fullscreen search and paging take precedence and continue to use their configured bindings.

The default entry key overrides Pi's `Ctrl+K` delete-to-end-of-line binding while the prompt is focused. Output mode uses `Ctrl+J` to return rather than insert a newline. To change the focus keys, set environment variables before starting Pi, using [Pi key syntax](https://github.com/earendil-works/pi/blob/v1.5.0/packages/coding-agent/docs/keybindings.md):

```sh
PI_OUTPUT_NAV_ENTER=ctrl+alt+k PI_OUTPUT_NAV_EXIT=ctrl+alt+j pi --tui-mode fullscreen
```

For `jk`, the extension waits up to 300 ms after `j` for `k`; otherwise it inserts `j` normally. An explicitly configured entry key takes precedence over this chord (for example, `PI_OUTPUT_NAV_ENTER=j` enters output instead of buffering `j`). Bracketed pastes are passed through without interpreting `jk`. The extension avoids taking the entry key when an overlay or autocomplete is open. Automatic `k` entry only applies to a standalone command: counts, operators, character-find commands, and other pending pi-vim input are left to pi-vim. It checks pi-vim's internal state because pi-vim does not expose a public idle-command API; if those fields are unavailable or change, automatic entry is disabled and `Ctrl+K` still works. Automatic `j` return requires the fullscreen renderer to report that it is following output at the bottom; if not, use `G` to resume following or `Ctrl+J`. The input interception and renderer focus/scroll methods are specific to Pi's current TUI implementation; compatibility with other extensions and future Pi versions is not guaranteed.

## Scope and limitations

This is a viewport navigation mode, not a Vim text cursor in the transcript. It does not provide output text selection, highlighting, Sneak, word motions, or Vim search. Pi's own search remains available. Scrolling up pauses following new output; `G` returns to the bottom and resumes following.

## Development

```sh
npm ci
npm run check
```

Node.js 22.19 or newer is required. The tests use TypeScript, Node's built-in test runner, and `tsx`. Pi supplies its own host packages at runtime; development dependencies are only needed for testing and type checking. CI runs the checks on Node.js 22.19.0, 24, and 26 and rejects high-severity dependency audit findings.

## License

[MIT](LICENSE).
