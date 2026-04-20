import { useState, useEffect } from "react"
import { assetUrl } from "@/lib/api"

export function useVideoThumbnail(rawUrl: string | undefined): string | null {
  const url = rawUrl ? (assetUrl(rawUrl) || rawUrl) : undefined
  const [thumb, setThumb] = useState<string | null>(null)

  useEffect(() => {
    if (!url) return
    let cancelled = false

    let activeVideo: HTMLVideoElement | null = null

    function removeActive() {
      if (activeVideo?.parentNode) activeVideo.parentNode.removeChild(activeVideo)
      activeVideo = null
    }

    function tryCapture(crossOrigin: boolean) {
      removeActive()
      const video = document.createElement("video")
      activeVideo = video
      if (crossOrigin) video.crossOrigin = "anonymous"
      video.preload = "auto"
      video.muted = true
      video.playsInline = true
      video.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none"

      video.onloadedmetadata = () => {
        if (cancelled) return
        video.currentTime = Math.min(0.5, video.duration)
      }
      video.onseeked = () => {
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
          if (crossOrigin && !cancelled) { tryCapture(false); return }
        }
        removeActive()
      }
      video.onerror = () => {
        if (crossOrigin && !cancelled) tryCapture(false)
        else removeActive()
      }
      document.body.appendChild(video)
      video.src = url!
      video.load()
    }

    tryCapture(true)
    return () => { cancelled = true; removeActive() }
  }, [url])

  return thumb
}
