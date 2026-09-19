import type { ITerminalOptions } from '@xterm/xterm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ClientOptions } from '@/lib/options'
import { Command } from '@/lib/protocol'
import { Xterm, type XtermOptions } from '@/lib/xterm'

const mocks = vi.hoisted(() => ({
  addons: {
    clipboard: { name: 'clipboard' },
    fit: { name: 'fit', fit: vi.fn() },
    image: { name: 'image', dispose: vi.fn() },
    overlay: { name: 'overlay', showOverlay: vi.fn() },
    unicodeGraphemes: { name: 'unicode-graphemes' },
    webLinks: { name: 'web-links' }
  },
  handlers: {
    binary: undefined as ((data: string) => void) | undefined,
    data: undefined as ((data: string) => void) | undefined,
    key: undefined as ((event: { domEvent: KeyboardEvent }) => void) | undefined,
    resize: undefined as ((size: { cols: number; rows: number }) => void) | undefined,
    selectionChange: undefined as (() => void) | undefined,
    titleChange: undefined as ((data: string) => void) | undefined
  },
  rendererConstruct: vi.fn(),
  rendererSetType: vi.fn(),
  terminal: {
    cols: 80,
    dispose: vi.fn(),
    focus: vi.fn(),
    getSelection: vi.fn(),
    loadAddon: vi.fn(),
    onBinary: vi.fn(),
    onData: vi.fn(),
    onKey: vi.fn(),
    onResize: vi.fn(),
    onSelectionChange: vi.fn(),
    onTitleChange: vi.fn(),
    open: vi.fn(),
    options: {} as ITerminalOptions,
    reset: vi.fn(),
    rows: 24,
    unicode: { activeVersion: '' },
    write: vi.fn()
  },
  terminalConstruct: vi.fn(),
  webSocket: undefined as MockWebSocket | undefined
}))

class MockWebSocket extends EventTarget {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSED = 3

  binaryType = 'blob'
  close = vi.fn()
  protocols: string[]
  readyState = MockWebSocket.CONNECTING
  send = vi.fn()
  url: string

  constructor(url: string, protocols: string[]) {
    super()
    this.url = url
    this.protocols = protocols
    mocks.webSocket = this
  }

  closeWith(code: number) {
    this.readyState = MockWebSocket.CLOSED
    this.dispatchEvent(new CloseEvent('close', { code }))
  }
}

vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn(function Terminal(options: ITerminalOptions) {
    mocks.terminalConstruct(options)
    return mocks.terminal
  })
}))

vi.mock('@xterm/addon-clipboard', () => ({
  ClipboardAddon: vi.fn(function ClipboardAddon() {
    return mocks.addons.clipboard
  })
}))

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn(function FitAddon() {
    return mocks.addons.fit
  })
}))

vi.mock('@xterm/addon-image', () => ({
  ImageAddon: vi.fn(function ImageAddon() {
    return mocks.addons.image
  })
}))

vi.mock('@xterm/addon-unicode-graphemes', () => ({
  UnicodeGraphemesAddon: vi.fn(function UnicodeGraphemesAddon() {
    return mocks.addons.unicodeGraphemes
  })
}))

vi.mock('@/lib/addons/overlay', () => ({
  OverlayAddon: vi.fn(function OverlayAddon() {
    return mocks.addons.overlay
  })
}))

vi.mock('@xterm/addon-web-links', () => ({
  WebLinksAddon: vi.fn(function WebLinksAddon() {
    return mocks.addons.webLinks
  })
}))

vi.mock('@/lib/renderer', () => ({
  Renderer: class Renderer {
    setType = mocks.rendererSetType

    constructor(terminal: unknown) {
      mocks.rendererConstruct(terminal)
    }
  }
}))

const clientOptions: ClientOptions = {
  rendererType: 'webgl',
  disableLeaveAlert: false,
  disableResizeOverlay: false,
  enableSixel: true,
  isWindows: false,
  unicodeVersion: '15-graphemes',
  closeOnDisconnect: false
}

