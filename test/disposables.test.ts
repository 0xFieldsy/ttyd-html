import { describe, expect, it, vi } from 'vitest'

import { addEventListener, DisposableStore } from '@/lib/disposables'

describe('addEventListener', () => {
  it('removes the listener when disposed', () => {
    const target = new EventTarget()
    const listener = vi.fn()
    const disposable = addEventListener(target, 'change', listener)

    target.dispatchEvent(new Event('change'))
    disposable.dispose()
    target.dispatchEvent(new Event('change'))

    expect(listener).toHaveBeenCalledOnce()
  })
})

describe('DisposableStore', () => {
  it('returns added disposables and disposes all of them on clear', () => {
    const store = new DisposableStore()
    const first = { dispose: vi.fn() }
    const second = { dispose: vi.fn() }

    expect(store.add(first)).toBe(first)
    store.add(second)
    store.clear()

    expect(first.dispose).toHaveBeenCalledOnce()
    expect(second.dispose).toHaveBeenCalledOnce()
  })

  it('does not dispose cleared entries again', () => {
    const store = new DisposableStore()
    const disposable = { dispose: vi.fn() }

    store.add(disposable)
    store.clear()
    store.dispose()

    expect(disposable.dispose).toHaveBeenCalledOnce()
  })
})
