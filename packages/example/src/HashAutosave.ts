import type { Editor } from './Editor'
import type { ShareLink } from './ShareLink'

const AUTOSAVE_DELAY = 400

export class HashAutosave {
  private timer?: number

  constructor(
    private readonly editor: Editor,
    private readonly shareLink: ShareLink,
  ) {
    editor.onChange(() => {
      window.clearTimeout(this.timer)
      this.timer = window.setTimeout(() => void this.persist(), AUTOSAVE_DELAY)
    })
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && this.timer !== undefined) {
        window.clearTimeout(this.timer)
        void this.persist()
      }
    })
  }

  cancel(): void {
    window.clearTimeout(this.timer)
    this.timer = undefined
  }

  private async persist(): Promise<void> {
    this.timer = undefined
    try {
      await this.shareLink.syncHash(await this.editor.save())
    } catch (error) {
      console.error(error)
    }
  }
}
