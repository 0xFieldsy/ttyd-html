import { describe, expect, it } from 'vitest'

import {
  Command,
  decodeServerMessage,
  encodeBinaryInput,
  encodeCommand,
  encodeHandshake,
  encodeInput,
  encodeResize
} from '@/lib/protocol'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

describe('terminal protocol', () => {
  it('decodes the command byte from a server message', () => {
    const message = Uint8Array.from([Command.SET_WINDOW_TITLE.charCodeAt(0), 65, 66]).buffer
    const decoded = decodeServerMessage(message)

    expect(decoded.command).toBe(Command.SET_WINDOW_TITLE)
    expect(Array.from(new Uint8Array(decoded.data))).toEqual([65, 66])
  })

  it('encodes the initial handshake', () => {
    const handshake = encodeHandshake('secret', 120, 40, encoder)

    expect(JSON.parse(decoder.decode(handshake))).toEqual({
      AuthToken: 'secret',
      columns: 120,
      rows: 40
    })
  })

  it('prefixes text input and preserves multibyte characters', () => {
    const input = encodeInput('hello 🌍', encoder)

    expect(String.fromCharCode(input[0])).toBe(Command.INPUT)
    expect(decoder.decode(input.subarray(1))).toBe('hello 🌍')
    expect(input.byteLength).toBe(11)
  })

  it('prefixes binary input without changing its bytes', () => {
    const input = encodeBinaryInput(Uint8Array.from([0, 127, 255]))

    expect(Array.from(input)).toEqual([Command.INPUT.charCodeAt(0), 0, 127, 255])
  })

  it('encodes terminal resize and command messages', () => {
    const resize = encodeResize(80, 24, encoder)

    expect(decoder.decode(resize)).toBe(`${Command.RESIZE_TERMINAL}{"columns":80,"rows":24}`)
    expect(decoder.decode(encodeCommand(Command.PAUSE, encoder))).toBe(Command.PAUSE)
    expect(decoder.decode(encodeCommand(Command.RESUME, encoder))).toBe(Command.RESUME)
  })
})
