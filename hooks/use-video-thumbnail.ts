import { useState, useEffect } from "react"
import { assetUrl } from "@/lib/api"

export function useVideoThumbnail(rawUrl: string | undefined): string | null {
  const url = rawUrl ? (assetUrl(rawUrl) || rawUrl) : undefined
  const [thumb, setThumb] = useState<string | null>(null)

  useEffect(() => {
    if (!url) return
    let cancelled = false

    function tryCapture(crossOrigin: boolean) {
      const video = document.createElement("video")
      if (crossOrigin) video.crossOrigin = "anonymous"
      video.preload = "metadata"
      video.muted = true
      video.playsInline = true
      video.onloadeddata = () => {
        if (cancelled) return
        try {
          const canvas = document.createElement("canvas")
          canvas.width = 160
          canvas.height = 90
          const ctx = canvas.getContext("2d")
          if (ctx) {
            ctx.drawImage(video, 0, 0, 160, 90)
            setThumb(canvas.toDataURL("image/jpeg", 0.8))
          }
        } catch {
          if (crossOrigin && !cancelled) tryCapture(false)
        }
      }
      video.onerror = () => {
        if (crossOrigin && !cancelled) tryCapture(false)
      }
      video.src = url
      video.currentTime = 0.5
    }

    tryCapture(true)
    return () => { cancelled = true }
  }, [url])

  return thumb
}
