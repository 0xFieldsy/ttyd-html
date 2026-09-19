import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { OverlayAddon } from '@/lib/addons/overlay'

describe('OverlayAddon', () => {
  let addon: OverlayAddon
  let terminal: { element: HTMLElement }

  beforeEach(() => {
    vi.useFakeTimers()
    addon = new OverlayAddon()
    terminal = { element: document.createElement('div') }
    addon.activate(terminal as never)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('creates an overlay node with the expected styles', () => {
    const node = addon.overlayNode

    expect(node.style.borderRadius).toBe('15px')
    expect(node.style.fontSize).toBe('xx-large')
    expect(node.style.opacity).toBe('0.75')
    expect(node.style.position).toBe('absolute')
  })

  it('prevents default and stops propagation on mousedown', () => {
    const node = addon.overlayNode
    const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true })

    const preventDefault = vi.spyOn(event, 'preventDefault')
    const stopPropagation = vi.spyOn(event, 'stopPropagation')
    node.dispatchEvent(event)

    expect(preventDefault).toHaveBeenCalledOnce()
    expect(stopPropagation).toHaveBeenCalledOnce()
  })

  it('sets text content, styles, and appends the overlay on showOverlay', () => {
    addon.showOverlay('hello')

    const node = addon.overlayNode
    expect(node.textContent).toBe('hello')
    expect(node.style.color).toBe('#101010')
    expect(node.style.backgroundColor).toBe('#f0f0f0')
    expect(node.style.opacity).toBe('0.75')
    expect(node.parentNode).toBe(terminal.element)
  })

  it('positions the overlay centered based on bounding rects', () => {
    const node = addon.overlayNode
    terminal.element.getBoundingClientRect = () =>
      ({
        width: 200,
        height: 100,
        top: 0,
        left: 0,
        right: 200,
        bottom: 100,
        x: 0,
        y: 0,
        toJSON: () => ({})
      }) as DOMRect
    node.getBoundingClientRect = () =>
      ({
        width: 50,
        height: 30,
        top: 0,
        left: 0,
        right: 50,
        bottom: 30,
        x: 0,
        y: 0,
        toJSON: () => ({})
      }) as DOMRect

    addon.showOverlay('test')

    expect(node.style.top).toBe('35px')
    expect(node.style.left).toBe('75px')
  })

  it('does not re-append the overlay if already attached', () => {
    const appendChild = vi.spyOn(terminal.element, 'appendChild')
    addon.showOverlay('first')
    addon.showOverlay('second')

    expect(appendChild).toHaveBeenCalledOnce()
  })

  it('hides and removes the overlay after the timeout', () => {
    addon.showOverlay('fading', 1000)
    const node = addon.overlayNode

    expect(node.style.opacity).toBe('0.75')
    vi.advanceTimersByTime(1000)
    expect(node.style.opacity).toBe('0')
    vi.advanceTimersByTime(200)
    expect(node.parentNode).toBeNull()
    expect(node.style.opacity).toBe('0.75')
  })

  it('does not set a timeout when no timeout is provided', () => {
    addon.showOverlay('sticky')

    expect(vi.getTimerCount()).toBe(0)
    expect(addon.overlayTimeout as number | undefined).toBeUndefined()
  })

  it('clears a pending timeout when shown again', () => {
    addon.showOverlay('first', 1000)
    addon.showOverlay('second', 2000)

    vi.advanceTimersByTime(1000)
    const node = addon.overlayNode
    expect(node.style.opacity).toBe('0.75')
    expect(node.textContent).toBe('second')
  })

  it('returns early when terminal.element is missing', () => {
    const brokenTerminal = { element: undefined as HTMLElement | undefined }
    addon.activate(brokenTerminal as never)

    expect(() => addon.showOverlay('ignored')).not.toThrow()
  })
})
