export const Command = {
  // server side
  OUTPUT: '0',
  SET_WINDOW_TITLE: '1',
  SET_PREFERENCES: '2',

  // client side
  INPUT: '0',
  RESIZE_TERMINAL: '1',
  PAUSE: '2',
  RESUME: '3'
} as const

export interface ServerMessage {
  command: string
  data: ArrayBuffer
}

export function decodeServerMessage(message: ArrayBuffer): ServerMessage {
  const bytes = new Uint8Array(message)
  return {
    command: String.fromCharCode(bytes[0]),
    data: message.slice(1)
  }
}

export function encodeHandshake(
  token: string,
  columns: number,
  rows: number,
  encoder: TextEncoder
): Uint8Array<ArrayBuffer> {
  return encoder.encode(
    JSON.stringify({
      AuthToken: token,
      columns,
      rows
    })
  )
}

export function encodeInput(data: string, encoder: TextEncoder): Uint8Array<ArrayBuffer> {
  const payload = new Uint8Array(data.length * 3 + 1)
  payload[0] = Command.INPUT.charCodeAt(0)
  const stats = encoder.encodeInto(data, payload.subarray(1))
  return payload.subarray(0, stats.written + 1)
}

export function encodeBinaryInput(data: Uint8Array): Uint8Array<ArrayBuffer> {
  const payload = new Uint8Array(data.length + 1)
  payload[0] = Command.INPUT.charCodeAt(0)
  payload.set(data, 1)
  return payload
}

export function encodeResize(
  columns: number,
  rows: number,
  encoder: TextEncoder
): Uint8Array<ArrayBuffer> {
  const message = JSON.stringify({ columns, rows })
  return encoder.encode(Command.RESIZE_TERMINAL + message)
}

export function encodeCommand(command: string, encoder: TextEncoder): Uint8Array<ArrayBuffer> {
  return encoder.encode(command)
}
