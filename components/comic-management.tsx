"use client"

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react"
import { Search, RotateCcw, ChevronDown, ChevronLeft, ChevronRight, Calendar, X, Download, ZoomIn, Play, Plus, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { comicApi, assetUrl } from "@/lib/api"
import { toast } from "@/lib/toast"
import { InlineVideoPlayer } from "@/components/video-thumbnail"
import { ListPagination, type PageSizeOption } from "@/components/list-pagination"
import { usePerm } from "@/components/admin-layout"

// ─── 类型定义 ──────────────────────────────────────────────────────────────────

type ArtStyle = "解说漫" | "动画漫" | "沙雕漫" | "仿真人剧"
type VisualEffect = "2D" | "3D" | "仿真人"
type AspectRatio = "横屏16:9" | "竖屏9:16"
type ComicStatus = "制作中" | "已完成" | "已下架" | "待审核"

interface EpisodeData {
  episodeNum: number
  subtitledUrl?: string
  rawUrl?: string
  fileSize?: number
  duration?: number
}

interface ComicRow {
  id: number
  comicId: string
  comicName: string
  coverImg: string
  scriptId: string
  artStyle: ArtStyle
  visualEffect: VisualEffect
  aspectRatio: AspectRatio
  writer: string
  producer: string
  episodeCount: number
  payEpisode: number
  copyrightImages: string[]
  episodes: EpisodeData[]
  status: ComicStatus
  createdAt: string
}

interface FilterForm {
  comicId: string
  comicName: string
  scriptId: string
  artStyle: string
  visualEffect: string
  aspectRatio: string
  writer: string
  producer: string
  createdAtRange: [string, string] | []
}

// ─── API → 表格行映射 ─────────────────────────────────────────────────────────

function formatComicCreatedAt(raw: string): string {
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

function mapApiComicToRow(d: {
  id: number
  comicId?: string
  episodeName?: string
  coverUrl?: string
  scriptId?: number | string
  artStyle?: string
  visualEffect?: string
  aspectRatio?: string
  writer?: { name?: string } | null
  producer?: { name?: string } | null
  script?: { scriptId?: string; payEpisode?: string } | null
  episodeCount?: number
  payEpisode?: string | number
  copyrightImages?: string[]
  episodes?: { episodeNum: number; subtitledUrl?: string; rawUrl?: string; fileSize?: number; duration?: number }[]
  status?: string
  createdAt?: string
}): ComicRow {
  const scriptPayEp = d.script?.payEpisode ?? d.payEpisode
  let payEpisode = 0
  if (typeof scriptPayEp === "number" && !Number.isNaN(scriptPayEp)) payEpisode = scriptPayEp
  else if (scriptPayEp != null && scriptPayEp !== "") {
    const n = parseInt(String(scriptPayEp).replace(/\D/g, ""), 10)
    if (!Number.isNaN(n)) payEpisode = n
  }
  const scriptIdStr = d.script?.scriptId ?? (d.scriptId != null ? String(d.scriptId) : "")
  return {
    id: Number(d.id),
    comicId: String(d.comicId ?? ""),
    comicName: String(d.episodeName ?? ""),
    coverImg: assetUrl(d.coverUrl),
    scriptId: scriptIdStr,
    artStyle: (d.artStyle as ArtStyle) || "解说漫",
    visualEffect: (d.visualEffect as VisualEffect) || "2D",
    aspectRatio: (d.aspectRatio as AspectRatio) || "横屏16:9",
    writer: d.writer?.name ?? "",
    producer: d.producer?.name ?? "",
    episodeCount: Number(d.episodeCount) || 0,
    payEpisode,
    copyrightImages: (d.copyrightImages ?? []).map(assetUrl),
    episodes: d.episodes ?? [],
    status: (d.status as ComicStatus) || "制作中",
    createdAt: d.createdAt ? formatComicCreatedAt(String(d.createdAt)) : "",
  }
}

function buildComicListParams(f: FilterForm, page: number, pageSize: number) {
  const range = f.createdAtRange
  const hasRange = range.length === 2
  return {
    page,
    pageSize,
    comicId: f.comicId.trim() || undefined,
    episodeName: f.comicName.trim() || undefined,
    artStyle: f.artStyle || undefined,
    visualEffect: f.visualEffect || undefined,
    aspectRatio: f.aspectRatio || undefined,
    writer: f.writer.trim() || undefined,
    producer: f.producer.trim() || undefined,
    scriptId: f.scriptId.trim() || undefined,
    ...(hasRange ? { startDate: range[0], endDate: range[1] } : {}),
  }
}

// ─── 筛选默认值 ───────────────────────────────────────────────────────────────

const defaultFilters: FilterForm = {
  comicId: "",
  comicName: "",
  scriptId: "",
  artStyle: "",
  visualEffect: "",
  aspectRatio: "",
  writer: "",
  producer: "",
  createdAtRange: [],
}

// ─── 枚举选项 ─────────────────────────────────────────────────────────────────

const artStyleOptions = [
  { label: "解说漫", value: "解说漫" },
  { label: "动画漫", value: "动画漫" },
  { label: "沙雕漫", value: "沙雕漫" },
  { label: "仿真人剧", value: "仿真人剧" },
]

const visualEffectOptions = [
  { label: "2D", value: "2D" },
  { label: "3D", value: "3D" },
  { label: "仿真人", value: "仿真人" },
]

const aspectRatioOptions = [
  { label: "横屏16:9", value: "横屏16:9" },
  { label: "竖屏9:16", value: "竖屏9:16" },
]

// ─── 状态样式 ─────────────────────────────────────────────────────────────────

const statusStyle: Record<string, { bg: string; text: string }> = {
  "制作中": { bg: "bg-[#eff6ff]", text: "text-[#2563eb]" },
  "已完成": { bg: "bg-[#ecfdf5]", text: "text-[#059669]" },
  "待审核": { bg: "bg-[#fff7ed]", text: "text-[#ea580c]" },
  "已下架": { bg: "bg-[#f3f4f6]", text: "text-[#6b7280]" },
}

// ─── 筛选组件（任务大厅统一风格）────────────────────────────────────────────

function FilterInput({
  label,
  placeholder,
  value,
  onChange,
  width = "w-[148px]",
}: {
  label: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  width?: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="whitespace-nowrap text-[13px] text-[#374151]">{label}</span>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn("h-[30px] rounded-[6px] border border-[#d1d5db] bg-white px-3 text-[13px] text-[#374151] placeholder-[#9ca3af] outline-none transition-colors focus:border-[#38c08f]", width)}
      />
    </div>
  )
}

function SelectFilter({
  label,
  value,
  onChange,
  options,
  width = "w-[120px]",
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { label: string; value: string }[]
  width?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  return (
    <div className="flex items-center gap-2">
      <span className="whitespace-nowrap text-[13px] text-[#374151]">{label}</span>
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "flex h-[30px] items-center gap-1.5 rounded-[6px] border border-[#d1d5db] bg-white px-3 text-[13px] transition-colors",
            open ? "border-[#38c08f]" : "hover:border-[#38c08f]",
            selected ? "text-[#374151]" : "text-[#9ca3af]",
            width
          )}
        >
          <span className="flex-1 text-left truncate">{selected ? selected.label : "请选择"}</span>
          {value ? (
            <X size={11} className="shrink-0 text-[#9ca3af] hover:text-[#374151]"
              onClick={(e) => { e.stopPropagation(); onChange(""); setOpen(false) }} />
          ) : (
            <ChevronDown size={12} className="shrink-0 text-[#9ca3af]" />
          )}
        </button>
        {open && (
          <div className="absolute left-0 top-[34px] z-50 min-w-full rounded-[6px] border border-[#e5e7eb] bg-white py-1 shadow-lg">
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false) }}
                className={cn(
                  "flex w-full items-center px-3 py-2 text-[13px] hover:bg-[#f0fdf4] transition-colors whitespace-nowrap",
                  value === opt.value ? "text-[#38c08f] font-medium" : "text-[#374151]"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── 视频缩略图 Hook ────────────────────────────────────────────────────────

function useVideoThumbnail(url: string | undefined): string | null {
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
          if (ctx) { ctx.drawImage(video, 0, 0, 160, 90); setThumb(canvas.toDataURL("image/jpeg", 0.8)) }
        } catch { if (crossOrigin && !cancelled) tryCapture(false) }
      }
      video.onerror = () => { if (crossOrigin && !cancelled) tryCapture(false) }
      video.src = url
      video.currentTime = 0.5
    }
    tryCapture(true)
    return () => { cancelled = true }
  }, [url])
  return thumb
}

