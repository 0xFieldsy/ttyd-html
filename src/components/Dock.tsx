import {
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState
} from 'react'

import { applyCtrl, type DockKeyName, dockKeys, keySequence } from '@/lib/keys'

/** The slice of the terminal client the dock drives. Xterm satisfies it structurally. */
export interface DockTerminal {
  sendData(data: string): void
  transformInput?: (data: string) => string
}

interface Props {
  terminal: DockTerminal | null
}

const symbols: DockKeyName[] = ['escape', 'tab', 'tilde', 'pipe', 'slash', 'hyphen']
const arrows: DockKeyName[] = ['left', 'down', 'up', 'right']

/**
 * Height of the on-screen keyboard, in pixels.
 *
 * Android shrinks the layout viewport (`interactive-widget=resizes-content`) and reports 0 here.
 * iOS leaves the layout viewport alone and only shrinks the visual viewport, so the dock has to be
 * lifted by hand to stay above the keyboard.
 */
function useKeyboardInset(): number {
  const [inset, setInset] = useState(0)

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return

    const update = () => {
      const covered = document.documentElement.clientHeight - viewport.height - viewport.offsetTop
      setInset(Math.max(0, Math.round(covered)))
    }

    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
    }
  }, [])

  return inset
}

const buttonClass =
  'flex h-10 min-w-9 flex-1 shrink-0 cursor-pointer select-none items-center justify-center ' +
  'rounded-md border text-sm leading-none font-medium'

// Idle and held colors are kept disjoint, so neither relies on utility ordering to win.
const idleClass =
  'border-zinc-300 bg-zinc-100 text-zinc-700 active:bg-zinc-200 dark:border-zinc-700 ' +
  'dark:bg-zinc-800 dark:text-zinc-200 dark:active:bg-zinc-700'

// The blues match the cursor in the GitHub light/dark palettes in src/App.tsx.
const activeClass =
  'border-blue-600 bg-blue-600 text-white active:bg-blue-700 dark:border-blue-500 ' +
  'dark:bg-blue-500 dark:text-white dark:active:bg-blue-400'

/**
 * Fire on pointerdown rather than click. Preventing the default keeps focus on the terminal, and
 * suppresses the compatibility mouse events.
 */
function usePress(onPress: () => void) {
  const pressedAt = useRef(Number.NEGATIVE_INFINITY)

  return {
    onPointerDown: (event: PointerEvent) => {
      event.preventDefault()
      pressedAt.current = event.timeStamp
      onPress()
    },
    onClick: (event: MouseEvent) => {
      if (event.timeStamp - pressedAt.current < 1000) return
      onPress()
    }
  }
}

interface KeyButtonProps {
  title: string
  active?: boolean
  onPress: () => void
  children: ReactNode
}

function KeyButton({ title, active, onPress, children }: KeyButtonProps) {
  const press = usePress(onPress)
  return (
    <button
      type="button"
      aria-label={title}
      aria-pressed={active}
      title={title}
      className={`${buttonClass} ${active ? activeClass : idleClass}`}
      {...press}
    >
      {children}
    </button>
  )
}

export default function Dock({ terminal }: Props) {
  const [ctrl, setCtrl] = useState(false)
  const inset = useKeyboardInset()

  const ctrlRef = useRef(ctrl)
  ctrlRef.current = ctrl

  // A held Ctrl applies to the next key from the on-screen keyboard too, then releases.
  useEffect(() => {
    if (!terminal) return
    terminal.transformInput = (data) => {
      if (!ctrlRef.current) return data
      setCtrl(false)
      return applyCtrl(data)
    }
    return () => {
      terminal.transformInput = undefined
    }
  }, [terminal])

  const send = (name: DockKeyName) => {
    terminal?.sendData(keySequence(name, ctrl))
    setCtrl(false)
  }

  return (
    // `bottom` rather than a transform, and positioned so the dock hit-tests above xterm's own
    // absolutely positioned layers once the keyboard lifts it over them
    <div
      style={{ bottom: inset || undefined }}
      className="relative z-10 flex w-full shrink-0 touch-manipulation gap-1 overflow-x-auto border-zinc-300 border-t bg-zinc-50/95 p-1.5 backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-900/95"
    >
      <KeyButton title="Control" active={ctrl} onPress={() => setCtrl(!ctrl)}>
        Ctrl
      </KeyButton>
      {symbols.map((name) => (
        <KeyButton key={name} title={dockKeys[name].title} onPress={() => send(name)}>
          {dockKeys[name].label}
        </KeyButton>
      ))}
      {arrows.map((name) => (
        <KeyButton key={name} title={dockKeys[name].title} onPress={() => send(name)}>
          {dockKeys[name].label}
        </KeyButton>
      ))}
    </div>
  )
}
