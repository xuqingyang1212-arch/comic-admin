"use client"

import { useRef, useEffect, useState } from "react"
import { X, Upload } from "lucide-react"
import { cn } from "@/lib/utils"
import { assetUrl } from "@/lib/api"
import type { UploadFileState, RemoteFileState } from "@/components/video-thumbnail"

export function ImagePreviewModal({ file, onClose }: { file: File; onClose: () => void }) {
  const url = useRef(URL.createObjectURL(file)).current
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  return <ImagePreviewModalInner src={url} title={file.name} onClose={onClose} />
}

export function ImagePreviewByUrl({ src, title, onClose }: { src: string; title?: string; onClose: () => void }) {
  return <ImagePreviewModalInner src={src} title={title ?? "图片预览"} onClose={onClose} />
}

function ImagePreviewModalInner({ src, title, onClose }: { src: string; title: string; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-[200] bg-black/80" onClick={onClose} />
      <div className="fixed inset-0 z-[201] flex items-center justify-center p-8 pointer-events-none">
        <div className="relative flex max-h-full max-w-[90vw] flex-col overflow-hidden rounded-[8px] bg-white shadow-2xl pointer-events-auto">
          <div className="flex items-center justify-between border-b border-[#e5e7eb] bg-[#f9fafb] px-4 py-2.5">
            <span className="truncate text-[12.5px] text-[#374151]">{title}</span>
            <button
              onClick={onClose}
              className="ml-4 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#374151] transition-colors"
            >
              <X size={14} />
            </button>
          </div>
          <div className="flex items-center justify-center overflow-auto bg-[#111827] p-4">
            <img src={src} alt={title} className="max-h-[75vh] max-w-full rounded-[4px] object-contain" />
          </div>
        </div>
      </div>
    </>
  )
}

