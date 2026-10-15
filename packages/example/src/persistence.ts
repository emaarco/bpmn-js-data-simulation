import type { Editor, Model } from './editor'
import { buildShareUrl } from './share'

export async function syncHash(model: Model): Promise<void> {
  try {
    const url = await buildShareUrl(model)
    history.replaceState(null, '', url.slice(url.indexOf('#')))
  } catch (error) {
    console.error(error)
  }
}

export function initHashAutosave(editor: Editor): () => void {
  let timer: number | undefined

  const persist = async (): Promise<void> => {
    timer = undefined
    try {
      await syncHash(await editor.save())
    } catch (error) {
      console.error(error)
    }
  }

  editor.onChange(() => {
    window.clearTimeout(timer)
    timer = window.setTimeout(() => void persist(), 400)
  })

  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && timer !== undefined) {
      window.clearTimeout(timer)
      void persist()
    }
  })

  return () => {
    window.clearTimeout(timer)
    timer = undefined
  }
}