function formatFileSize(bytes: number): string {
  if (bytes <= 0) return ""
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

// ─── 视频条目组件 ───────────────────────────────────────────────────────────

function RealVideoEpisodeItem({ ep, url, fileSize, onPlay }: { ep: number; url: string; fileSize?: number; onPlay: () => void }) {
  const thumb = useVideoThumbnail(url)

  function handleDownload(e: React.MouseEvent) {
    e.stopPropagation()
    if (!url) return
    fetch(url)
      .then((res) => res.blob())
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = blobUrl
        a.download = `第${ep}集.mp4`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(blobUrl)
      })
      .catch(() => {
        window.open(url, "_blank")
      })
  }

  return (
    <button
      onClick={onPlay}
      className="group flex w-full items-center gap-3 rounded-[6px] border border-[#e5e7eb] bg-white px-4 py-3 hover:bg-[#f9fafb] transition-colors text-left"
    >
      <div className="relative h-[42px] w-[74px] shrink-0 overflow-hidden rounded-[4px] bg-[#1f2937]">
        {thumb ? (
          <img src={thumb} alt={`第${ep}集`} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center"><svg viewBox="0 0 24 24" fill="white" className="h-5 w-5 opacity-40"><path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/></svg></div>
        )}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-black/50"><Play size={12} className="text-white translate-x-0.5" fill="white" /></div>
        </div>
      </div>
      <div className="flex flex-1 items-center gap-4 min-w-0">
        <span className="text-[13px] font-medium text-[#111827]">第{ep}集</span>
        {fileSize != null && fileSize > 0 && <span className="text-[12px] text-[#6b7280]">{formatFileSize(fileSize)}</span>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span
          onClick={handleDownload}
          className="flex h-7 w-7 items-center justify-center rounded-[4px] text-[#9ca3af] hover:bg-[#f0fdf4] hover:text-[#38c08f] transition-colors"
          title="下载视频"
        >
          <Download size={14} />
        </span>
        <Play size={14} className="shrink-0 text-[#38c08f]" />
      </div>
    </button>
  )
}

// ─── 图片画廊 Modal ───────────────────────────────────────────────────────────

function ImageGalleryModal({ images, initialIndex = 0, onClose }: { images: string[]; initialIndex?: number; onClose: () => void }) {
  const [idx, setIdx] = useState(initialIndex)
  const total = images.length
  const hasPrev = idx > 0
  const hasNext = idx < total - 1

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowLeft" && hasPrev) setIdx((i) => i - 1)
      if (e.key === "ArrowRight" && hasNext) setIdx((i) => i + 1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose, hasPrev, hasNext])

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="relative max-w-[80vw] max-h-[80vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
        <img src={images[idx]} alt={`预览 ${idx + 1}/${total}`} className="max-w-full max-h-[75vh] rounded-[8px] object-contain shadow-2xl" />
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
    </div>
  )
}

// ─── 视频列表面板 ───────────────────────����─────────����──────────────────────────

