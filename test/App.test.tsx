import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({
  addEventListener: vi.fn(),
  matches: false,
  removeEventListener: vi.fn(),
  terminalProps: undefined as Record<string, unknown> | undefined,
  updateTheme: undefined as (() => void) | undefined
}))

vi.mock('@/components/Terminal', () => ({
  default: (props: Record<string, unknown>) => {
    mocks.terminalProps = props
    return null
  }
}))

async function renderApp() {
  const { default: App } = await import('@/App')
  const container = document.createElement('div')
  const root = createRoot(container)

  await act(() => root.render(<App />))
  return root
}

describe('App', () => {
  let root: Root | undefined

  beforeEach(() => {
    vi.resetModules()
    window.location.href = 'http://localhost/'
    mocks.matches = false
    mocks.terminalProps = undefined
    mocks.updateTheme = undefined
    mocks.addEventListener.mockImplementation((_type, listener: () => void) => {
      mocks.updateTheme = listener
    })
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({
        addEventListener: mocks.addEventListener,
        get matches() {
          return mocks.matches
        },
        media: '(prefers-color-scheme: dark)',
        removeEventListener: mocks.removeEventListener
      }))
    })
  })

  afterEach(async () => {
    if (root) await act(() => root?.unmount())
    root = undefined
    vi.restoreAllMocks()
  })

  it('builds endpoint URLs and passes the client defaults to Terminal', async () => {
    window.history.replaceState({}, '', '/terminal/?fontSize=18')
    root = await renderApp()

    expect(mocks.terminalProps).toMatchObject({
      id: 'terminal-container',
      wsUrl: `ws://${window.location.host}/terminal/ws?fontSize=18`,
      tokenUrl: `http://${window.location.host}/terminal/token`,
      clientOptions: {
        rendererType: 'webgl',
        disableLeaveAlert: false,
        disableResizeOverlay: false,
        enableSixel: false,
        closeOnDisconnect: false,
        isWindows: false,
        unicodeVersion: '15-graphemes'
      },
      flowControl: { limit: 100000, highWater: 10, lowWater: 4 }
    })
    expect(mocks.terminalProps?.termOptions).toMatchObject({
      fontSize: 16,
      allowProposedApi: true,
      scrollback: 10000,
      scrollOnEraseInDisplay: true,
      theme: { background: '#ffffff', foreground: '#1f2328' }
    })
  })

  it('uses a secure WebSocket URL when served over HTTPS', async () => {
    window.location.href = 'https://example.test/terminal?fontSize=18'
    root = await renderApp()

    expect(mocks.terminalProps).toMatchObject({
      wsUrl: 'wss://example.test/terminal/ws?fontSize=18',
      tokenUrl: 'https://example.test/terminal/token'
    })
  })

  it('lets the dark query parameter override the system theme', async () => {
    window.history.replaceState({}, '', '/?dark=true')
    root = await renderApp()

    expect(mocks.terminalProps?.termOptions).toMatchObject({
      theme: { background: '#0d1117', foreground: '#e6edf3' }
    })

    mocks.matches = false
    await act(() => mocks.updateTheme?.())

    expect(mocks.terminalProps?.termOptions).toMatchObject({
      theme: { background: '#0d1117' }
    })
  })

  it('lets dark=false override a dark system theme', async () => {
    window.history.replaceState({}, '', '/?dark=false')
    mocks.matches = true
    root = await renderApp()

    expect(mocks.terminalProps?.termOptions).toMatchObject({
      theme: { background: '#ffffff', foreground: '#1f2328' }
    })
  })

  it('follows system theme changes and removes its listener on unmount', async () => {
    window.history.replaceState({}, '', '/')
    mocks.matches = true
    root = await renderApp()

    expect(mocks.addEventListener).toHaveBeenCalledWith('change', expect.any(Function))
    expect(mocks.terminalProps?.termOptions).toMatchObject({
      theme: { background: '#0d1117' }
    })

    mocks.matches = false
    await act(() => mocks.updateTheme?.())

    expect(mocks.terminalProps?.termOptions).toMatchObject({
      theme: { background: '#ffffff' }
    })

    const listener = mocks.updateTheme
    await act(() => root?.unmount())
    root = undefined
    expect(mocks.removeEventListener).toHaveBeenCalledWith('change', listener)
  })
})
