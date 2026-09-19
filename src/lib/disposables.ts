import type { IDisposable } from '@xterm/xterm'

function toDisposable(dispose: () => void): IDisposable {
  return { dispose }
}

export function addEventListener(
  target: EventTarget,
  type: string,
  listener: EventListener
): IDisposable {
  target.addEventListener(type, listener)
  return toDisposable(() => target.removeEventListener(type, listener))
}

export class DisposableStore implements IDisposable {
  private disposables: IDisposable[] = []

  add = <T extends IDisposable>(disposable: T): T => {
    this.disposables.push(disposable)
    return disposable
  }

  clear = () => {
    for (const disposable of this.disposables) {
      disposable.dispose()
    }
    this.disposables.length = 0
  }

  dispose = () => {
    this.clear()
  }
}
