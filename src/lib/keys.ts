/** The keys the dock can send, and how each encodes with and without a held Ctrl. */
export type DockKeyName =
  | 'escape'
  | 'tab'
  | 'tilde'
  | 'pipe'
  | 'slash'
  | 'hyphen'
  | 'up'
  | 'down'
  | 'left'
  | 'right'

export interface DockKey {
  /** Glyph shown on the button. */
  label: string
  /** Spoken name, since most labels are symbols. */
  title: string
  /** Sequence sent when Ctrl is not held. */
  plain: string
  /** Set only where Ctrl does not follow from the caret notation of `plain`. */
  ctrl?: string
}

/**
 * Map a printable character to its control code, or null when it has none.
 * Caret notation: Ctrl+@ through Ctrl+_ are the codes 0x00-0x1f.
 */
export function ctrlChar(data: string): string | null {
  if (data.length !== 1) return null
  const code = data.toUpperCase().charCodeAt(0)
  if (code === 63) return '\x7f' // ? -> DEL
  if (code >= 64 && code <= 95) return String.fromCharCode(code - 64)
  return null
}

/** Apply a held Ctrl to terminal input, passing through keys that have no control code. */
export function applyCtrl(data: string): string {
  return ctrlChar(data) ?? data
}

export const dockKeys: Record<DockKeyName, DockKey> = {
  escape: { label: 'Esc', title: 'Escape', plain: '\x1b', ctrl: '\x1b' },
  tab: { label: 'Tab', title: 'Tab', plain: '\t', ctrl: '\t' },
  tilde: { label: '~', title: 'Tilde', plain: '~' },
  pipe: { label: '|', title: 'Pipe', plain: '|' },
  // Terminals conventionally send US (0x1f) for both Ctrl+/ and Ctrl+-.
  slash: { label: '/', title: 'Forward slash', plain: '/', ctrl: '\x1f' },
  hyphen: { label: '-', title: 'Hyphen', plain: '-', ctrl: '\x1f' },
  up: { label: '↑', title: 'Up', plain: '\x1b[A', ctrl: '\x1b[1;5A' },
  down: { label: '↓', title: 'Down', plain: '\x1b[B', ctrl: '\x1b[1;5B' },
  left: { label: '←', title: 'Left', plain: '\x1b[D', ctrl: '\x1b[1;5D' },
  right: { label: '→', title: 'Right', plain: '\x1b[C', ctrl: '\x1b[1;5C' }
}

/** The bytes a dock key sends, honouring a held Ctrl. */
export function keySequence(name: DockKeyName, ctrl: boolean): string {
  const key = dockKeys[name]
  if (!ctrl) return key.plain
  return key.ctrl ?? applyCtrl(key.plain)
}