const termOptions: ITerminalOptions = {
  cursorBlink: true,
  fontSize: 14
}

const xterms: Xterm[] = []

function createXterm(
  flowControl: XtermOptions['flowControl'] = { limit: 100000, highWater: 10, lowWater: 4 }
) {
  const options: XtermOptions = {
    wsUrl: 'ws://localhost/ws',
    tokenUrl: '/token',
    flowControl,
    clientOptions,
    termOptions
  }

  const xterm = new Xterm(options)
  xterms.push(xterm)
  return xterm
}

function disposable() {
  return { dispose: vi.fn() }
}

function openConnection(xterm: Xterm) {
  xterm.open(document.createElement('div'))
  xterm.connect()
  if (!mocks.webSocket) throw new Error('WebSocket was not created')
  mocks.webSocket.readyState = MockWebSocket.OPEN
  mocks.webSocket.dispatchEvent(new Event('open'))
  return mocks.webSocket
}

function sendPreferences(socket: MockWebSocket, preferences: Record<string, unknown>) {
  const message = new TextEncoder().encode(
    `${Command.SET_PREFERENCES}${JSON.stringify(preferences)}`
  )
  socket.dispatchEvent(new MessageEvent('message', { data: message.buffer }))
}

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(mocks.handlers, {
    binary: undefined,
    data: undefined,
    key: undefined,
    resize: undefined,
    selectionChange: undefined,
    titleChange: undefined
  })
  mocks.terminal.getSelection.mockReturnValue('')
  mocks.terminal.onBinary.mockImplementation((handler) => {
    mocks.handlers.binary = handler
    return disposable()
  })
  mocks.terminal.onData.mockImplementation((handler) => {
    mocks.handlers.data = handler
    return disposable()
  })
  mocks.terminal.onKey.mockImplementation((handler) => {
    mocks.handlers.key = handler
    return disposable()
  })
  mocks.terminal.onResize.mockImplementation((handler) => {
    mocks.handlers.resize = handler
    return disposable()
  })
  mocks.terminal.onSelectionChange.mockImplementation((handler) => {
    mocks.handlers.selectionChange = handler
    return disposable()
  })
  mocks.terminal.onTitleChange.mockImplementation((handler) => {
    mocks.handlers.titleChange = handler
    return disposable()
  })
  delete termOptions.theme
  delete termOptions.disableStdin
  mocks.terminal.options = termOptions
  mocks.terminal.unicode.activeVersion = ''
  mocks.webSocket = undefined
  vi.stubGlobal('WebSocket', MockWebSocket)
  Object.defineProperty(document, 'execCommand', { configurable: true, value: vi.fn() })
})

