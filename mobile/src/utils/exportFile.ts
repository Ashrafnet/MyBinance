import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

function isShareCancel(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '')
  return /cancel|abort|dismiss|share canceled/i.test(msg)
}

/** Save/share a text file. Native Android/iOS use the system share sheet; web uses a download. */
export async function exportTextFile(filename: string, contents: string, title = 'Export file') {
  if (Capacitor.isNativePlatform()) {
    const written = await Filesystem.writeFile({
      path: filename,
      data: contents,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    })
    try {
      await Share.share({
        title,
        dialogTitle: title,
        files: [written.uri],
        url: written.uri,
      })
    } catch (err) {
      if (isShareCancel(err)) return
      throw err
    }
    return
  }

  const blob = new Blob([contents], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
