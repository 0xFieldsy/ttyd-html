import type { ITerminalOptions, ITheme } from '@xterm/xterm'
import { useEffect, useState } from 'react'

import Terminal from '@/components/Terminal'
import type { ClientOptions } from '@/lib/options'
import type { FlowControl } from '@/lib/xterm'

const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
const path = window.location.pathname.replace(/[/]+$/, '')
const wsUrl = [protocol, '//', window.location.host, path, '/ws', window.location.search].join('')
const tokenUrl = [window.location.protocol, '//', window.location.host, path, '/token'].join('')

const clientOptions = {
  rendererType: 'webgl',
  disableLeaveAlert: false,
  disableResizeOverlay: false,
  enableSixel: false,
  closeOnDisconnect: false,
  isWindows: false,
  unicodeVersion: '15-graphemes'
} as ClientOptions

type ThemeName = 'dark' | 'light'
type ThemeSetting = ThemeName | 'system'

// GitHub Default themes, ported from Ghostty
// https://github.com/mbadolato/iTerm2-Color-Schemes/tree/master/ghostty
const themes: Record<ThemeName, ITheme> = {
  light: {
    // BG color also used in index.html and index.css
    background: '#ffffff',
    foreground: '#1f2328',
    cursor: '#0969da',
    cursorAccent: '#3c9cff',
    selectionBackground: '#1f2328',
    selectionForeground: '#ffffff',
    black: '#24292f',
    red: '#cf222e',
    green: '#116329',
    yellow: '#4d2d00',
    blue: '#0969da',
    magenta: '#8250df',
    cyan: '#1b7c83',
    white: '#6e7781',
    brightBlack: '#57606a',
    brightRed: '#a40e26',
    brightGreen: '#1a7f37',
    brightYellow: '#633c01',
    brightBlue: '#218bff',
    brightMagenta: '#a475f9',
    brightCyan: '#3192aa',
    brightWhite: '#8c959f'
  },
  dark: {
    // BG color also used in index.html and index.css
    background: '#0d1117',
    foreground: '#e6edf3',
    cursor: '#2f81f7',
    cursorAccent: '#6fc1ff',
    selectionBackground: '#e6edf3',
    selectionForeground: '#0d1117',
    black: '#484f58',
    red: '#ff7b72',
    green: '#3fb950',
    yellow: '#d29922',
    blue: '#58a6ff',
    magenta: '#bc8cff',
    cyan: '#39c5cf',
    white: '#b1bac4',
    brightBlack: '#6e7681',
    brightRed: '#ffa198',
    brightGreen: '#56d364',
    brightYellow: '#e3b341',
    brightBlue: '#79c0ff',
    brightMagenta: '#d2a8ff',
    brightCyan: '#56d4dd',
    brightWhite: '#ffffff'
  }
}

const prefersDark = window.matchMedia('(prefers-color-scheme: dark)')

function getThemeSetting(): ThemeSetting {
  const dark = new URLSearchParams(window.location.search).get('dark')
  if (dark === 'true') return 'dark'
  if (dark === 'false') return 'light'
  return 'system'
}

function getThemeName(): ThemeName {
  const setting = getThemeSetting()
  return setting === 'system' ? (prefersDark.matches ? 'dark' : 'light') : setting
}

const baseTermOptions: ITerminalOptions = {
  fontSize: 16,
  fontFamily: [
    "'Maple Mono NF'",
    'ui-monospace',
    'SFMono-Regular',
    'Menlo',
    'Monaco',
    'Consolas',
    "'Liberation Mono'",
    "'Courier New'",
    "'Symbols Nerd Font Mono'",
    "'Symbols Nerd Font'",
    'monospace'
  ].join(','),
  allowProposedApi: true,
  scrollback: 10000,
  scrollOnEraseInDisplay: true // keep cleared screens (ED2) in scrollback
}

const flowControl: FlowControl = {
  limit: 100000,
  highWater: 10,
  lowWater: 4
}

export default function App() {
  const [themeName, setThemeName] = useState(getThemeName)

  useEffect(() => {
    const updateTheme = () => setThemeName(getThemeName())
    prefersDark.addEventListener('change', updateTheme)
    return () => {
      prefersDark.removeEventListener('change', updateTheme)
    }
  }, [])

  const theme = themes[themeName]
  const termOptions = { ...baseTermOptions, theme }

  return (
    <Terminal
      id="terminal-container"
      wsUrl={wsUrl}
      tokenUrl={tokenUrl}
      clientOptions={clientOptions}
      termOptions={termOptions}
      flowControl={flowControl}
    />
  )
}