export function ImageGalleryPreview({ images, initialIndex = 0, onClose }: { images: { src: string; title?: string }[]; initialIndex?: number; onClose: () => void }) {
  const [idx, setIdx] = useState(initialIndex)
  const total = images.length
  const hasPrev = idx > 0
  const hasNext = idx < total - 1

  const preloadRef = useRef<HTMLImageElement[]>([])
  const [readySet, setReadySet] = useState<Set<number>>(() => new Set())

  useEffect(() => {
    const imgs: HTMLImageElement[] = []
    images.forEach((item, i) => {
      const img = new window.Image()
      img.decoding = "async"
      img.onload = () => setReadySet((s) => { const n = new Set(s); n.add(i); return n })
      img.src = item.src
      imgs.push(img)
    })
    preloadRef.current = imgs
  }, [images])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowLeft" && hasPrev) setIdx((i) => i - 1)
      if (e.key === "ArrowRight" && hasNext) setIdx((i) => i + 1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose, hasPrev, hasNext])

  const current = images[idx]
  const isReady = readySet.has(idx)

  return (
    <>
      <div className="fixed inset-0 z-[200] bg-black/80" onClick={onClose} />
      <div className="fixed inset-0 z-[201] flex items-center justify-center p-8 pointer-events-none">
        <div className="relative flex max-h-full max-w-[90vw] flex-col overflow-hidden rounded-[8px] bg-white shadow-2xl pointer-events-auto">
          <div className="flex items-center justify-between border-b border-[#e5e7eb] bg-[#f9fafb] px-4 py-2.5">
            <span className="truncate text-[12.5px] text-[#374151]">
              {current.title ?? "图片预览"}
              {total > 1 && <span className="ml-2 text-[11.5px] text-[#9ca3af]">({idx + 1}/{total})</span>}
            </span>
            <button
              onClick={onClose}
              className="ml-4 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#374151] transition-colors"
            >
              <X size={14} />
            </button>
          </div>
          <div className="relative flex items-center justify-center bg-[#111827] p-4" style={{ minWidth: 320, minHeight: 240 }}>
            {!isReady && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              </div>
            )}
            {total > 1 && hasPrev && (
              <button
                onClick={() => setIdx((i) => i - 1)}
                className="absolute left-3 top-1/2 -translate-y-1/2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-lg text-[#374151] hover:bg-white transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
            )}
            <img
              src={current.src}
              alt={current.title ?? "预览"}
              className={cn("max-h-[75vh] max-w-full rounded-[4px] object-contain transition-opacity duration-100", isReady ? "opacity-100" : "opacity-0")}
            />
            {total > 1 && hasNext && (
              <button
                onClick={() => setIdx((i) => i + 1)}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-lg text-[#374151] hover:bg-white transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export function ImageThumbnail({
  state,
  onRemove,
  onPreview,
}: {
  state: UploadFileState
  onRemove: () => void
  onPreview?: () => void
}) {
  const url = useRef(URL.createObjectURL(state.file)).current
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  const sizeMB = (state.file.size / 1024 / 1024).toFixed(1)
  return (
    <div className="flex items-center gap-3 rounded-[6px] border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-2.5">
      <button
        onClick={onPreview}
        className="shrink-0 overflow-hidden rounded-[4px] border border-[#e5e7eb] hover:opacity-80 transition-opacity"
        title="点击放大预览"
        type="button"
      >
        <img
          src={url}
          alt={state.file.name}
          className="h-[52px] w-[52px] object-cover"
        />
      </button>
      <div className="flex flex-1 flex-col gap-0.5 min-w-0">
        <span className="truncate text-[12px] font-medium text-[#111827]">{state.file.name}</span>
        <div className="flex items-center gap-2">
          <span className="text-[11.5px] text-[#9ca3af]">{sizeMB} MB</span>
          <span className="text-[11.5px] font-medium text-[#38c08f]">上传完成</span>
        </div>
      </div>
      <button
        onClick={onRemove}
        className="shrink-0 rounded-[3px] border border-[#fecaca] bg-white px-2 py-0.5 text-[11px] text-[#dc2626] hover:bg-[#fef2f2] transition-colors"
      >
        删除
      </button>
    </div>
  )
}

export function UploadProgressBar({ state, onRemove }: { state: UploadFileState; onRemove: () => void }) {
  const sizeMB = (state.file.size / 1024 / 1024).toFixed(1)
  return (
    <div className="rounded-[6px] border border-[#e5e7eb] bg-white px-3 py-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Upload size={13} className={cn("shrink-0", state.done ? "text-[#38c08f]" : "text-[#9ca3af]")} />
          <span className="truncate text-[12px] font-medium text-[#111827]">{state.file.name}</span>
          <span className="shrink-0 text-[11.5px] text-[#9ca3af]">{sizeMB} MB</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={cn("text-[11.5px] font-medium", state.done ? "text-[#38c08f]" : "text-[#6b7280]")}>
            {state.done ? "上传完成" : `${state.progress}%`}
          </span>
          <button
            onClick={onRemove}
            className="flex h-5 w-5 items-center justify-center rounded-full text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#374151] transition-colors"
          >
            <X size={11} />
          </button>
        </div>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#f3f4f6]">
        <div
          className={cn("h-full rounded-full transition-all duration-200", state.done ? "bg-[#38c08f]" : "bg-[#60a5fa]")}
          style={{ width: `${state.progress}%` }}
        />
      </div>
    </div>
  )
}

function RemoteImageThumbnail({
  state,
  onRemove,
  onPreview,
}: {
  state: RemoteFileState
  onRemove: () => void
  onPreview: () => void
}) {
  const sizeMB = (state.fileSize / 1024 / 1024).toFixed(1)
  return (
    <div className="flex items-center gap-3 rounded-[6px] border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-2.5">
      <button
        onClick={onPreview}
        className="shrink-0 overflow-hidden rounded-[4px] border border-[#e5e7eb] hover:opacity-80 transition-opacity"
        title="点击放大预览"
        type="button"
      >
        <img src={assetUrl(state.remoteUrl)} alt={state.fileName} className="h-[52px] w-[52px] object-cover" />
      </button>
      <div className="flex flex-1 flex-col gap-0.5 min-w-0">
        <span className="truncate text-[12px] font-medium text-[#111827]">{state.fileName}</span>
        <div className="flex items-center gap-2">
          <span className="text-[11.5px] text-[#9ca3af]">{sizeMB} MB</span>
          <span className="text-[11.5px] font-medium text-[#38c08f]">已上传</span>
        </div>
      </div>
      <button
        onClick={onRemove}
        className="shrink-0 rounded-[3px] border border-[#fecaca] bg-white px-2 py-0.5 text-[11px] text-[#dc2626] hover:bg-[#fef2f2] transition-colors"
      >
        删除
      </button>
    </div>
  )
}

export function ImageUploadWithProgress({
  label,
  required = false,
  maxFiles,
  states,
  remoteStates,
  onAdd,
  onRemove,
  onRemoveRemote,
}: {
  label: string
  required?: boolean
  maxFiles: number
  states: UploadFileState[]
  remoteStates?: RemoteFileState[]
  onAdd: (files: File[]) => void
  onRemove: (idx: number) => void
  onRemoveRemote?: (idx: number) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [galleryState, setGalleryState] = useState<{ images: { src: string; title?: string }[]; index: number } | null>(null)
  const effectiveRemote = (remoteStates ?? []).length > 0 && states.length === 0 ? remoteStates! : []
  const totalCount = states.length + effectiveRemote.length
  const canAdd = totalCount < maxFiles

  const localBlobUrls = useRef<Map<File, string>>(new Map())
  function getLocalUrl(file: File): string {
    if (!localBlobUrls.current.has(file)) localBlobUrls.current.set(file, URL.createObjectURL(file))
    return localBlobUrls.current.get(file)!
  }

  function buildGalleryAndOpen(clickedIndex: number) {
    const items: { src: string; title?: string }[] = []
    for (const r of effectiveRemote) items.push({ src: assetUrl(r.remoteUrl), title: r.fileName })
    for (const s of states) {
      if (!s.done) continue
      items.push({ src: assetUrl(s.remoteUrl) || getLocalUrl(s.file), title: s.file.name })
    }
    if (items.length > 0) setGalleryState({ images: items, index: Math.min(clickedIndex, items.length - 1) })
  }

  return (
    <div>
      {label && (
        <div className="mb-1.5 text-[13px] font-medium text-[#374151]">
          {label}
          {required && <span className="ml-0.5 text-[#dc2626]">*</span>}
          <span className="ml-1.5 text-[12px] font-normal text-[#9ca3af]">（{totalCount}/{maxFiles}）</span>
        </div>
      )}
      {!label && totalCount > 0 && (
        <div className="mb-1 text-[11.5px] text-[#9ca3af]">{totalCount}/{maxFiles}</div>
      )}
      <div className="flex flex-col gap-2">
        {effectiveRemote.map((r, idx) => (
          <RemoteImageThumbnail
            key={`remote-${idx}`}
            state={r}
            onRemove={() => onRemoveRemote?.(idx)}
            onPreview={() => buildGalleryAndOpen(idx)}
          />
        ))}
        {states.map((s, idx) =>
          s.done ? (
            <ImageThumbnail
              key={idx}
              state={s}
              onRemove={() => onRemove(idx)}
              onPreview={() => buildGalleryAndOpen(effectiveRemote.length + idx)}
            />
          ) : (
            <UploadProgressBar key={idx} state={s} onRemove={() => onRemove(idx)} />
          )
        )}
        {canAdd && (
          <div
            onClick={() => inputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[6px] border-2 border-dashed border-[#d1d5db] bg-[#f9fafb] py-4 hover:border-[#38c08f] hover:bg-[#f0fdf4] transition-colors"
          >
            <Upload size={16} className="text-[#9ca3af]" />
            <span className="text-[12px] text-[#9ca3af]">点击上传（JPG、JPEG、PNG、GIF、WebP），单个文件不超过10MB</span>
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={maxFiles > 1}
        className="hidden"
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []).slice(0, maxFiles - totalCount)
          if (picked.length) onAdd(picked)
          e.target.value = ""
        }}
      />
      {galleryState && <ImageGalleryPreview images={galleryState.images} initialIndex={galleryState.index} onClose={() => setGalleryState(null)} />}
    </div>
  )
}
