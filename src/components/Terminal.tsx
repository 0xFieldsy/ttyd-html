import { useEffect, useRef } from 'react'

import { Xterm, type XtermOptions } from '@/lib/xterm'

interface Props extends XtermOptions {
  id: string
}

export default function Terminal({ id, ...options }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const xterm = useRef<Xterm>(null)

  // the terminal owns its own lifecycle
  const optionsRef = useRef(options)
  optionsRef.current = options

  useEffect(() => {
    let disposed = false
    const term = new Xterm(optionsRef.current)
    xterm.current = term
    ;(async () => {
      await term.refreshToken()
      if (disposed || !container.current) return
      term.open(container.current)
      term.connect()
    })()

    return () => {
      disposed = true
      xterm.current = null
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
      className="h-full w-full overflow-hidden pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] [&_.terminal]:h-full [&_.terminal]:p-0 sm:[&_.terminal]:p-1.25 [&_.xterm-viewport]:bg-(--background)"
    />
  )
}
