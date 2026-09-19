import { WebglAddon } from '@xterm/addon-webgl'
import type { Terminal } from '@xterm/xterm'

import type { RendererType } from './options'

export class Renderer {
  private webglAddon?: WebglAddon
  private terminal: Terminal

  constructor(terminal: Terminal) {
    this.terminal = terminal
  }

  dispose = () => {
    try {
      this.webglAddon?.dispose()
    } catch {
      // ignore
    }
    this.webglAddon = undefined
  }

  setType = (type: RendererType) => {
    switch (type) {
      case 'webgl':
        this.enableWebgl()
        break
      case 'dom':
        this.dispose()
        console.log('[ttyd] DOM renderer loaded')
        break
      default:
        console.warn(`[ttyd] unknown renderer type: ${type}, falling back to DOM renderer`)
        this.setType('dom')
        break
    }
  }

  private enableWebgl = () => {
    if (this.webglAddon) return
    this.webglAddon = new WebglAddon()
    try {
      this.webglAddon.onContextLoss(() => {
        console.warn('[ttyd] WebGL context lost, falling back to DOM renderer')
        this.dispose()
      })
      this.terminal.loadAddon(this.webglAddon)
      console.log('[ttyd] WebGL renderer loaded')
    } catch (error) {
      console.log('[ttyd] WebGL renderer could not be loaded, falling back to DOM renderer', error)
      this.dispose()
    }
  }
}
