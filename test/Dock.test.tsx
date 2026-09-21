import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import Dock, { type DockTerminal } from '@/components/Dock'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true

function button(container: HTMLElement, label: string): HTMLButtonElement {
  const found = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)
  if (!found) throw new Error(`no button labelled ${label}`)
  return found
}

/** A tap: pointerdown does the work, and any click that follows is ignored. */
function press(element: HTMLButtonElement) {
  return act(() => {
    element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

describe('Dock', () => {
  let root: Root | undefined
  let container: HTMLElement
  let terminal: DockTerminal

  beforeEach(async () => {
    container = document.createElement('div')
    document.body.append(container)
    terminal = { sendData: vi.fn() }
    root = createRoot(container)
    await act(() => root?.render(<Dock terminal={terminal} />))
  })

  afterEach(async () => {
    if (root) await act(() => root?.unmount())
    root = undefined
    container.remove()
  })

  it('sends the plain sequence for a key', async () => {
    await press(button(container, 'Escape'))
    expect(terminal.sendData).toHaveBeenCalledWith('\x1b')
  })

  it('applies a held Ctrl to the next dock key, then releases it', async () => {
    const ctrl = button(container, 'Control')
    await press(ctrl)
    expect(ctrl.getAttribute('aria-pressed')).toBe('true')

    await press(button(container, 'Up'))
    expect(terminal.sendData).toHaveBeenCalledWith('\x1b[1;5A')
    expect(button(container, 'Control').getAttribute('aria-pressed')).toBe('false')

    await press(button(container, 'Up'))
    expect(terminal.sendData).toHaveBeenLastCalledWith('\x1b[A')
  })

  it('applies a held Ctrl to the next on-screen keyboard key, then releases it', async () => {
    await act(() => {
      terminal.transformInput?.('c')
    })
    expect(terminal.transformInput?.('c')).toBe('c')

    await press(button(container, 'Control'))
    let transformed: string | undefined
    await act(() => {
      transformed = terminal.transformInput?.('c')
    })
    expect(transformed).toBe('\x03')
    expect(button(container, 'Control').getAttribute('aria-pressed')).toBe('false')
  })

  it('keeps focus on the terminal when a button is tapped', async () => {
    const event = new PointerEvent('pointerdown', { bubbles: true, cancelable: true })
    await act(() => {
      button(container, 'Tab').dispatchEvent(event)
    })
    expect(event.defaultPrevented).toBe(true)
    expect(terminal.sendData).toHaveBeenCalledWith('\t')
  })

  it('sends once per tap, not twice, when a click follows pointerdown', async () => {
    await press(button(container, 'Tab'))
    expect(terminal.sendData).toHaveBeenCalledTimes(1)
  })

  it('still activates from a bare click, for keyboard users', async () => {
    await act(() => {
      button(container, 'Tab').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(terminal.sendData).toHaveBeenCalledWith('\t')
  })

  it('clears its input transform when unmounted', async () => {
    await act(() => root?.unmount())
    root = undefined
    expect(terminal.transformInput).toBeUndefined()
  })
})