afterEach(() => {
  for (const xterm of xterms.splice(0)) xterm.destroy()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Xterm open', () => {
  it('opens a terminal with the configured options and permanent addons', () => {
    const parent = document.createElement('div')
    const xterm = createXterm()

    xterm.open(parent)

    expect(mocks.terminalConstruct).toHaveBeenCalledWith(termOptions)
    expect(mocks.rendererConstruct).toHaveBeenCalledWith(mocks.terminal)
    expect(mocks.terminal.loadAddon.mock.calls).toEqual([
      [mocks.addons.fit],
      [mocks.addons.overlay],
      [mocks.addons.clipboard],
      [mocks.addons.webLinks]
    ])
    expect(mocks.terminal.open).toHaveBeenCalledWith(parent)
    expect(mocks.addons.fit.fit).toHaveBeenCalledOnce()
  })

  it('exposes a compatibility fit method on window.term', () => {
    const xterm = createXterm()

    xterm.open(document.createElement('div'))
    mocks.addons.fit.fit.mockClear()
    window.term.fit()

    expect(window.term).toBe(mocks.terminal)
    expect(mocks.addons.fit.fit).toHaveBeenCalledOnce()
  })

  it('removes its lifetime event listeners when destroyed', () => {
    const removeWindowListener = vi.spyOn(window, 'removeEventListener')
    const removeDocumentListener = vi.spyOn(document, 'removeEventListener')
    const xterm = createXterm()

    xterm.open(document.createElement('div'))
    xterm.destroy()

    expect(removeWindowListener).toHaveBeenCalledWith('online', expect.any(Function))
    expect(removeDocumentListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
    expect(mocks.terminal.dispose).toHaveBeenCalledOnce()
  })

  it('applies theme changes made before and after opening', () => {
    const initialTheme = { background: '#111111' }
    const updatedTheme = { background: '#222222' }
    const xterm = createXterm()

    xterm.setTheme(initialTheme)
    xterm.open(document.createElement('div'))
    expect(mocks.terminalConstruct).toHaveBeenCalledWith(
      expect.objectContaining({ theme: initialTheme })
    )

    xterm.setTheme(updatedTheme)
    expect(mocks.terminal.options.theme).toBe(updatedTheme)
  })

  it('writes output received from the server', () => {
    const xterm = createXterm()
    const output = Uint8Array.from([Command.OUTPUT.charCodeAt(0), 65, 66])

    xterm.open(document.createElement('div'))
    xterm.connect()
    mocks.webSocket?.dispatchEvent(new MessageEvent('message', { data: output.buffer }))

    expect(mocks.terminal.write).toHaveBeenCalledWith(Uint8Array.from([65, 66]))
  })
})

describe('Xterm connection listeners', () => {
  it('forwards terminal text and binary input to the socket', () => {
    const socket = openConnection(createXterm())
    socket.send.mockClear()

    mocks.handlers.data?.('hello')
    mocks.handlers.binary?.('\x00\xff')

    expect(Array.from(socket.send.mock.calls[0][0] as Uint8Array)).toEqual([
      Command.INPUT.charCodeAt(0),
      104,
      101,
      108,
      108,
      111
    ])
    expect(Array.from(socket.send.mock.calls[1][0] as Uint8Array)).toEqual([
      Command.INPUT.charCodeAt(0),
      0,
      255
    ])
  })

  it('updates the title and sends terminal resizes', () => {
    const xterm = createXterm()
    const socket = openConnection(xterm)
    const title = new TextEncoder().encode(`${Command.SET_WINDOW_TITLE}server`)
    socket.dispatchEvent(new MessageEvent('message', { data: title.buffer }))
    socket.send.mockClear()

    mocks.handlers.titleChange?.('shell')
    mocks.handlers.resize?.({ cols: 120, rows: 40 })

    expect(document.title).toBe('shell | server')
    expect(new TextDecoder().decode(socket.send.mock.calls[0][0] as Uint8Array)).toBe(
      `${Command.RESIZE_TERMINAL}{"columns":120,"rows":40}`
    )
    expect(mocks.addons.overlay.showOverlay).toHaveBeenCalledWith('120x40', 300)
  })

  it('copies a non-empty selection and shows feedback', () => {
    mocks.terminal.getSelection.mockReturnValue('selected text')
    openConnection(createXterm())

    mocks.handlers.selectionChange?.()

    expect(document.execCommand).toHaveBeenCalledWith('copy')
    expect(mocks.addons.overlay.showOverlay).toHaveBeenCalledWith('✂', 200)
  })

  it('fits on window resize and protects an open connection from unloading', () => {
    openConnection(createXterm())
    mocks.addons.fit.fit.mockClear()
    const unload = new Event('beforeunload', { cancelable: true })

    window.dispatchEvent(new Event('resize'))
    window.dispatchEvent(unload)

    expect(mocks.addons.fit.fit).toHaveBeenCalledOnce()
    expect(unload.defaultPrevented).toBe(true)
  })
})

describe('Xterm write data', () => {
  it('writes directly while accumulated data stays within the limit', () => {
    const xterm = createXterm({ limit: 3, highWater: 2, lowWater: 1 })
    xterm.open(document.createElement('div'))

    xterm.writeData('ab')
    xterm.writeData('c')

    expect(mocks.terminal.write.mock.calls).toEqual([['ab'], ['c']])
  })

  it('uses callbacks after crossing the limit and pauses and resumes the server', () => {
    const xterm = createXterm({ limit: 3, highWater: 1, lowWater: 1 })
    xterm.open(document.createElement('div'))
    xterm.connect()
    if (!mocks.webSocket) throw new Error('WebSocket was not created')
    mocks.webSocket.readyState = MockWebSocket.OPEN
    const socket = mocks.webSocket

    xterm.writeData('abcd')
    xterm.writeData('efgh')

    const firstDone = mocks.terminal.write.mock.calls[0][1] as () => void
    const secondDone = mocks.terminal.write.mock.calls[1][1] as () => void
    expect(firstDone).toEqual(expect.any(Function))
    expect(secondDone).toEqual(expect.any(Function))
    expect(new TextDecoder().decode(socket.send.mock.calls[0][0] as Uint8Array)).toBe(Command.PAUSE)

    firstDone()
    expect(socket.send).toHaveBeenCalledOnce()
    secondDone()
    expect(new TextDecoder().decode(socket.send.mock.calls[1][0] as Uint8Array)).toBe(
      Command.RESUME
    )
  })
})

describe('Xterm send data', () => {
  it('does nothing without an open socket', () => {
    const xterm = createXterm()

    expect(() => xterm.sendData('ignored')).not.toThrow()
    xterm.connect()
    xterm.sendData('also ignored')

    expect(mocks.webSocket?.send).not.toHaveBeenCalled()
  })

  it('encodes text and binary input for an open socket', () => {
    const xterm = createXterm()
    xterm.connect()
    if (!mocks.webSocket) throw new Error('WebSocket was not created')
    mocks.webSocket.readyState = MockWebSocket.OPEN
    const socket = mocks.webSocket

    xterm.sendData('hello')
    xterm.sendData(Uint8Array.from([0, 127, 255]))

    expect(Array.from(socket.send.mock.calls[0][0] as Uint8Array)).toEqual([
      Command.INPUT.charCodeAt(0),
      104,
      101,
      108,
      108,
      111
    ])
    expect(Array.from(socket.send.mock.calls[1][0] as Uint8Array)).toEqual([
      Command.INPUT.charCodeAt(0),
      0,
      127,
      255
    ])
  })
})

describe('Xterm refresh token', () => {
  it('fetches and stores a token for the next connection handshake', async () => {
    const fetch = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ token: 'fresh-token' }),
      ok: true
    })
    vi.stubGlobal('fetch', fetch)
    const xterm = createXterm()

    await xterm.refreshToken()
    const socket = openConnection(xterm)

    expect(fetch).toHaveBeenCalledWith('/token')
    expect(new TextDecoder().decode(socket.send.mock.calls[0][0] as Uint8Array)).toBe(
      JSON.stringify({ AuthToken: 'fresh-token', columns: 80, rows: 24 })
    )
  })

  it('keeps an empty token when the response is not successful', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    const xterm = createXterm()

    await xterm.refreshToken()
    const socket = openConnection(xterm)

    expect(new TextDecoder().decode(socket.send.mock.calls[0][0] as Uint8Array)).toBe(
      JSON.stringify({ AuthToken: '', columns: 80, rows: 24 })
    )
  })

  it('logs token request failures without rejecting', async () => {
    const error = new Error('network unavailable')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(error))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const xterm = createXterm()

    await expect(xterm.refreshToken()).resolves.toBeUndefined()

    expect(consoleError).toHaveBeenCalledWith('[ttyd] fetch /token: ', error)
  })
})

