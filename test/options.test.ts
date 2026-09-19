import type { ITerminalOptions } from '@xterm/xterm'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { type ClientOptions, parseUrlPreferences } from '@/lib/options'

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
  allowProposedApi: false,
  cursorBlink: true,
  fontSize: 14,
  theme: { background: '#000000' }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('parseUrlPreferences', () => {
  it('coerces known options using their default types', () => {
    const preferences = parseUrlPreferences(
      '?cursorBlink=0&enableSixel=1&fontSize=18&rendererType=dom&' +
        'theme=%7B%22foreground%22%3A%22%23fff%22%7D',
      clientOptions,
      termOptions
    )

    expect(preferences).toEqual({
      cursorBlink: false,
      enableSixel: true,
      fontSize: 18,
      rendererType: 'dom',
      theme: { foreground: '#fff' }
    })
  })

  it('accepts true as the other truthy boolean spelling', () => {
    expect(parseUrlPreferences('?cursorBlink=true', clientOptions, termOptions)).toEqual({
      cursorBlink: true
    })
  })

  it('ignores the app theme selector and unsupported transfer options', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const preferences = parseUrlPreferences(
      '?dark=true&enableZmodem=true&enableTrzsz=true&trzszDragInitTimeout=500',
      clientOptions,
      termOptions
    )

    expect(preferences).toEqual({})
    expect(warn).toHaveBeenCalledTimes(3)
    expect(warn).toHaveBeenCalledWith(
      '[ttyd] file transfer is not supported in this build, ignoring enableZmodem'
    )
  })

  it('keeps unknown options as strings and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    expect(parseUrlPreferences('?unknown=42', clientOptions, termOptions)).toEqual({
      unknown: '42'
    })
    expect(warn).toHaveBeenCalledWith('[ttyd] maybe unknown option: unknown=42, treating as string')
  })

  it('uses the last value when a query option is repeated', () => {
    expect(parseUrlPreferences('?fontSize=12&fontSize=16', clientOptions, termOptions)).toEqual({
      fontSize: 16
    })
  })

  it('rejects malformed JSON for object options', () => {
    expect(() => parseUrlPreferences('?theme=invalid', clientOptions, termOptions)).toThrow()
  })
})
