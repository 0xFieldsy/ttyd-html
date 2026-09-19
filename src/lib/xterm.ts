import { ClipboardAddon } from '@xterm/addon-clipboard'
import { FitAddon } from '@xterm/addon-fit'
import { ImageAddon } from '@xterm/addon-image'
import { UnicodeGraphemesAddon } from '@xterm/addon-unicode-graphemes'
import { WebLinksAddon } from '@xterm/addon-web-links'
import type { ITerminalOptions } from '@xterm/xterm'
import { Terminal } from '@xterm/xterm'

import { OverlayAddon } from './addons/overlay'
import { addEventListener, DisposableStore } from './disposables'
import {
  type ClientOptions,
  type Preferences,
  parseUrlPreferences,
  type RendererType
} from './options'
import {
  Command,
  decodeServerMessage,
  encodeBinaryInput,
  encodeCommand,
  encodeHandshake,
  encodeInput,
  encodeResize
} from './protocol'
import { Renderer } from './renderer'

export interface FlowControl {
  limit: number
  highWater: number
  lowWater: number
}

export interface XtermOptions {
  wsUrl: string
  tokenUrl: string
  flowControl: FlowControl
  clientOptions: ClientOptions
  termOptions: ITerminalOptions
}

interface TtydTerminal extends Terminal {
  fit(): void
}

declare global {
  interface Window {
    term: TtydTerminal
  }
}

// reconnect backoff, in milliseconds
const RECONNECT_BASE_DELAY = 500
const RECONNECT_MAX_DELAY = 15000

export class Xterm {
  private connectionDisposables = new DisposableStore()
  // Listeners that must outlive a socket close, torn down only by destroy().
  private lifetimeDisposables = new DisposableStore()
  private textEncoder = new TextEncoder()
  private textDecoder = new TextDecoder()
  private written = 0
  private pending = 0

  private terminal!: Terminal
  private fitAddon = new FitAddon()
  private overlayAddon = new OverlayAddon()
  private clipboardAddon = new ClipboardAddon()
  private webLinksAddon = new WebLinksAddon()
  private renderer?: Renderer

  private socket?: WebSocket
  private token = ''
  private opened = false
  private destroyed = false
  private title?: string
  private titleFixed?: string
  private resizeOverlay = true
  private reconnect = true
  private closeOnDisconnect = false
  private retryTimer?: number
  private retryAttempt = 0
  // True while awaiting a token, when there is no socket to inspect yet.
  private connecting = false

  private writeFunc = (data: ArrayBuffer) => this.writeData(new Uint8Array(data))

  constructor(options: XtermOptions) {
    this.options = options
  }

  private options: XtermOptions

  dispose = () => {
    this.connectionDisposables.clear()
  }

  /** Tear everything down, including the socket and the terminal itself. */
  destroy = () => {
    this.destroyed = true
    this.clearRetryTimer()
    this.dispose()
    this.lifetimeDisposables.dispose()
    this.socket?.close()
    this.socket = undefined
    this.terminal?.dispose()
  }

  setTheme = (theme: ITerminalOptions['theme']) => {
    this.options.termOptions.theme = theme
    if (this.terminal) this.terminal.options.theme = theme
  }

  refreshToken = async () => {
    try {
      const response = await fetch(this.options.tokenUrl)
      if (response.ok) {
        const json = await response.json()
        this.token = json.token
      }
    } catch (error) {
      console.error(`[ttyd] fetch ${this.options.tokenUrl}: `, error)
    }
  }

  private clearRetryTimer = () => {
    if (this.retryTimer === undefined) return
    clearTimeout(this.retryTimer)
    this.retryTimer = undefined
  }

  /** Refresh the token, then reconnect. Guards against overlapping attempts. */
  private retryConnect = () => {
    if (this.destroyed || this.connecting) return
    const state = this.socket?.readyState
    if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) return

