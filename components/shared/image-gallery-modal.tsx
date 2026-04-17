"use client"

import { useState, useEffect } from "react"
import { X } from "lucide-react"
import { createPortal } from "react-dom"

export interface ImageGalleryModalProps {
  images: string[]
  initialIndex?: number
  onClose: () => void
  zIndex?: number
  resolveSrc?: (url: string) => string
}

export function ImageGalleryModal({
  images,
  initialIndex = 0,
  onClose,
  zIndex = 90,
  resolveSrc,
}: ImageGalleryModalProps) {
  const [idx, setIdx] = useState(initialIndex)
  const total = images.length
  const hasPrev = idx > 0
  const hasNext = idx < total - 1
  const src = resolveSrc ? resolveSrc(images[idx]) : images[idx]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowLeft" && hasPrev) setIdx((i) => i - 1)
      if (e.key === "ArrowRight" && hasNext) setIdx((i) => i + 1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose, hasPrev, hasNext])

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center bg-black/70" style={{ zIndex }} onClick={onClose}>
      <div className="relative max-w-[80vw] max-h-[80vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
        <img src={src} alt={`预览 ${idx + 1}/${total}`} className="max-w-full max-h-[75vh] rounded-[8px] object-contain shadow-2xl" />
        <button
          onClick={onClose}
          className="absolute -right-3 -top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-md text-[#374151] hover:bg-[#f3f4f6] transition-colors"
        >
          <X size={14} />
        </button>

        {total > 1 && (
          <>
            {hasPrev && (
              <button
                onClick={() => setIdx((i) => i - 1)}
                className="absolute left-[-48px] top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-lg text-[#374151] hover:bg-white transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
            )}
            {hasNext && (
              <button
                onClick={() => setIdx((i) => i + 1)}
                className="absolute right-[-48px] top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-lg text-[#374151] hover:bg-white transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            )}
            <div className="mt-3 rounded-full bg-black/50 px-3 py-1">
              <span className="text-[12px] text-white/90">{idx + 1} / {total}</span>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