function VideoListPanel({
  episodes,
  type,
  scrollContainerRef,
}: {
  episodes: EpisodeData[]
  type: "subtitled" | "raw"
  scrollContainerRef: React.RefObject<HTMLDivElement>
}) {
  const [playingIdx, setPlayingIdx] = useState(-1)

  const sorted = useMemo(
    () => [...episodes].sort((a, b) => a.episodeNum - b.episodeNum),
    [episodes],
  )

  const getUrl = useCallback(
    (ep: EpisodeData) => assetUrl(type === "subtitled" ? ep.subtitledUrl : ep.rawUrl),
    [type],
  )

  const playEpisode = useCallback((idx: number) => {
    setPlayingIdx(idx)
    requestAnimationFrame(() => {
      const container = scrollContainerRef.current
      if (!container) return
      const target = container.querySelector(`[data-ep-idx="${idx}"]`) as HTMLElement | null
      if (target) {
        let offsetTop = 0
        let el: HTMLElement | null = target
        while (el && el !== container) { offsetTop += el.offsetTop; el = el.offsetParent as HTMLElement | null }
        container.scrollTo({ top: Math.max(0, offsetTop - 100), behavior: "smooth" })
      }
    })
  }, [scrollContainerRef])

  const handleEnded = useCallback(() => {
    const nextIdx = playingIdx + 1
    if (nextIdx < sorted.length && getUrl(sorted[nextIdx])) {
      playEpisode(nextIdx)
    } else {
      setPlayingIdx(-1)
    }
  }, [playingIdx, sorted, getUrl, playEpisode])

  if (sorted.length === 0 || sorted.every((ep) => !getUrl(ep))) {
    return (
      <div className="flex h-40 items-center justify-center">
        <p className="text-[13px] text-[#9ca3af]">暂无{type === "subtitled" ? "有字幕" : "无字幕"}视频</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 px-5 py-4">
      {sorted.map((ep, i) => {
        const url = getUrl(ep)
        if (!url) return null
        const isPlaying = playingIdx === i
        return (
          <div key={ep.episodeNum} data-ep-idx={i}>
            {!isPlaying ? (
              <RealVideoEpisodeItem ep={ep.episodeNum} url={url} fileSize={ep.fileSize} onPlay={() => playEpisode(i)} />
            ) : (
              <div className="overflow-hidden rounded-[6px] border-2 border-[#38c08f] bg-white">
                <div className="flex items-center justify-between border-b border-[#e5e7eb] px-4 py-2">
                  <span className="text-[13px] font-medium text-[#111827]">第{ep.episodeNum}集</span>
                  <button onClick={() => setPlayingIdx(-1)} className="text-[12px] text-[#9ca3af] hover:text-[#374151]">收起</button>
                </div>
                <div className="p-3">
                  <InlineVideoPlayer
                    src={url}
                    autoPlay
                    onEnded={handleEnded}
                  />
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── 任务信息面板 ─────────────────────────────────────────────────────────────

function TaskInfoPanel({ row }: { row: ComicRow }) {
  const [previewGallery, setPreviewGallery] = useState<{ images: string[]; index: number } | null>(null)

  return (
    <div className="flex flex-col gap-4 px-5 py-5">
      {/* 基本信息 */}
      <div className="rounded-[6px] border border-[#e5e7eb] bg-white">
        <div className="border-b border-[#f3f4f6] px-4 py-2.5">
          <span className="text-[11.5px] font-semibold uppercase tracking-wide text-[#9ca3af]">基本信息</span>
        </div>
        <div className="flex flex-col gap-3 px-4 py-4">
          <div className="flex items-start gap-2">
            <span className="w-[72px] shrink-0 text-right text-[12px] text-[#9ca3af]">剧集名称</span>
            <span className="flex-1 text-[13px] font-medium text-[#111827] leading-relaxed">{row.comicName}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-[72px] shrink-0 text-right text-[12px] text-[#9ca3af]">集数</span>
            <span className="flex-1 text-[13px] text-[#374151]">{row.episodeCount} 集</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-[72px] shrink-0 text-right text-[12px] text-[#9ca3af]">付费卡点</span>
            <span className="inline-flex items-center rounded-[4px] border border-[#fde68a] bg-[#fffbeb] px-2 py-0.5 text-[11.5px] font-medium text-[#92400e]">
              第 {row.payEpisode} 集
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-[72px] shrink-0 text-right text-[12px] text-[#9ca3af]">画风类型</span>
            <span className="inline-flex items-center rounded-[4px] border border-[#ddd6fe] bg-[#f5f3ff] px-2 py-0.5 text-[11.5px] font-medium text-[#7c3aed]">{row.artStyle}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-[72px] shrink-0 text-right text-[12px] text-[#9ca3af]">视觉效果</span>
            <span className="inline-flex items-center rounded-[4px] border border-[#bfdbfe] bg-[#eff6ff] px-2 py-0.5 text-[11.5px] font-medium text-[#2563eb]">{row.visualEffect}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-[72px] shrink-0 text-right text-[12px] text-[#9ca3af]">画面比例</span>
            <span className="flex-1 text-[13px] text-[#374151]">{row.aspectRatio}</span>
          </div>
        </div>
      </div>

      {/* 封面图 */}
      <div className="rounded-[6px] border border-[#e5e7eb] bg-white px-4 py-3">
        <p className="mb-2.5 text-[12px] font-medium text-[#374151]">封面图</p>
        {row.coverImg ? (
          <button
            className="inline-block cursor-pointer overflow-hidden rounded-[4px] border border-[#e5e7eb] hover:border-[#38c08f] transition-colors"
            onClick={() => setPreviewGallery({ images: [row.coverImg], index: 0 })}
          >
            <img src={row.coverImg} alt="封面图" className="h-[72px] w-[128px] object-cover" />
          </button>
        ) : (
          <p className="text-[12px] text-[#9ca3af]">暂无封面图</p>
        )}
      </div>

      {/* 版权证明材料 */}
      <div className="rounded-[6px] border border-[#e5e7eb] bg-white px-4 py-3">
        <p className="mb-2.5 text-[12px] font-medium text-[#374151]">
          版权证明材料
          <span className="ml-1.5 text-[11.5px] font-normal text-[#9ca3af]">({row.copyrightImages.length} 张)</span>
        </p>
        {row.copyrightImages.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {row.copyrightImages.map((src, i) => (
              <button
                key={i}
                className="overflow-hidden rounded-[4px] border border-[#e5e7eb] hover:border-[#38c08f] transition-colors"
                onClick={() => setPreviewGallery({ images: row.copyrightImages, index: i })}
              >
                <img src={src} alt={`版权材料${i + 1}`} className="h-[58px] w-[86px] object-cover" />
              </button>
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-[#9ca3af]">暂无版权证明材料</p>
        )}
      </div>

      {previewGallery && <ImageGalleryModal images={previewGallery.images} initialIndex={previewGallery.index} onClose={() => setPreviewGallery(null)} />}
    </div>
  )
}

// �����── 漫剧详情抽屉（三 tab：任务信息 / 有字幕视频 / 无字幕视频）���─��──────────────

const DETAIL_TABS = [
  { key: "info", label: "剧集信息" },
  { key: "sub_video", label: "有字幕视频" },
  { key: "raw_video", label: "无字幕视频" },
] as const
type DetailTab = typeof DETAIL_TABS[number]["key"]

function ComicDetailDrawer({
  row,
  onClose,
}: {
  row: ComicRow
  onClose: () => void
}) {
  const [activeTab, setActiveTab] = useState<DetailTab>("info")
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [detailRow, setDetailRow] = useState<ComicRow>(row)

  useEffect(() => {
    setDetailRow(row)
  }, [row])

  useEffect(() => {
    let cancelled = false
    comicApi
      .detail(row.id)
      .then((d) => {
        if (!cancelled) setDetailRow(mapApiComicToRow(d))
      })
      .catch((e) => {
        if (!cancelled) toast.error(e instanceof Error ? e.message : "加载详情失败")
      })
    return () => {
      cancelled = true
    }
  }, [row.id])

  useEffect(() => { setActiveTab("info") }, [row.comicId])

  useEffect(() => {
    function handler(e: KeyboardEvent) { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [onClose])

  return (
    <>
      <div className="fixed inset-0 z-[40] bg-black/30" onClick={onClose} />
      <div
        className="fixed right-0 top-0 z-[50] flex h-full w-[680px] max-w-[calc(100vw-60px)] flex-col bg-white"
        style={{ boxShadow: "-4px 0 32px rgba(0,0,0,0.14)" }}
      >
        {/* 头部 */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#e5e7eb] px-6 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="shrink-0 text-[15px] font-semibold text-[#111827]">漫剧详情</h2>
          </div>
          <button
            onClick={onClose}
            className="ml-4 flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] text-[#9ca3af] transition-colors hover:bg-[#f3f4f6] hover:text-[#374151]"
            aria-label="关闭"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab 栏 */}
        <div className="flex shrink-0 items-center gap-1 border-b border-[#e5e7eb] px-5">
          {DETAIL_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "relative whitespace-nowrap px-3 py-3 text-[13px] font-medium transition-colors",
                activeTab === tab.key ? "text-[#38c08f]" : "text-[#6b7280] hover:text-[#374151]"
              )}
            >
              {tab.label}
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full bg-[#38c08f]" />
              )}
            </button>
          ))}
        </div>

        {/* 内容区（内部滚动） */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto bg-[#f9fafb]">
          {activeTab === "info" && <TaskInfoPanel row={detailRow} />}
          {activeTab === "sub_video" && (
            <VideoListPanel
              episodes={detailRow.episodes}
              type="subtitled"
              scrollContainerRef={scrollContainerRef}
            />
          )}
          {activeTab === "raw_video" && (
            <VideoListPanel
              episodes={detailRow.episodes}
              type="raw"
              scrollContainerRef={scrollContainerRef}
            />
          )}
        </div>
      </div>
    </>
  )
}


// ─── 下载菜单 ─────────────────────────────────────────────────────────────────

const DOWNLOAD_ITEMS = [
  { key: "no-sub", label: "下载【无字幕】视频" },
  { key: "sub", label: "下载【有字幕】视频" },
  { key: "review", label: "下载提审材料" },
] as const

const DOWNLOAD_CONTENT_BY_KEY: Record<string, string> = {
  "no-sub": "无字幕视频",
  sub: "有字幕视频",
  review: "提审材料",
}

function DownloadMenu({ row }: { row: ComicRow }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  async function handleItem(key: string) {
    setOpen(false)
    const content = DOWNLOAD_CONTENT_BY_KEY[key]
    if (!content) return
    try {
      const res = await comicApi.download(row.id, content)
      const msg =
        res && typeof res === "object" && "message" in res
          ? String((res as { message: string }).message)
          : "下载任务已创建，请到下载中心查看"
      toast.success(msg)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "下载失败")
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-[4px] border border-[#38c08f] px-2.5 py-1 text-[12px] font-medium text-[#38c08f] hover:bg-[#f0fdf4] transition-colors whitespace-nowrap"
      >
        下载
        <ChevronDown size={10} className={cn("transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute right-0 top-[30px] z-50 w-[148px] rounded-[6px] border border-[#e5e7eb] bg-white py-1 shadow-lg">
          {DOWNLOAD_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => handleItem(item.key)}
              className="flex w-full items-center px-3 py-2 text-left text-[12.5px] text-[#374151] transition-colors hover:bg-[#f0fdf4] hover:text-[#38c08f] whitespace-nowrap"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── 发起修改 — 意见记录类型 ─────────────────────────────────────────────────

interface ChangeOpinionImage {
  id: string
  dataUrl: string
  name: string
}

interface ChangeOpinionRecord {
  id: string
  text: string
  images: ChangeOpinionImage[]
}

const CHANGE_IMAGE_LIMIT = 15

// ─── 发起修改 — 单条意见卡片 ──────────────────────────────────────────────────

function ChangeRecordCard({
  record,
  isEditing,
  onActivate,
  onChange,
  onDelete,
  onImagePreview,
}: {
  record: ChangeOpinionRecord
  isEditing: boolean
  onActivate: () => void
  onChange: (id: string, patch: Partial<ChangeOpinionRecord>) => void
  onDelete: (id: string) => void
  onImagePreview: (src: string, allImages?: string[]) => void
}) {
  const [imgLimitMsg, setImgLimitMsg] = useState("")

  function showLimitMsg() {
    setImgLimitMsg("单条记录最多支持15张图片")
    setTimeout(() => setImgLimitMsg(""), 3000)
  }

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items)
    const imageItems = items.filter(it => it.type.startsWith("image/"))
    if (imageItems.length === 0) return
    e.preventDefault()
    const currentCount = record.images.length
    if (currentCount >= CHANGE_IMAGE_LIMIT) { showLimitMsg(); return }
    const slots = CHANGE_IMAGE_LIMIT - currentCount
    const allowed = imageItems.slice(0, slots)
    if (imageItems.length > slots) showLimitMsg()
    allowed.forEach(item => {
      const file = item.getAsFile()
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string
        const newImg: ChangeOpinionImage = {
          id: `img-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          dataUrl,
          name: file.name || "粘贴图片.png",
        }
        onChange(record.id, { images: [...record.images, newImg] })
      }
      reader.readAsDataURL(file)
    })
  }, [record.id, record.images, onChange])

  function removeImage(imgId: string) {
    onChange(record.id, { images: record.images.filter(i => i.id !== imgId) })
  }

  const isEmpty = !record.text.trim() && record.images.length === 0

  return (
    <div
      onClick={!isEditing ? onActivate : undefined}
      onPaste={isEditing ? handlePaste : undefined}
      className={cn(
        "shrink-0 rounded-[8px] border bg-white transition-all",
        isEditing
          ? "border-[#38c08f] shadow-md ring-1 ring-[#38c08f]/20 cursor-default"
          : "border-[#e5e7eb] shadow-sm hover:border-[#a7f3d0] hover:shadow cursor-pointer overflow-hidden"
      )}
    >
      {isEditing ? (
        /* 编辑态 */
        <div className="flex flex-col">
          <div className="flex items-center justify-between border-b border-[#e5e7eb] bg-[#f0fdf4] px-3 py-2">
            <span className="text-[11.5px] font-medium text-[#38c08f]">编辑中</span>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(record.id) }}
              className="flex h-5 w-5 items-center justify-center rounded text-[#d1d5db] hover:bg-[#fff1f2] hover:text-[#ef4444] transition-colors"
              title="删除记录"
            >
              <Trash2 size={12} />
            </button>
          </div>
          <div className="px-3 pt-2.5">
            <textarea
              autoFocus
              value={record.text}
              onChange={(e) => onChange(record.id, { text: e.target.value })}
              placeholder="请输入修改意见内容，可在此处粘贴截图"
              rows={4}
              className="w-full resize-none rounded-[6px] border border-[#e5e7eb] bg-white px-3 py-2 text-[12.5px] text-[#374151] placeholder-[#bfbfbf] outline-none transition-colors focus:border-[#38c08f]"
            />
          </div>
          <div className="px-3 pb-3 pt-1.5">
            {imgLimitMsg && (
              <div className="mb-2 flex items-center gap-1.5 rounded-[5px] bg-[#fff7ed] px-2.5 py-1.5">
                <span className="text-[11.5px] font-medium text-[#ea580c]">{imgLimitMsg}</span>
              </div>
            )}
            {record.images.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {record.images.map(img => (
                  <div key={img.id} className="group relative h-14 w-14 shrink-0 overflow-hidden rounded-[5px] border border-[#e5e7eb] bg-[#f9fafb]">
                    <img src={img.dataUrl} alt={img.name} className="h-full w-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => { e.stopPropagation(); onImagePreview(img.dataUrl, record.images.map((m) => m.dataUrl)) }}
                        className="flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-[#374151] hover:bg-white" title="预览">
                        <ZoomIn size={10} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); removeImage(img.id) }}
                        className="flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-[#ef4444] hover:bg-white" title="删除">
                        <X size={10} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[10.5px] text-[#c0c0c0]">
              {record.images.length >= CHANGE_IMAGE_LIMIT
                ? "已达上限（15张），如需新增请先删除部分图片"
                : `可在此卡片内粘贴截图上传（已上传 ${record.images.length}/15）`}
            </p>
          </div>
        </div>
      ) : (
        /* 折叠态 */
        <div className="flex h-[56px] items-center gap-2.5 px-3">
          <div className="flex-1 min-w-0">
            {isEmpty ? (
              <p className="text-[12px] italic text-[#bfbfbf] leading-snug">（空白记录，点击编辑）</p>
            ) : (
              <p
                className="text-[12.5px] leading-snug text-[#374151]"
                style={{
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  wordBreak: "break-all",
                }}
              >
                {record.text.trim() || "（无文字内容）"}
              </p>
            )}
          </div>
          {record.images.length > 0 && (
            <div className="relative shrink-0 h-9 w-9 overflow-hidden rounded-[4px] border border-[#e5e7eb] bg-[#f9fafb]">
              <img src={record.images[0].dataUrl} alt={record.images[0].name} className="h-full w-full object-cover" />
              {record.images.length > 1 && (
                <div className="absolute inset-0 flex items-center justify-center rounded-[4px] bg-black/45">
                  <span className="text-[10px] font-semibold leading-none text-white">+{record.images.length - 1}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── 发起修改抽屉 ─────────────────────────────────────────────────────────────

function RequestChangeDrawer({ row, onClose }: { row: ComicRow; onClose: () => void }) {
  const [records, setRecords] = useState<ChangeOpinionRecord[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [opinionError, setOpinionError] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [previewGallery, setPreviewGallery] = useState<{ images: string[]; index: number } | null>(null)

  useEffect(() => {
    function handler(e: KeyboardEvent) { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [onClose])

  function handleAddRecord() {
    const newId = `r-${Date.now()}`
    setRecords(prev => [...prev, { id: newId, text: "", images: [] }])
    setEditingId(newId)
    setOpinionError(false)
  }

  function handleRecordChange(id: string, patch: Partial<ChangeOpinionRecord>) {
    setRecords(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))
    setOpinionError(false)
  }

  function handleRecordDelete(id: string) {
    setRecords(prev => prev.filter(r => r.id !== id))
    if (editingId === id) setEditingId(null)
  }

  async function handleSubmit() {
    const valid = records.some(r => r.text.trim() || r.images.length > 0)
    if (!valid) { setOpinionError(true); return }
    setOpinionError(false)
    try {
      await comicApi.revision(row.id, {
        opinions: records
          .filter((r) => r.text.trim() || r.images.length > 0)
          .map((r) => ({
            content: r.text.trim(),
            images: r.images.map((i) => i.dataUrl),
          })),
      })
      setSubmitted(true)
      setTimeout(() => onClose(), 1200)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "发起修改失败")
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-[40] bg-black/30" onClick={onClose} />
      <div
        className="fixed right-0 top-0 z-[50] flex h-full w-[480px] max-w-[calc(100vw-60px)] flex-col bg-white"
        style={{ boxShadow: "-4px 0 24px rgba(0,0,0,0.12)" }}
      >
        {/* 头部 */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#e5e7eb] px-6 py-4">
          <h2 className="text-[15px] font-semibold text-[#111827]">发起修改</h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-[4px] text-[#9ca3af] transition-colors hover:bg-[#f3f4f6] hover:text-[#374151]"
            aria-label="关闭"
          >
            <X size={16} />
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 min-h-0 overflow-hidden bg-[#f9fafb] px-5 py-5 flex flex-col gap-4">

          {/* 基础信息区（不变） */}
          <div className="shrink-0 rounded-[6px] border border-[#e5e7eb] bg-white">
            <div className="border-b border-[#f3f4f6] px-4 py-2.5">
              <span className="text-[11.5px] font-semibold uppercase tracking-wide text-[#9ca3af]">漫剧信息</span>
            </div>
            <div className="flex gap-4 px-4 py-4">
              <div className="flex flex-1 flex-col gap-3 min-w-0">
                <div className="flex items-start gap-2">
                  <span className="w-[60px] shrink-0 text-right text-[12px] text-[#9ca3af]">剧集名称</span>
                  <span className="flex-1 text-[13px] font-medium text-[#111827] leading-relaxed">{row.comicName}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-[60px] shrink-0 text-right text-[12px] text-[#9ca3af]">集数</span>
                  <span className="flex-1 text-[13px] text-[#374151]">{row.episodeCount} 集</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-[60px] shrink-0 text-right text-[12px] text-[#9ca3af]">画风类型</span>
                  <span className="inline-flex items-center rounded-[4px] border border-[#ddd6fe] bg-[#f5f3ff] px-2 py-0.5 text-[11.5px] font-medium text-[#7c3aed]">
                    {row.artStyle}
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-[60px] shrink-0 text-right text-[12px] text-[#9ca3af]">视觉效果</span>
                  <span className="inline-flex items-center rounded-[4px] border border-[#bfdbfe] bg-[#eff6ff] px-2 py-0.5 text-[11.5px] font-medium text-[#2563eb]">
                    {row.visualEffect}
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-[60px] shrink-0 text-right text-[12px] text-[#9ca3af]">画面比例</span>
                  <span className="flex-1 text-[13px] text-[#374151]">{row.aspectRatio}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-[60px] shrink-0 text-right text-[12px] text-[#9ca3af]">制作人</span>
                  <span className="flex-1 text-[13px] text-[#374151]">{row.producer}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-[60px] shrink-0 text-right text-[12px] text-[#9ca3af]">封面图</span>
                  <div className="flex-1 min-w-0">
                    {row.coverImg ? (
                      <button
                        type="button"
                        className="group relative inline-block overflow-hidden rounded-[4px] border border-[#e5e7eb] hover:border-[#38c08f] transition-colors"
                        onClick={() => setPreviewGallery({ images: [row.coverImg], index: 0 })}
                      >
                        <img src={row.coverImg} alt="封面图" className="h-[72px] w-[128px] object-cover transition-opacity group-hover:opacity-80" />
                        <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100 bg-black/20">
                          <ZoomIn size={14} className="text-white drop-shadow" />
                        </span>
                      </button>
                    ) : (
                      <span className="text-[12px] text-[#9ca3af]">暂无封面图</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 修改意见区（多条记录） */}
          <div className="flex flex-1 min-h-0 flex-col rounded-[6px] border border-[#e5e7eb] bg-white overflow-hidden">
            {/* 标题栏 */}
            <div className="flex shrink-0 items-center justify-between border-b border-[#f3f4f6] px-4 py-2.5">
              <div className="flex items-center gap-1">
                <span className="text-[13px] font-semibold text-[#374151]">修改意见</span>
                <span className="text-[#ef4444]">*</span>
              </div>
              <button
                onClick={handleAddRecord}
                className="flex items-center gap-1 rounded-[5px] border border-[#38c08f] px-2.5 py-1 text-[11.5px] font-medium text-[#38c08f] hover:bg-[#f0fdf4] transition-colors"
              >
                <Plus size={11} />
                新增记录
              </button>
            </div>

            {/* 记录列表（独立滚动，撑满剩余高度） */}
            <div
              className="flex-1 min-h-0 overflow-y-auto px-4 py-3 flex flex-col gap-2.5"
              onClick={(e) => { if (e.target === e.currentTarget) setEditingId(null) }}
            >
              {records.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <p className="text-[12.5px] text-[#9ca3af]">暂无修改意见</p>
                  <p className="mt-1 text-[11.5px] text-[#c0c0c0]">点击右上角【新增记录】添加第一条</p>
                </div>
              ) : (
                records.map(record => (
                  <ChangeRecordCard
                    key={record.id}
                    record={record}
                    isEditing={editingId === record.id}
                    onActivate={() => setEditingId(record.id)}
                    onChange={handleRecordChange}
                    onDelete={handleRecordDelete}
                    onImagePreview={(src, allImages) => setPreviewGallery({ images: allImages ?? [src], index: allImages ? allImages.indexOf(src) : 0 })}
                  />
                ))
              )}
            </div>

            {/* 校验错误提示 */}
            {opinionError && (
              <div className="shrink-0 border-t border-[#fee2e2] bg-[#fff5f5] px-4 py-2">
                <p className="text-[12px] text-[#ef4444]">请至少填写一条修改意见</p>
              </div>
            )}
          </div>

          {/* 提交成功提示 */}
          {submitted && (
            <div className="shrink-0 flex items-center gap-2 rounded-[6px] border border-[#6ee7b7] bg-[#ecfdf5] px-4 py-3">
              <span className="h-4 w-4 shrink-0 rounded-full bg-[#059669] flex items-center justify-center">
                <svg viewBox="0 0 10 8" width="10" height="8" fill="none">
                  <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="text-[13px] font-medium text-[#059669]">发起修改成功，即将关闭…</span>
            </div>
          )}
        </div>

        {/* 底部操作区（不变） */}
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#e5e7eb] bg-white px-6 py-4">
          <button
            onClick={onClose}
            className="h-[30px] rounded-[6px] border border-[#d1d5db] bg-white px-4 text-[13px] text-[#374151] transition-colors hover:bg-[#f5f6f7]"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitted}
            className={cn(
              "h-[30px] rounded-[6px] px-4 text-[13px] font-medium text-white transition-colors",
              submitted ? "bg-[#6ee7b7] cursor-not-allowed" : "bg-[#38c08f] hover:bg-[#2da87a]"
            )}
          >
            确认发起
          </button>
        </div>
      </div>

      {/* 图片画廊预览 */}
      {previewGallery && <ImageGalleryModal images={previewGallery.images} initialIndex={previewGallery.index} onClose={() => setPreviewGallery(null)} />}
    </>
  )
}

// ─── 封面图预览 ───────────────────────────────────────────────────────────────

function ImagePreview({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    function handler(e: KeyboardEvent) { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [onClose])
  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/70" onClick={onClose} />
      <div className="fixed inset-0 z-[61] flex items-center justify-center p-8 pointer-events-none">
        <div className="pointer-events-auto relative max-w-[480px] max-h-[640px]">
          <img src={src} alt={alt} className="max-w-full max-h-[600px] rounded-[8px] object-contain shadow-2xl" />
          <button
            onClick={onClose}
            className="absolute -right-3 -top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#374151] shadow-md hover:bg-[#f3f4f6]"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </>
  )
}

// ─── 编辑抽屉 ─────────────────────────────────────────────────────���──���────────

function EditDrawer({ row, onClose }: { row: ComicRow; onClose: () => void }) {
  useEffect(() => {
    function handler(e: KeyboardEvent) { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [onClose])

  const fields: { label: string; value: string; mono?: boolean }[] = [
    { label: "漫剧ID", value: row.comicId, mono: true },
    { label: "剧集名称", value: row.comicName },
    { label: "剧本ID", value: row.scriptId, mono: true },
    { label: "画风类型", value: row.artStyle },
    { label: "视觉效果", value: row.visualEffect },
    { label: "画面比例", value: row.aspectRatio },
    { label: "编剧", value: row.writer },
    { label: "制作员", value: row.producer },
    { label: "集数", value: `${row.episodeCount} 集` },
    { label: "付费卡点", value: `第 ${row.payEpisode} 集` },
    { label: "状态", value: row.status },
  ]

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 flex h-full w-[520px] flex-col bg-white" style={{ boxShadow: "-4px 0 24px rgba(0,0,0,0.12)" }}>
        <div className="flex items-center justify-between border-b border-[#e5e7eb] px-6 py-4">
          <h2 className="text-[15px] font-semibold text-[#111827]">编辑漫剧</h2>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-[4px] text-[#9ca3af] transition-colors hover:bg-[#f3f4f6] hover:text-[#374151]">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="mb-4 rounded-[8px] border border-[#e5e7eb] bg-[#f9fafb] px-4 py-4">
            <p className="mb-3 text-[11.5px] font-semibold uppercase tracking-wide text-[#9ca3af]">漫剧信息</p>
            <div className="flex flex-col gap-3">
              {fields.map(({ label, value, mono }) => (
                <div key={label} className="flex items-start gap-3">
                  <span className="w-[64px] shrink-0 text-right text-[12.5px] text-[#9ca3af]">{label}</span>
                  <span className={cn("flex-1 break-all text-[13px] text-[#111827] leading-relaxed", mono && "font-mono text-[12px] text-[#4b5563]")}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-center text-[12.5px] text-[#9ca3af]">编辑表单待接入后端接口</p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[#e5e7eb] px-6 py-4">
          <button onClick={onClose} className="h-[30px] rounded-[6px] border border-[#d1d5db] bg-white px-4 text-[13px] text-[#374151] transition-colors hover:bg-[#f5f6f7]">取消</button>
          <button onClick={onClose} className="h-[30px] rounded-[6px] bg-[#38c08f] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#2da87a]">保存</button>
        </div>
      </div>
    </>
  )
}



const PAGE_SIZE_OPTIONS: PageSizeOption[] = [10, 20, 50]

// ─── 日期范围选择器（与书籍管理保持一致）────────────────────────────────────

const WEEK_LABELS = ["日", "一", "二", "三", "四", "五", "六"]
const MONTHS_CN = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"]

function getDaysInMonth(year: number, month: number) { return new Date(year, month + 1, 0).getDate() }
function getFirstDayOfWeek(year: number, month: number) { return new Date(year, month, 1).getDay() }
function padDate(n: number) { return String(n).padStart(2, "0") }
function toDateStr(year: number, month: number, day: number) { return `${year}-${padDate(month + 1)}-${padDate(day)}` }

interface MonthPanelProps {
  year: number; month: number; hoverDate: string; startDate: string; endDate: string
  onDayClick: (d: string) => void; onDayHover: (d: string) => void
}

function MonthPanel({ year, month, hoverDate, startDate, endDate, onDayClick, onDayHover }: MonthPanelProps) {
  const days = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfWeek(year, month)
  const cells: (number | null)[] = Array(firstDay).fill(null).concat(Array.from({ length: days }, (_, i) => i + 1))
  while (cells.length % 7 !== 0) cells.push(null)
  return (
    <div className="w-[216px]">
      <div className="mb-2 flex items-center justify-center">
        <span className="text-[13px] font-medium text-[#111827]">{year}年 {MONTHS_CN[month]}</span>
      </div>
      <div className="grid grid-cols-7">
        {WEEK_LABELS.map((w) => (
          <div key={w} className="flex h-7 items-center justify-center text-[11px] text-[#9ca3af]">{w}</div>
        ))}
        {cells.map((day, idx) => {
          if (!day) return <div key={idx} className="h-7" />
          const d = toDateStr(year, month, day)
          const isStart = d === startDate
          const isEnd = d === endDate
          const rangeEnd = endDate || (startDate && hoverDate > startDate ? hoverDate : "")
          const inRange = !!(startDate && rangeEnd && d > startDate && d < rangeEnd && !isStart && !isEnd)
          return (
            <div key={idx}
              className={cn("flex h-7 cursor-pointer items-center justify-center text-[12.5px] rounded-[3px] transition-colors",
                isStart || isEnd ? "bg-[#38c08f] text-white font-semibold"
                  : inRange ? "bg-[#d1f5e9] text-[#059669]"
                    : "text-[#374151] hover:bg-[#f0fdf4] hover:text-[#38c08f]")}
              onClick={() => onDayClick(d)}
              onMouseEnter={() => onDayHover(d)}
            >{day}</div>
          )
        })}
      </div>
    </div>
  )
}

function DateRangePicker({ value = [], onChange }: { value?: [string, string] | []; onChange: (v: [string, string] | []) => void }) {
  const today = new Date()
  const [open, setOpen] = useState(false)
  const [leftYear, setLeftYear] = useState(today.getFullYear())
  const [leftMonth, setLeftMonth] = useState(today.getMonth() === 0 ? 0 : today.getMonth() - 1)
  const [hoverDate, setHoverDate] = useState("")
  const ref = useRef<HTMLDivElement>(null)
  const rightYear = leftMonth === 11 ? leftYear + 1 : leftYear
  const rightMonth = leftMonth === 11 ? 0 : leftMonth + 1
  const safeValue: string[] = Array.isArray(value) ? value : []
  const startDate = safeValue[0] ?? ""
  const endDate = safeValue[1] ?? ""
  useEffect(() => {
    function handler(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])
  function handleDayClick(d: string) {
    if (!startDate || (startDate && endDate)) { onChange([d, ""] as unknown as [string, string]) }
    else { onChange(d < startDate ? [d, startDate] : [startDate, d]); setOpen(false) }
  }
  function prevMonth() { if (leftMonth === 0) { setLeftYear(y => y - 1); setLeftMonth(11) } else setLeftMonth(m => m - 1) }
  function nextMonth() { if (leftMonth === 11) { setLeftYear(y => y + 1); setLeftMonth(0) } else setLeftMonth(m => m + 1) }
  const displayText = startDate && endDate ? `${startDate} 至 ${endDate}` : startDate ? `${startDate} 至 ...` : ""
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className={cn("flex h-[30px] w-[236px] items-center gap-2 rounded-[6px] border border-[#d1d5db] bg-white px-3 text-[13px] transition-colors",
          open ? "border-[#38c08f]" : "hover:border-[#38c08f]",
          displayText ? "text-[#374151]" : "text-[#9ca3af]")}>
        <Calendar size={13} className="shrink-0 text-[#9ca3af]" />
        <span className="flex-1 truncate text-left">{displayText || "请选择日期范围"}</span>
        {displayText ? (
          <X size={12} className="shrink-0 text-[#9ca3af] hover:text-[#374151]"
            onClick={(e) => { e.stopPropagation(); onChange([]); setOpen(false) }} />
        ) : <ChevronDown size={12} className="shrink-0 text-[#9ca3af]" />}
      </button>
      {open && (
        <div className="absolute left-0 top-[36px] z-50 flex gap-4 rounded-[8px] border border-[#e5e7eb] bg-white px-5 py-4 shadow-lg">
          <div className="flex flex-col">
            <div className="mb-2 flex items-center justify-between">
              <button onClick={prevMonth} className="flex h-6 w-6 items-center justify-center rounded hover:bg-[#f3f4f6] text-[#6b7280]"><ChevronLeft size={14} /></button>
              <span />
            </div>
            <MonthPanel year={leftYear} month={leftMonth} hoverDate={hoverDate} startDate={startDate} endDate={endDate} onDayClick={handleDayClick} onDayHover={setHoverDate} />
          </div>
          <div className="w-px bg-[#f3f4f6]" />
          <div className="flex flex-col">
            <div className="mb-2 flex items-center justify-end">
              <span />
              <button onClick={nextMonth} className="flex h-6 w-6 items-center justify-center rounded hover:bg-[#f3f4f6] text-[#6b7280]"><ChevronRight size={14} /></button>
            </div>
            <MonthPanel year={rightYear} month={rightMonth} hoverDate={hoverDate} startDate={startDate} endDate={endDate} onDayClick={handleDayClick} onDayHover={setHoverDate} />
          </div>
        </div>
      )}
    </div>
  )
}

const comicMock: ComicRow[] = []

export default function ComicManagement() {
  // 筛������单（草稿态）
  const canDetail = usePerm("resource.comic.detail")
  const canDownload = usePerm("resource.comic.download")
  const canRevise = usePerm("resource.comic.revise")

  const [draftFilters, setDraftFilters] = useState<FilterForm>(defaultFilters)
  // 已提交筛选态（点击查询后同步）
  const [activeFilters, setActiveFilters] = useState<FilterForm>(defaultFilters)

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState<PageSizeOption>(10)
  const [detailRow, setDetailRow] = useState<ComicRow | null>(null)
  const [changeRow, setChangeRow] = useState<ComicRow | null>(null)
  const [previewImg, setPreviewImg] = useState<{ src: string; alt: string } | null>(null)

  const [data, setData] = useState<ComicRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const fetchComics = useCallback(() => {
    return comicApi.list(buildComicListParams(activeFilters, currentPage, pageSize))
  }, [activeFilters, currentPage, pageSize])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchComics()
      .then((res) => {
        if (!cancelled) {
          const list = (res.list ?? []).map(mapApiComicToRow)
          setData(list)
          setTotal(Number(res.total) || 0)
        }
      })
      .catch(() => {
        setData([])
          setTotal(0)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [fetchComics])

  function handleQuery() {
    setActiveFilters({ ...draftFilters })
    setCurrentPage(1)
  }

  function handleReset() {
    setDraftFilters(defaultFilters)
    setActiveFilters(defaultFilters)
    setCurrentPage(1)
  }

  function updateDraft<K extends keyof FilterForm>(key: K, value: FilterForm[K]) {
    setDraftFilters((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <>
      <div className="flex flex-col gap-0 rounded-lg border border-[#e5e7eb] bg-white flex-1 min-h-0">

        {/* ── 筛选区 ── */}
        <div className="border-b border-[#e5e7eb] px-5 py-4">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <FilterInput label="漫剧ID" placeholder="请输入漫剧ID" value={draftFilters.comicId} onChange={(v) => updateDraft("comicId", v)} width="w-[160px]" />
            <FilterInput label="剧集名称" placeholder="请输入剧集名称" value={draftFilters.comicName} onChange={(v) => updateDraft("comicName", v)} width="w-[148px]" />
            <FilterInput label="剧本ID" placeholder="请输入剧本ID" value={draftFilters.scriptId} onChange={(v) => updateDraft("scriptId", v)} width="w-[160px]" />
            <SelectFilter label="画风类型" value={draftFilters.artStyle} onChange={(v) => updateDraft("artStyle", v)} options={artStyleOptions} width="w-[110px]" />
            <SelectFilter label="视觉效果" value={draftFilters.visualEffect} onChange={(v) => updateDraft("visualEffect", v)} options={visualEffectOptions} width="w-[90px]" />
            <SelectFilter label="画面比例" value={draftFilters.aspectRatio} onChange={(v) => updateDraft("aspectRatio", v)} options={aspectRatioOptions} width="w-[110px]" />
            <FilterInput label="编剧" placeholder="请输入编剧" value={draftFilters.writer} onChange={(v) => updateDraft("writer", v)} width="w-[120px]" />
            <FilterInput label="制作员" placeholder="请输入制作员" value={draftFilters.producer} onChange={(v) => updateDraft("producer", v)} width="w-[120px]" />
            <div className="flex items-center gap-1.5">
              <span className="shrink-0 text-[12.5px] text-[#374151]">创建时间</span>
              <DateRangePicker
                value={draftFilters.createdAtRange}
                onChange={(v) => updateDraft("createdAtRange", v)}
              />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={handleQuery} className="flex h-[30px] items-center gap-1.5 rounded-[6px] bg-[#38c08f] px-4 text-[13px] font-medium text-white hover:bg-[#2da87a] transition-colors">
                <Search size={13} />查询
              </button>
              <button onClick={handleReset} className="flex h-[30px] items-center gap-1.5 rounded-[6px] border border-[#d1d5db] bg-white px-4 text-[13px] text-[#374151] hover:bg-[#f5f6f7] transition-colors">
                <RotateCcw size={12} />重置
              </button>
            </div>
          </div>
        </div>

        {/* ── 列表区 ── */}
        <div className="flex flex-col flex-1 min-h-0">

          {/* 表格 */}
          <div className="flex-1 overflow-auto min-h-0">
            <table className="w-full min-w-[1560px] border-collapse text-[13px]">
              <thead>
                <tr className="bg-[#f9fafb]">
                  {[
                    { label: "漫剧ID", w: "w-[160px]" },
                    { label: "剧集名称", w: "w-[200px]" },
                    { label: "封面图", w: "w-[80px]" },
                    { label: "集数", w: "w-[60px]" },
                    { label: "付费卡点", w: "w-[80px]" },
                    { label: "剧本ID", w: "w-[160px]" },
                    { label: "画风类型", w: "w-[90px]" },
                    { label: "视觉效果", w: "w-[70px]" },
                    { label: "画面比例", w: "w-[100px]" },
                    { label: "编剧", w: "w-[72px]" },
                    { label: "制作员", w: "w-[72px]" },
                    { label: "创建时间", w: "w-[160px]" },
                    { label: "操作", w: "w-[160px]" },
                  ].map(({ label, w }) => (
                    <th
                      key={label}
                      className={cn(
                        "sticky top-0 z-10 border-b border-[#e5e7eb] bg-[#f9fafb] px-4 py-3 text-left text-[12.5px] font-medium text-[#6b7280] whitespace-nowrap",
                        w
                      )}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="px-4 py-12 text-center text-[13px] text-[#9ca3af]">
                      {loading ? "加载中…" : "暂无数据"}
                    </td>
                  </tr>
                ) : (
                  data.map((row, i) => (
                    <tr
                      key={row.id}
                      className={cn(
                        "transition-colors hover:bg-[#f9fafb]",
                        i < data.length - 1 && "border-b border-[#f3f4f6]"
                      )}
                    >
                      {/* 漫剧ID */}
                      <td className="px-4 py-3 font-mono text-[12px] text-[#4b5563] whitespace-nowrap">
                        {row.comicId}
                      </td>
                      {/* 剧集名称 — 蓝色可点击（需详情权限） */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {canDetail ? (
                          <button
                            onClick={() => setDetailRow(row)}
                            className="font-medium text-[13px] text-[#2563eb] transition-colors hover:text-[#1d4ed8] hover:underline"
                          >
                            {row.comicName}
                          </button>
                        ) : (
                          <span className="font-medium text-[13px] text-[#111827]">{row.comicName}</span>
                        )}
                      </td>
                      {/* 封面图 */}
                      <td className="px-4 py-2 whitespace-nowrap">
                        {row.coverImg ? (
                          <button
                            onClick={() => setPreviewImg({ src: row.coverImg, alt: row.comicName })}
                            className="group relative inline-block overflow-hidden rounded-[4px] border border-[#e5e7eb] bg-[#f3f4f6]"
                            style={{ width: 40, height: 54 }}
                          >
                            <img
                              src={row.coverImg}
                              alt={row.comicName}
                              className="h-full w-full object-cover transition-opacity group-hover:opacity-80"
                            />
                            <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                              <ZoomIn size={14} className="text-white drop-shadow" />
                            </span>
                          </button>
                        ) : (
                          <div className="flex items-center justify-center rounded-[4px] border border-[#e5e7eb] bg-[#f3f4f6] text-[10px] text-[#9ca3af]" style={{ width: 40, height: 54 }}>
                            暂无
                          </div>
                        )}
                      </td>
                      {/* 集数 */}
                      <td className="px-4 py-3 text-[#374151] whitespace-nowrap">
                        {row.episodeCount} 集
                      </td>
                      {/* 付费卡点 */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center rounded-[4px] border border-[#fde68a] bg-[#fffbeb] px-2 py-0.5 text-[11.5px] font-medium text-[#92400e]">
                          第 {row.payEpisode} 集
                        </span>
                      </td>
                      {/* 剧本ID */}
                      <td className="px-4 py-3 font-mono text-[12px] text-[#4b5563] whitespace-nowrap">
                        {row.scriptId}
                      </td>
                      {/* 画风类型 */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center rounded-[4px] border border-[#bfdbfe] bg-[#eff6ff] px-2 py-0.5 text-[11.5px] font-medium text-[#2563eb]">
                          {row.artStyle}
                        </span>
                      </td>
                      {/* 视觉效果 */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center rounded-[4px] border border-[#6ee7b7] bg-[#ecfdf5] px-2 py-0.5 text-[11.5px] font-medium text-[#059669]">
                          {row.visualEffect}
                        </span>
                      </td>
                      {/* 画面比例 */}
                      <td className="px-4 py-3 text-[12.5px] text-[#374151] whitespace-nowrap">
                        {row.aspectRatio}
                      </td>
                      {/* 编剧 */}
                      <td className="px-4 py-3 text-[#374151] whitespace-nowrap">
                        {row.writer}
                      </td>
                      {/* 制作员 */}
                      <td className="px-4 py-3 text-[#374151] whitespace-nowrap">
                        {row.producer}
                      </td>
                      {/* 创建时间 */}
                      <td className="px-4 py-3 text-[#374151] whitespace-nowrap tabular-nums">
                        {row.createdAt}
                      </td>
                      {/* 操作列 */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {/* 下载（带菜单）*/}
                          {canDownload && <DownloadMenu row={row} />}
                          {/* 发起修改 */}
                          {canRevise && (
                            <button
                              onClick={() => setChangeRow(row)}
                              className="flex items-center gap-1 rounded-[4px] border border-[#38c08f] px-2.5 py-1 text-[12px] font-medium text-[#38c08f] hover:bg-[#f0fdf4] transition-colors whitespace-nowrap"
                            >
                              发起修改
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 分页 */}
          <div className="shrink-0">
            <ListPagination
              total={total}
              currentPage={currentPage}
              pageSize={pageSize}
              onPageChange={(p) => setCurrentPage(p)}
              onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1) }}
            />
          </div>
        </div>
      </div>

      {/* ── 剧集详情抽屉 ── */}
      {detailRow && (
        <ComicDetailDrawer row={detailRow} onClose={() => setDetailRow(null)} />
      )}

      {/* ��─ 发起修改抽屉 ── */}
      {changeRow && (
        <RequestChangeDrawer row={changeRow} onClose={() => setChangeRow(null)} />
      )}

      {/* ── 封面图预览 ── */}
      {previewImg && (
        <ImagePreview src={previewImg.src} alt={previewImg.alt} onClose={() => setPreviewImg(null)} />
      )}

    </>
  )
}