describe('Xterm apply preferences', () => {
  it('applies client preferences and enables their related behavior', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const removeWindowListener = vi.spyOn(window, 'removeEventListener')
    const closeWindow = vi.spyOn(window, 'close').mockImplementation(() => undefined)
    const xterm = createXterm()
    const socket = openConnection(xterm)

    sendPreferences(socket, {
      rendererType: 'dom',
      disableLeaveAlert: true,
      disableResizeOverlay: true,
      disableReconnect: true,
      enableSixel: true,
      closeOnDisconnect: true,
      titleFixed: 'fixed title',
      isWindows: true,
      unicodeVersion: '6'
    })

    expect(mocks.rendererSetType).toHaveBeenCalledWith('dom')
    expect(removeWindowListener).toHaveBeenCalledWith('beforeunload', expect.any(Function))
    expect(mocks.terminal.loadAddon).toHaveBeenCalledWith(mocks.addons.image)
    expect(document.title).toBe('fixed title')

    mocks.addons.overlay.showOverlay.mockClear()
    mocks.handlers.resize?.({ cols: 100, rows: 30 })
    expect(mocks.addons.overlay.showOverlay).not.toHaveBeenCalled()

    socket.closeWith(1006)
    expect(closeWindow).toHaveBeenCalledOnce()
  })

  it.each([
    ['6', false, ''],
    ['15', true, '15'],
    ['15-graphemes', true, '']
  ])('applies Unicode version %s', (unicodeVersion, loadsAddon, activeVersion) => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const socket = openConnection(createXterm())

    sendPreferences(socket, { enableSixel: false, unicodeVersion })

    const unicodeAddonCalls = mocks.terminal.loadAddon.mock.calls.filter(
      ([addon]) => addon === mocks.addons.unicodeGraphemes
    )
    expect(unicodeAddonCalls).toHaveLength(loadsAddon ? 1 : 0)
    expect(mocks.terminal.unicode.activeVersion).toBe(activeVersion)
  })

  it('updates terminal options, merges object values, and refits for font changes', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    mocks.terminal.options = {
      cursorBlink: true,
      fontSize: 14,
      theme: { background: '#111111', foreground: '#eeeeee' }
    }
    const socket = openConnection(createXterm())
    mocks.addons.fit.fit.mockClear()

    sendPreferences(socket, {
      enableSixel: false,
      unicodeVersion: '6',
      cursorBlink: false,
      fontSize: 18,
      theme: { foreground: '#ffffff' }
    })

    expect(mocks.terminal.options).toEqual({
      cursorBlink: false,
      fontSize: 18,
      theme: { background: '#111111', foreground: '#ffffff' }
    })
    expect(mocks.addons.fit.fit).toHaveBeenCalledOnce()
  })

  it('warns and ignores unsupported file-transfer preferences', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const socket = openConnection(createXterm())

    sendPreferences(socket, {
      enableSixel: false,
      unicodeVersion: '6',
      enableZmodem: true,
      enableTrzsz: true,
      trzszDragInitTimeout: 500
    })

    expect(warn.mock.calls.map(([message]) => message)).toEqual([
      '[ttyd] file transfer is not supported in this build, ignoring enableZmodem',
      '[ttyd] file transfer is not supported in this build, ignoring enableTrzsz',
      '[ttyd] file transfer is not supported in this build, ignoring trzszDragInitTimeout'
    ])
    expect(mocks.terminal.options).not.toHaveProperty('enableZmodem')
    expect(mocks.terminal.options).not.toHaveProperty('enableTrzsz')
    expect(mocks.terminal.options).not.toHaveProperty('trzszDragInitTimeout')
  })
})

