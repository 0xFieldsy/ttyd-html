import type { ITerminalOptions } from '@xterm/xterm'

export type RendererType = 'dom' | 'webgl'

export interface ClientOptions {
  rendererType: RendererType
  disableLeaveAlert: boolean
  disableResizeOverlay: boolean
  enableSixel: boolean
  titleFixed?: string
  isWindows: boolean
  unicodeVersion: string
  closeOnDisconnect: boolean
}

export type Preferences = ITerminalOptions & ClientOptions

export function parseUrlPreferences(
  query: string,
  clientOptions: ClientOptions,
  termOptions: ITerminalOptions
): Preferences {
  const clientOptionsRecord = clientOptions as unknown as Record<string, unknown>
  const termOptionsRecord = termOptions as Record<string, unknown>
  const preferences: Record<string, unknown> = {}

  for (const [key, queryValue] of new URLSearchParams(query)) {
    // Handled by App so it can select a GitHub light/dark palette.
    if (key === 'dark') continue
    if (['enableZmodem', 'enableTrzsz', 'trzszDragInitTimeout'].includes(key)) {
      console.warn(`[ttyd] file transfer is not supported in this build, ignoring ${key}`)
      continue
    }
    let value = clientOptionsRecord[key]
    if (value === undefined) value = termOptionsRecord[key]
    switch (typeof value) {
      case 'boolean':
        preferences[key] = queryValue === 'true' || queryValue === '1'
        break
      case 'number':
      case 'bigint':
        preferences[key] = Number.parseInt(queryValue, 10)
        break
      case 'string':
        preferences[key] = queryValue
        break
      case 'object':
        preferences[key] = JSON.parse(queryValue)
        break
      default:
        console.warn(`[ttyd] maybe unknown option: ${key}=${queryValue}, treating as string`)
        preferences[key] = queryValue
        break
    }
  }

  return preferences as unknown as Preferences
}