    this.clearRetryTimer()
    this.dispose()
    this.connecting = true
    this.overlayAddon.showOverlay('Reconnecting...')
    this.refreshToken().then(() => {
      this.connecting = false
      this.connect()
    })
  }

  /** Queue a reconnect with exponential backoff and jitter. */
  private scheduleReconnect = () => {
    if (this.destroyed) return

    // Jitter delay across the upper half of the window so retries don't synchronize.
    const ceiling = Math.min(RECONNECT_MAX_DELAY, RECONNECT_BASE_DELAY * 2 ** this.retryAttempt)
    const delay = Math.round(ceiling / 2 + Math.random() * (ceiling / 2))
    this.retryAttempt++

    this.overlayAddon.showOverlay(
      `Reconnecting in ${(delay / 1000).toFixed(1)}s (#${this.retryAttempt})`
    )
    this.retryTimer = window.setTimeout(() => {
      this.retryTimer = undefined
      this.retryConnect()
    }, delay)
  }

  /**
   * Retry at once, cancelling any pending backoff. Fires when the tab becomes visible or the
   * network returns, since background timers are throttled and may not run at all during an outage.
   */
  private reconnectNow = () => {
    if (this.retryTimer === undefined) return

    this.retryAttempt = 0
    this.retryConnect()
  }

  private onWindowUnload = (event: BeforeUnloadEvent) => {
    if (this.socket?.readyState === WebSocket.OPEN) {
      event.preventDefault()
    }
  }

  open = (parent: HTMLElement) => {
    this.terminal = new Terminal(this.options.termOptions)
    this.renderer = new Renderer(this.terminal)
    const { terminal, fitAddon, overlayAddon, clipboardAddon, webLinksAddon } = this

    window.term = terminal as TtydTerminal
    window.term.fit = () => {
      this.fitAddon.fit()
    }

    terminal.loadAddon(fitAddon)
    terminal.loadAddon(overlayAddon)
    terminal.loadAddon(clipboardAddon)
    terminal.loadAddon(webLinksAddon)
    terminal.open(parent)

    // Registered once, outside the per-connection pool that dispose() drains.
    this.lifetimeDisposables.add(addEventListener(window, 'online', this.reconnectNow))
    this.lifetimeDisposables.add(
      addEventListener(document, 'visibilitychange', () => {
        if (document.visibilityState === 'visible') this.reconnectNow()
      })
    )

    fitAddon.fit()
  }

  private initListeners = () => {
    const { terminal, fitAddon, overlayAddon } = this
    this.connectionDisposables.add(
      terminal.onTitleChange((data) => {
        if (data && data !== '' && !this.titleFixed) {
          document.title = `${data} | ${this.title}`
        }
      })
    )
    this.connectionDisposables.add(terminal.onData((data) => this.processTerminalInput(data)))
    this.connectionDisposables.add(terminal.onBinary((data) => this.processBinaryInput(data)))
    this.connectionDisposables.add(
      terminal.onResize(({ cols, rows }) => {
        this.socket?.send(encodeResize(cols, rows, this.textEncoder))
        if (this.resizeOverlay) overlayAddon.showOverlay(`${cols}x${rows}`, 300)
      })
    )
    this.connectionDisposables.add(
      terminal.onSelectionChange(() => {
        if (this.terminal.getSelection() === '') return
        try {
          document.execCommand('copy')
        } catch {
          return
        }
        this.overlayAddon?.showOverlay('✂', 200)
      })
    )
    this.connectionDisposables.add(addEventListener(window, 'resize', () => fitAddon.fit()))
    // Mobile browsers resize the visual viewport (url bar, keyboard) without a window resize.
    if (window.visualViewport) {
      this.connectionDisposables.add(
        addEventListener(window.visualViewport, 'resize', () => fitAddon.fit())
      )
    }
    this.connectionDisposables.add(
      addEventListener(window, 'beforeunload', this.onWindowUnload as EventListener)
    )
  }

  writeData = (data: string | Uint8Array) => {
    const { terminal } = this
    const { limit, highWater, lowWater } = this.options.flowControl

    this.written += data.length
    if (this.written > limit) {
      terminal.write(data, () => {
        this.pending = Math.max(this.pending - 1, 0)
        if (this.pending < lowWater) {
          this.socket?.send(encodeCommand(Command.RESUME, this.textEncoder))
        }
      })
      this.pending++
      this.written = 0
      if (this.pending > highWater) {
        this.socket?.send(encodeCommand(Command.PAUSE, this.textEncoder))
      }
    } else {
      terminal.write(data)
    }
  }

  sendData = (data: string | Uint8Array) => {
    if (this.socket?.readyState !== WebSocket.OPEN) return

    const payload =
      typeof data === 'string' ? encodeInput(data, this.textEncoder) : encodeBinaryInput(data)
    this.socket.send(payload)
  }

  private processTerminalInput = (data: string) => {
    this.sendData(data)
  }

  private processBinaryInput = (data: string) => {
    this.sendData(Uint8Array.from(data, (value) => value.charCodeAt(0)))
  }

  connect = () => {
    if (this.destroyed) return
    this.socket = new WebSocket(this.options.wsUrl, ['tty'])
    const { socket } = this

    socket.binaryType = 'arraybuffer'
    this.connectionDisposables.add(addEventListener(socket, 'open', this.onSocketOpen))
    this.connectionDisposables.add(
      addEventListener(socket, 'message', this.onSocketData as EventListener)
    )
    this.connectionDisposables.add(
      addEventListener(socket, 'close', this.onSocketClose as EventListener)
    )
    // A transport error is followed by 'close', which decides whether to retry.
    this.connectionDisposables.add(
      addEventListener(socket, 'error', () => {
        console.warn('[ttyd] websocket error')
      })
    )
  }

  private onSocketOpen = () => {
    console.log('[ttyd] websocket connection opened')

    const { terminal, overlayAddon } = this
    this.socket?.send(encodeHandshake(this.token, terminal.cols, terminal.rows, this.textEncoder))

    this.retryAttempt = 0
    if (this.opened) {
      terminal.reset()
      terminal.options.disableStdin = false
      overlayAddon.showOverlay('Reconnected', 300)
    } else {
      this.opened = true
    }

    this.initListeners()
    terminal.focus()
  }

  private onSocketClose = (event: CloseEvent) => {
    console.log(`[ttyd] websocket connection closed with code: ${event.code}`)

    const { reconnect, overlayAddon } = this
    this.dispose()
    if (this.destroyed) return

    overlayAddon.showOverlay('Connection closed')

    // 1000: CLOSE_NORMAL
    if (event.code !== 1000 && reconnect) {
      this.scheduleReconnect()
    } else if (this.closeOnDisconnect) {
      window.close()
    } else {
      const { terminal } = this
      this.connectionDisposables.add(
        terminal.onKey((keyEvent) => {
          if (keyEvent.domEvent.key === 'Enter') {
            this.retryAttempt = 0
            this.retryConnect()
          }
        })
      )
      overlayAddon.showOverlay('Press ⏎ to Reconnect')
    }
  }

  private onSocketData = (event: MessageEvent) => {
    const { command, data } = decodeServerMessage(event.data as ArrayBuffer)

    switch (command) {
      case Command.OUTPUT:
        this.writeFunc(data)
        break
      case Command.SET_WINDOW_TITLE:
        this.title = this.textDecoder.decode(data)
        document.title = this.title
        break
      case Command.SET_PREFERENCES:
        this.applyPreferences({
          ...this.options.clientOptions,
          ...JSON.parse(this.textDecoder.decode(data)),
          ...parseUrlPreferences(
            window.location.search,
            this.options.clientOptions,
            this.terminal.options
          )
        } as Preferences)
        break
      default:
        console.warn(`[ttyd] unknown command: ${command}`)
        break
    }
  }

  private applyPreferences = (preferences: Preferences) => {
    const { terminal, fitAddon } = this
    const terminalOptions = terminal.options as Record<string, unknown>

    for (const [key, value] of Object.entries(preferences)) {
      switch (key) {
        case 'rendererType':
          this.renderer?.setType(value as RendererType)
          break
        case 'disableLeaveAlert':
          if (value) {
            window.removeEventListener('beforeunload', this.onWindowUnload as EventListener)
            console.log('[ttyd] leave site alert disabled')
          }
          break
        case 'disableResizeOverlay':
          if (value) {
            console.log('[ttyd] resize overlay disabled')
            this.resizeOverlay = false
          }
          break
        case 'disableReconnect':
          if (value) {
            console.log('[ttyd] reconnect disabled')
            this.reconnect = false
          }
          break
        case 'enableZmodem':
        case 'enableTrzsz':
        case 'trzszDragInitTimeout':
          console.warn(`[ttyd] file transfer is not supported in this build, ignoring ${key}`)
          break
        case 'enableSixel':
          if (value) {
            terminal.loadAddon(this.connectionDisposables.add(new ImageAddon()))
            console.log('[ttyd] sixel enabled')
          }
          break
        case 'closeOnDisconnect':
          if (value) {
            console.log('[ttyd] close on disconnect enabled (reconnect disabled)')
            this.closeOnDisconnect = true
            this.reconnect = false
          }
          break
        case 'titleFixed':
          if (!value || value === '') break
          console.log(`[ttyd] setting fixed title: ${value}`)
          this.titleFixed = value as string
          document.title = value as string
          break
        case 'isWindows':
          if (value) console.log('[ttyd] is windows')
          break
        case 'unicodeVersion':
          switch (value) {
            case 6:
            case '6':
              console.log('[ttyd] setting Unicode version: 6')
              break
            case 15:
            case '15':
              // Unicode 15 widths without grapheme clustering.
              // Keeps cell counts in step with wcwidth-based programs.
              console.log('[ttyd] setting Unicode version: 15')
              terminal.loadAddon(new UnicodeGraphemesAddon())
              terminal.unicode.activeVersion = '15'
              break
            default:
              console.log('[ttyd] setting Unicode version: 15-graphemes')
              terminal.loadAddon(new UnicodeGraphemesAddon())
              break
          }
          break
        default:
          console.log(`[ttyd] option: ${key}=${JSON.stringify(value)}`)
          if (terminalOptions[key] instanceof Object) {
            terminalOptions[key] = Object.assign({}, terminalOptions[key], value)
          } else {
            terminalOptions[key] = value
          }
          if (key.indexOf('font') === 0) fitAddon.fit()
          break
      }
    }
  }
}