describe('Xterm socket close', () => {
  it('schedules an abnormal-close reconnect with deterministic backoff', () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0)
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const xterm = createXterm()
    xterm.open(document.createElement('div'))
    xterm.connect()
    if (!mocks.webSocket) throw new Error('WebSocket was not created')

    mocks.webSocket.closeWith(1006)

    expect(mocks.addons.overlay.showOverlay).toHaveBeenCalledWith('Connection closed')
    expect(mocks.addons.overlay.showOverlay).toHaveBeenCalledWith('Reconnecting in 0.3s (#1)')
    expect(vi.getTimerCount()).toBe(1)
  })

  it('restores an operational connection after an abnormal close', async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0)
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const xterm = createXterm()
    const refreshToken = vi.spyOn(xterm, 'refreshToken').mockResolvedValue()
    const firstSocket = openConnection(xterm)
    firstSocket.send.mockClear()

    firstSocket.closeWith(1006)
    await vi.advanceTimersByTimeAsync(250)

    expect(refreshToken).toHaveBeenCalledOnce()
    const secondSocket = mocks.webSocket
    expect(secondSocket).toBeDefined()
    expect(secondSocket).not.toBe(firstSocket)
    expect(secondSocket?.readyState).toBe(MockWebSocket.CONNECTING)

    if (!secondSocket) throw new Error('Replacement WebSocket was not created')
    secondSocket.readyState = MockWebSocket.OPEN
    secondSocket.dispatchEvent(new Event('open'))

    expect(new TextDecoder().decode(secondSocket.send.mock.calls[0][0] as Uint8Array)).toBe(
      JSON.stringify({ AuthToken: '', columns: 80, rows: 24 })
    )
    expect(mocks.terminal.reset).toHaveBeenCalledOnce()
    expect(mocks.terminal.options.disableStdin).toBe(false)
    expect(mocks.addons.overlay.showOverlay).toHaveBeenCalledWith('Reconnected', 300)
    expect(mocks.terminal.focus).toHaveBeenCalledTimes(2)

    secondSocket.send.mockClear()
    mocks.handlers.data?.('after reconnect')
    expect(new TextDecoder().decode(secondSocket.send.mock.calls[0][0] as Uint8Array)).toBe(
      `${Command.INPUT}after reconnect`
    )
    expect(firstSocket.send).not.toHaveBeenCalled()

    const output = Uint8Array.from([Command.OUTPUT.charCodeAt(0), 79, 75])
    secondSocket.dispatchEvent(new MessageEvent('message', { data: output.buffer }))
    expect(mocks.terminal.write).toHaveBeenCalledWith(Uint8Array.from([79, 75]))
  })

  it('leaves an open connection alone when the network comes online', () => {
    const xterm = createXterm()
    const refreshToken = vi.spyOn(xterm, 'refreshToken').mockResolvedValue()
    const socket = openConnection(xterm)

    window.dispatchEvent(new Event('online'))

    expect(refreshToken).not.toHaveBeenCalled()
    expect(mocks.webSocket).toBe(socket)
  })

  it('cancels backoff and starts only one immediate reconnect', async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0)
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    let finishRefresh: (() => void) | undefined
    const xterm = createXterm()
    const refreshToken = vi.spyOn(xterm, 'refreshToken').mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishRefresh = resolve
        })
    )
    const firstSocket = openConnection(xterm)

    firstSocket.closeWith(1006)
    expect(vi.getTimerCount()).toBe(1)

    window.dispatchEvent(new Event('online'))
    window.dispatchEvent(new Event('online'))

    expect(vi.getTimerCount()).toBe(0)
    expect(refreshToken).toHaveBeenCalledOnce()
    expect(mocks.addons.overlay.showOverlay).toHaveBeenCalledWith('Reconnecting...')
    expect(mocks.webSocket).toBe(firstSocket)

    finishRefresh?.()
    await Promise.resolve()

    expect(mocks.webSocket).not.toBe(firstSocket)
    expect(mocks.webSocket?.readyState).toBe(MockWebSocket.CONNECTING)
  })

  it('reconnects on Enter after a normal close', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const xterm = createXterm()
    const socket = openConnection(xterm)
    const refreshToken = vi.spyOn(xterm, 'refreshToken').mockResolvedValue()
    const connect = vi.spyOn(xterm, 'connect').mockImplementation(() => undefined)
    const keyDisposable = disposable()
    mocks.terminal.onKey.mockImplementationOnce((handler) => {
      mocks.handlers.key = handler
      return keyDisposable
    })

    socket.closeWith(1000)
    mocks.handlers.key?.({ domEvent: new KeyboardEvent('keydown', { key: 'Escape' }) })
    expect(refreshToken).not.toHaveBeenCalled()
    mocks.handlers.key?.({ domEvent: new KeyboardEvent('keydown', { key: 'Enter' }) })
    await Promise.resolve()

    expect(keyDisposable.dispose).toHaveBeenCalledOnce()
    expect(mocks.addons.overlay.showOverlay).toHaveBeenCalledWith('Press ⏎ to Reconnect')
    expect(mocks.addons.overlay.showOverlay).toHaveBeenCalledWith('Reconnecting...')
    expect(refreshToken).toHaveBeenCalledOnce()
    expect(connect).toHaveBeenCalledOnce()
  })

  it('waits for Enter after a normal close despite browser wake-up events', () => {
    const xterm = createXterm()
    const socket = openConnection(xterm)
    const refreshToken = vi.spyOn(xterm, 'refreshToken').mockResolvedValue()
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')

    socket.closeWith(1000)
    window.dispatchEvent(new Event('online'))
    document.dispatchEvent(new Event('visibilitychange'))

    expect(refreshToken).not.toHaveBeenCalled()
    expect(mocks.webSocket).toBe(socket)
  })

  it('starts only one manual retry while refreshing or connecting', async () => {
    const xterm = createXterm()
    const socket = openConnection(xterm)
    let finishRefresh: (() => void) | undefined
    const refreshToken = vi.spyOn(xterm, 'refreshToken').mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishRefresh = resolve
        })
    )
    const keyDisposable = disposable()
    mocks.terminal.onKey.mockImplementationOnce((handler) => {
      mocks.handlers.key = handler
      return keyDisposable
    })
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')

    socket.closeWith(1000)
    const pressEnter = () => {
      mocks.handlers.key?.({ domEvent: new KeyboardEvent('keydown', { key: 'Enter' }) })
    }
    pressEnter()
    expect(keyDisposable.dispose).toHaveBeenCalledOnce()
    pressEnter()
    window.dispatchEvent(new Event('online'))
    document.dispatchEvent(new Event('visibilitychange'))
    expect(refreshToken).toHaveBeenCalledOnce()

    finishRefresh?.()
    await Promise.resolve()
    const replacement = mocks.webSocket
    expect(replacement).not.toBe(socket)
    pressEnter()
    expect(refreshToken).toHaveBeenCalledOnce()
    expect(mocks.webSocket).toBe(replacement)

    if (!replacement) throw new Error('Replacement WebSocket was not created')
    replacement.readyState = MockWebSocket.OPEN
    replacement.dispatchEvent(new Event('open'))
    pressEnter()
    expect(refreshToken).toHaveBeenCalledOnce()
    expect(mocks.webSocket).toBe(replacement)
  })

  it('disposes the Enter listener when destroyed after a normal close', () => {
    const xterm = createXterm()
    const socket = openConnection(xterm)
    const keyDisposable = disposable()
    mocks.terminal.onKey.mockReturnValueOnce(keyDisposable)

    socket.closeWith(1000)
    xterm.destroy()

    expect(keyDisposable.dispose).toHaveBeenCalledOnce()
  })

  it('closes the window instead of reconnecting when configured', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const closeWindow = vi.spyOn(window, 'close').mockImplementation(() => undefined)
    const xterm = createXterm()
    const socket = openConnection(xterm)
    const preferences = new TextEncoder().encode(
      `${Command.SET_PREFERENCES}${JSON.stringify({ closeOnDisconnect: true })}`
    )
    socket.dispatchEvent(new MessageEvent('message', { data: preferences.buffer }))

    socket.closeWith(1000)

    expect(closeWindow).toHaveBeenCalledOnce()
    expect(mocks.terminal.onKey).not.toHaveBeenCalled()
  })
})
