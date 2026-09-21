import { describe, expect, it } from 'vitest'

import { applyCtrl, ctrlChar, keySequence } from '@/lib/keys'

describe('ctrlChar', () => {
  it('maps letters to their control codes, ignoring case', () => {
    expect(ctrlChar('c')).toBe('\x03')
    expect(ctrlChar('C')).toBe('\x03')
    expect(ctrlChar('a')).toBe('\x01')
    expect(ctrlChar('z')).toBe('\x1a')
  })

  it('maps the caret-notation punctuation', () => {
    expect(ctrlChar('@')).toBe('\x00')
    expect(ctrlChar('[')).toBe('\x1b')
    expect(ctrlChar('\\')).toBe('\x1c')
    expect(ctrlChar(']')).toBe('\x1d')
    expect(ctrlChar('_')).toBe('\x1f')
    expect(ctrlChar('?')).toBe('\x7f')
  })

  it('returns null for characters with no control code', () => {
    expect(ctrlChar('1')).toBeNull()
    expect(ctrlChar('~')).toBeNull()
    expect(ctrlChar('')).toBeNull()
    expect(ctrlChar('ab')).toBeNull()
  })
})

describe('applyCtrl', () => {
  it('rewrites what it can and passes the rest through', () => {
    expect(applyCtrl('d')).toBe('\x04')
    expect(applyCtrl('1')).toBe('1')
    expect(applyCtrl('\x1b[A')).toBe('\x1b[A')
  })
})

describe('keySequence', () => {
  it('sends the plain encoding without Ctrl', () => {
    expect(keySequence('escape', false)).toBe('\x1b')
    expect(keySequence('tab', false)).toBe('\t')
    expect(keySequence('tilde', false)).toBe('~')
    expect(keySequence('pipe', false)).toBe('|')
    expect(keySequence('slash', false)).toBe('/')
    expect(keySequence('hyphen', false)).toBe('-')
    expect(keySequence('up', false)).toBe('\x1b[A')
    expect(keySequence('down', false)).toBe('\x1b[B')
    expect(keySequence('left', false)).toBe('\x1b[D')
    expect(keySequence('right', false)).toBe('\x1b[C')
  })

  it('sends the modifier-1;5 form for Ctrl + arrows', () => {
    expect(keySequence('up', true)).toBe('\x1b[1;5A')
    expect(keySequence('down', true)).toBe('\x1b[1;5B')
    expect(keySequence('left', true)).toBe('\x1b[1;5D')
    expect(keySequence('right', true)).toBe('\x1b[1;5C')
  })

  it('sends US for Ctrl + slash and Ctrl + hyphen', () => {
    expect(keySequence('slash', true)).toBe('\x1f')
    expect(keySequence('hyphen', true)).toBe('\x1f')
  })

  it('leaves keys Ctrl cannot modify alone', () => {
    expect(keySequence('escape', true)).toBe('\x1b')
    expect(keySequence('tab', true)).toBe('\t')
    expect(keySequence('tilde', true)).toBe('~')
    expect(keySequence('pipe', true)).toBe('|')
  })
})
