import { useEffect, useRef } from 'react'

import { Xterm, type XtermOptions } from '@/lib/xterm'

interface Props extends XtermOptions {
  id: string
  /** Hands the client to the parent on mount, and null on unmount. */
  onReady?: (xterm: Xterm | null) => void
}

export default function Terminal({ id, onReady, ...options }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const xterm = useRef<Xterm>(null)

  // the terminal owns its own lifecycle
  const optionsRef = useRef(options)
  optionsRef.current = options
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady

  useEffect(() => {
    let disposed = false
    const term = new Xterm(optionsRef.current)
    xterm.current = term
    onReadyRef.current?.(term)
    ;(async () => {
      await term.refreshToken()
      if (disposed || !container.current) return
      term.open(container.current)
      term.connect()
    })()

    return () => {
      disposed = true
      xterm.current = null
      onReadyRef.current?.(null)
      term.destroy()
    }
  }, [])

  useEffect(() => {
    if (options.termOptions.theme) xterm.current?.setTheme(options.termOptions.theme)
  }, [options.termOptions.theme])

  return (
    // xterm renders `.terminal` into this container
    <div
      id={id}
      ref={container}
      className="min-h-0 w-full flex-1 overflow-hidden [&_.terminal]:h-full [&_.terminal]:p-0 sm:[&_.terminal]:p-1.25 [&_.xterm-viewport]:bg-(--background)"
    />
  )
}
