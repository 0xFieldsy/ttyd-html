import type { Terminal } from '@xterm/xterm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Renderer } from '@/lib/renderer'

// Vitest hoists this ahead of static imports, so Renderer receives the mock.
const webgl = vi.hoisted(() => ({
  contextLossHandler: undefined as (() => void) | undefined,
  construct: vi.fn(),
  dispose: vi.fn(),
  onContextLoss: vi.fn()
}))

vi.mock('@xterm/addon-webgl', () => {
  class WebglAddon {
    constructor() {
      webgl.construct()
    }

    dispose = webgl.dispose

    onContextLoss = webgl.onContextLoss.mockImplementation((handler: () => void) => {
      webgl.contextLossHandler = handler
      return { dispose: vi.fn() }
    })
  }

  return { WebglAddon }
})

function createTerminal() {
  return { loadAddon: vi.fn() } as unknown as Terminal
}

beforeEach(() => {
  vi.clearAllMocks()
  webgl.contextLossHandler = undefined
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Renderer', () => {
  it('loads the WebGL addon once', () => {
    const terminal = createTerminal()
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const renderer = new Renderer(terminal)

    renderer.setType('webgl')
    renderer.setType('webgl')

    expect(webgl.construct).toHaveBeenCalledOnce()
    expect(terminal.loadAddon).toHaveBeenCalledOnce()
    expect(webgl.onContextLoss).toHaveBeenCalledOnce()
    expect(log).toHaveBeenCalledWith('[ttyd] WebGL renderer loaded')
  })

  it('disposes WebGL when switching to the DOM renderer', () => {
    const terminal = createTerminal()
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const renderer = new Renderer(terminal)

    renderer.setType('webgl')
    renderer.setType('dom')

    expect(webgl.dispose).toHaveBeenCalledOnce()
    expect(log).toHaveBeenCalledWith('[ttyd] DOM renderer loaded')
  })

  it('falls back after WebGL context loss', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const renderer = new Renderer(createTerminal())

    renderer.setType('webgl')
    webgl.contextLossHandler?.()

    expect(warn).toHaveBeenCalledWith('[ttyd] WebGL context lost, falling back to DOM renderer')
    expect(webgl.dispose).toHaveBeenCalledOnce()
  })

  it('falls back when the terminal rejects the WebGL addon', () => {
    const error = new Error('WebGL unavailable')
    const terminal = createTerminal()
    vi.mocked(terminal.loadAddon).mockImplementation(() => {
      throw error
    })
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const renderer = new Renderer(terminal)

    renderer.setType('webgl')

    expect(log).toHaveBeenCalledWith(
      '[ttyd] WebGL renderer could not be loaded, falling back to DOM renderer',
      error
    )
    expect(webgl.dispose).toHaveBeenCalledOnce()
  })

  it('falls back to DOM for an unknown renderer type', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const renderer = new Renderer(createTerminal())

    renderer.setType('canvas' as 'dom')

    expect(warn).toHaveBeenCalledWith(
      '[ttyd] unknown renderer type: canvas, falling back to DOM renderer'
    )
    expect(log).toHaveBeenCalledWith('[ttyd] DOM renderer loaded')
  })

  it('ignores disposal errors', () => {
    const renderer = new Renderer(createTerminal())
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    renderer.setType('webgl')
    webgl.dispose.mockImplementationOnce(() => {
      throw new Error('already disposed')
    })

    expect(() => renderer.dispose()).not.toThrow()
    expect(() => renderer.dispose()).not.toThrow()
  })
})
