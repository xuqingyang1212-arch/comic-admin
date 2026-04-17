"use client"
// draft-review v2

import { useState, useMemo, useRef, useEffect, useCallback } from "react"
import { Search, RotateCcw, ChevronDown, X, FileText, Play, Plus, Trash2, ZoomIn } from "lucide-react"
import { cn } from "@/lib/utils"
import { comicReviewApi, assetUrl } from "@/lib/api"
import { toast } from "@/lib/toast"
import { InlineVideoPlayer } from "@/components/video-thumbnail"
import { ListPagination, type PageSizeOption } from "@/components/list-pagination"
import { usePerm } from "@/components/admin-layout"
import {
  EditorNode,
  calcTotalWords,
  calcEpisodeIndex,
  calcSegmentWords,
} from "@/components/book-management"

// ─── 类型定义 ──────────────────────────────────────────────────────────────────

type TaskType = "初版审核" | "终版审核" | "修改版审核"
type ReviewStatus = "审核中" | "驳回修改" | "审核通过" | "已取消"

type ReviewRecordStatus = "提交审核" | "驳回修改" | "审核通过" | "审核取消" | "发起成片修改"
type ReviewStageType = "初版" | "终版" | "修改版"

interface AuditOpinionImage {
  id: string
  dataUrl: string
  name: string
}

interface AuditOpinionRecord {
  id: string
  title: string
  text: string
  images: AuditOpinionImage[]
  createdAt: string
  updatedAt: string
}

interface DraftAuditRecord {
  id: number
  status: ReviewRecordStatus
  time: string
  operator: string
  remark?: string
  stageType: ReviewStageType
  opinionRecords?: AuditOpinionRecord[]
}

interface DeliveryFileInfo {
  fileUrl: string
  fileName: string
  fileSize: number
  fileType: string
  episodeNum: number
}

interface DraftReviewRow {
  id: string
  scriptName: string
  scriptId: string
  episodeCount: number
  producer: string
  taskType: TaskType
  reviewStatus: ReviewStatus
  submitTime: string
  reviewer: string
  remark: string
  // 任务信息扩展字段
  artStyle: string
  visualEffect: string
  aspectRatio: string
  productionRemark: string
  episodeName: string
  coverImage: string
  copyrightImages: string[]
  // 审核记录
  auditRecords?: DraftAuditRecord[]
  /** 详情/审核接口返回的待编辑意见（列表行无此字段） */
  initialOpinionRecords?: AuditOpinionRecord[]
  // 剧本内容（从 Script 获取）
  scriptContent?: string
  scriptPayBreakpointData?: string
  scriptPayEpisode?: string
  // 交付文件
  draftVideoUrl?: string
  deliveryFiles?: DeliveryFileInfo[]
}

// ─── 下拉筛选项 ────────────────────────────────────────────────────────────────

const taskTypeOptions = [
  { label: "初版审核", value: "初版审核" },
  { label: "终版审核", value: "终版审核" },
  { label: "修改版审核", value: "修改版审核" },
]

const reviewStatusOptions = [
  { label: "审核中", value: "审核中" },
  { label: "驳回修改", value: "驳回修改" },
  { label: "审核通过", value: "审核通过" },
  { label: "已取消", value: "已取消" },
]

const defaultFilters = {
  scriptName: "",
  scriptId: "",
  producer: "",
  taskType: "",
  reviewStatus: "审核中",
}

const emptyFilters = {
  scriptName: "",
  scriptId: "",
  producer: "",
  taskType: "",
  reviewStatus: "",
}

// ─── 状态色块 ──────────────────────────────────────────────────────────────────

const reviewStatusStyle: Record<string, { bg: string; text: string }> = {
  "审核中": { bg: "bg-[#fff7ed]", text: "text-[#ea580c]" },
  "驳回修改": { bg: "bg-[#fffbeb]", text: "text-[#d97706]" },
  "审核通过": { bg: "bg-[#ecfdf5]", text: "text-[#059669]" },
  "已取消": { bg: "bg-[#f3f4f6]", text: "text-[#6b7280]" },
}

const taskTypeStyle: Record<string, { bg: string; text: string }> = {
  "初版审核": { bg: "bg-[#eff6ff]", text: "text-[#2563eb]" },
  "终版审核": { bg: "bg-[#f5f3ff]", text: "text-[#7c3aed]" },
  "修改版审核": { bg: "bg-[#fff0f6]", text: "text-[#db2777]" },
}

// ─── Toast (removed, using global toast) ──────────────────────────────────────

// ─── 下拉单选组件 ────────────────────────────────────────────────────────────

function SelectFilter({
  value,
  onChange,
  options,
  placeholder,
  width = 148,
}: {
  value: string
  onChange: (v: string) => void
  options: { label: string; value: string }[]
  placeholder: string
  width?: number
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value)

  return (
    <div
      className="relative"
      onBlur={() => setTimeout(() => setOpen(false), 150)}
      tabIndex={0}
    >
      <button
        type="button"
        onMouseDown={() => setOpen((o) => !o)}
        style={{ width }}
        className="flex h-[30px] w-full items-center justify-between rounded-[6px] border border-[#d1d5db] bg-white px-3 text-[13px] outline-none hover:border-[#38c08f] focus:border-[#38c08f] transition-colors"
      >
        <span className={selected ? "text-[#374151]" : "text-[#9ca3af]"}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={12} className="shrink-0 text-[#9ca3af]" />
      </button>
      {open && (
        <div
          style={{ minWidth: width }}
          className="absolute left-0 top-full z-30 mt-1 rounded-[6px] border border-[#e5e7eb] bg-white py-1 shadow-lg"
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              className={cn(
                "flex w-full px-3 py-1.5 text-left text-[13px] hover:bg-[#f9fafb] transition-colors",
                value === opt.value ? "text-[#38c08f] font-medium" : "text-[#374151]"
              )}
              onMouseDown={() => { onChange(opt.value); setOpen(false) }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── InfoRow ───────────────────────────────────────────────────────────────────

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-[70px] shrink-0 text-right text-[12.5px] text-[#9ca3af]">{label}</span>
      <span className={cn("flex-1 text-[13px] text-[#111827] leading-relaxed break-all", mono && "font-mono text-[12px]")}>
        {value}
      </span>
    </div>
  )
}

// ─── 可折叠视频条目 ────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes <= 0) return "—"
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function useVideoThumbnail(url: string): string | null {
  const [thumb, setThumb] = useState<string | null>(null)
  useEffect(() => {
    if (!url) return
    const video = document.createElement("video")
    video.crossOrigin = "anonymous"
    video.preload = "metadata"
    video.src = url
    video.currentTime = 0.5
    let revoked = false
    video.onloadeddata = () => {
      if (revoked) return
      const canvas = document.createElement("canvas")
      canvas.width = 160
      canvas.height = 90
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        setThumb(canvas.toDataURL("image/jpeg", 0.7))
      }
    }
    return () => { revoked = true }
  }, [url])
  return thumb
}

function RealVideoEpisodeItem({
  file, onPlay,
}: {
  file: DeliveryFileInfo
  onPlay: () => void
}) {
  const thumb = useVideoThumbnail(file.fileUrl)
  return (
    <button
      className="flex w-full items-center gap-3 rounded-[6px] border border-[#e5e7eb] bg-white px-4 py-3 hover:bg-[#f9fafb] transition-colors text-left"
      onClick={onPlay}
    >
      <div className="relative h-[42px] w-[74px] shrink-0 overflow-hidden rounded-[4px] bg-[#1f2937]">
        {thumb ? (
          <img src={thumb} alt={`第${file.episodeNum}集`} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <svg viewBox="0 0 24 24" fill="white" className="h-4 w-4 opacity-30"><path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/></svg>
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-black/50">
            <Play size={10} className="text-white translate-x-0.5" fill="white" />
          </div>
        </div>
      </div>
      <div className="flex flex-1 items-center gap-4 min-w-0">
        <span className="text-[13px] font-medium text-[#111827]">第{file.episodeNum}集</span>
        {file.fileName && <span className="text-[12px] text-[#6b7280] truncate max-w-[160px]">{file.fileName}</span>}
        {file.fileSize > 0 && <span className="text-[12px] text-[#6b7280]">{formatFileSize(file.fileSize)}</span>}
      </div>
      <Play size={14} className="shrink-0 text-[#38c08f]" />
    </button>
  )
}

// ─── 图片预览 Modal ──────────────────────────────────────────────────────────

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
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
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

// ─── 任务信息面板（初版：6字段；终版/修改版：9字段+封面图+版权材料）──────────

function TaskInfoPanel({
  row,
  readOnly = false,
  episodeName: episodeNameControlled,
  onEpisodeNameChange,
}: {
  row: DraftReviewRow
  readOnly?: boolean
  episodeName?: string
  onEpisodeNameChange?: (v: string) => void
}) {
  const [episodeName, setEpisodeName] = useState(row.episodeName)
  const [previewGallery, setPreviewGallery] = useState<{ images: string[]; index: number } | null>(null)

  useEffect(() => {
    setEpisodeName(row.episodeName)
  }, [row.id, row.episodeName])

  const epDisplay = episodeNameControlled !== undefined ? episodeNameControlled : episodeName
  const setEpDisplay = (v: string) => {
    onEpisodeNameChange?.(v)
    if (episodeNameControlled === undefined) setEpisodeName(v)
  }
  const isDraft = row.taskType === "初版审核"
  const isRevision = row.taskType === "修改版审核"

  const readonlyFields = [
    { label: "任务名称", value: row.scriptName },
    { label: "集数", value: `${row.episodeCount} 集` },
    { label: "画风类型", value: row.artStyle, badge: "art" },
    { label: "视觉效果", value: row.visualEffect, badge: "visual" },
    { label: "画面比例", value: row.aspectRatio },
    { label: "任务类型", value: row.taskType, badge: "taskType" },
    { label: isRevision ? "修改意见" : "制作备注", value: isRevision ? "" : (row.productionRemark || "—") },
  ]

  // 修改版审核：从 auditRecords 提取"发起成片修改"和"驳回修改"节点的 opinionRecords
  const modifyOpinionRecords: (AuditOpinionRecord & { recordId: string })[] = []
  if (isRevision && row.auditRecords) {
    row.auditRecords.forEach((rec) => {
      if ((rec.status === "驳回修改" || rec.status === "发起成片修改") && rec.opinionRecords) {
        rec.opinionRecords.forEach((op) => {
          if (op.text.trim() || op.images.length > 0) {
            modifyOpinionRecords.push({ ...op, recordId: `${rec.id}-${op.id}` })
          }
        })
      } else if ((rec.status === "驳回修改" || rec.status === "发起成片修改") && rec.remark) {
        modifyOpinionRecords.push({ id: `r-${rec.id}`, text: rec.remark, images: [], recordId: `r-${rec.id}` } as any)
      }
    })
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      {/* 只读基础字段 */}
      <div className="rounded-[6px] border border-[#e5e7eb] bg-white">
        <div className="border-b border-[#f3f4f6] px-4 py-2.5">
          <span className="text-[11.5px] font-semibold uppercase tracking-wide text-[#9ca3af]">基本信息</span>
        </div>
        <div className="flex flex-col gap-3 px-4 py-3">
          {readonlyFields.map(({ label, value, badge }) => (
            <div key={label} className="flex items-start gap-2">
              <span className="w-[72px] shrink-0 text-right text-[12px] text-[#9ca3af]">{label}</span>
              <span className={cn("flex-1 text-[13px] text-[#374151] leading-relaxed", label === "制作备注" && "whitespace-pre-wrap")}>
                {label === "修改意见" ? (
                  modifyOpinionRecords.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {modifyOpinionRecords.map((op) => (
                        <div key={(op as any).recordId} className="rounded-[5px] border border-[#fef08a] bg-[#fffbeb] px-3 py-2.5">
                          {op.text.trim() && (
                            <p className="text-[12px] leading-relaxed text-[#78350f] whitespace-pre-wrap">{op.text}</p>
                          )}
                          {op.images.length > 0 && (
                            <div className={cn("flex flex-wrap gap-1.5", op.text.trim() ? "mt-2" : "")}>
                              {op.images.map((img, imgIdx) => (
                                <div key={img.id} className="group relative h-14 w-14 shrink-0 cursor-pointer overflow-hidden rounded-[4px] border border-[#fde68a] bg-white"
                                  onClick={() => setPreviewGallery({ images: op.images.map((m) => m.dataUrl), index: imgIdx })}>
                                  <img src={img.dataUrl} alt={img.name} className="h-full w-full object-cover" />
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <ZoomIn size={12} className="text-white" />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[#d1d5db]">--</span>
                  )
                ) : badge === "art" ? (
                  <span className="inline-flex items-center rounded-[4px] border border-[#ddd6fe] bg-[#f5f3ff] px-2 py-0.5 text-[11.5px] font-medium text-[#7c3aed]">{value}</span>
                ) : badge === "visual" ? (
                  <span className="inline-flex items-center rounded-[4px] border border-[#bfdbfe] bg-[#eff6ff] px-2 py-0.5 text-[11.5px] font-medium text-[#2563eb]">{value}</span>
                ) : badge === "taskType" ? (
                  <span className={cn("inline-flex items-center rounded-[4px] px-2 py-0.5 text-[11.5px] font-medium", taskTypeStyle[row.taskType]?.bg, taskTypeStyle[row.taskType]?.text)}>{value}</span>
                ) : (
                  value
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 终版/修改版额外字段 */}
      {!isDraft && (
        <>
          {/* 剧集名称（可编辑 / 只读） */}
          <div className="rounded-[6px] border border-[#e5e7eb] bg-white px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[12px] font-medium text-[#374151]">剧集名称</span>
              {!readOnly && <span className="rounded-[3px] bg-[#fef2f2] px-1.5 py-0.5 text-[10.5px] font-medium text-[#dc2626]">必填</span>}
            </div>
            {readOnly ? (
              <p className="text-[13px] text-[#374151] leading-relaxed">{epDisplay || "—"}</p>
            ) : (
              <input
                type="text"
                value={epDisplay}
                onChange={(e) => setEpDisplay(e.target.value)}
                placeholder="请输入剧集名称"
                className="w-full rounded-[6px] border border-[#d1d5db] bg-white px-3 py-2 text-[13px] text-[#111827] outline-none placeholder:text-[#9ca3af] focus:border-[#38c08f] transition-colors hover:border-[#9ca3af]"
              />
            )}
          </div>

          {/* 封面图 */}
          <div className="rounded-[6px] border border-[#e5e7eb] bg-white px-4 py-3">
            <p className="mb-2.5 text-[12px] font-medium text-[#374151]">封面图</p>
            {row.coverImage ? (
              <div
                className="inline-block cursor-pointer overflow-hidden rounded-[4px] border border-[#e5e7eb] hover:border-[#38c08f] transition-colors"
                onClick={() => setPreviewGallery({ images: [row.coverImage], index: 0 })}
              >
                <img src={row.coverImage} alt="封面图" className="h-[72px] w-[128px] object-cover" />
              </div>
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
            <div className="flex flex-wrap gap-2">
              {row.copyrightImages.map((src, i) => (
                <div
                  key={i}
                  className="cursor-pointer overflow-hidden rounded-[4px] border border-[#e5e7eb] hover:border-[#38c08f] transition-colors"
                  onClick={() => setPreviewGallery({ images: row.copyrightImages, index: i })}
                >
                  <img src={src} alt={`版权材料${i + 1}`} className="h-[58px] w-[86px] object-cover" />
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* 图片预览 Modal */}
      {previewGallery && <ImageGalleryModal images={previewGallery.images} initialIndex={previewGallery.index} onClose={() => setPreviewGallery(null)} />}
    </div>
  )
}

// ─── 视频列表面板 ──────────────────────────────────────────────────────────────

function VideoListPanel({ row, type, onEpisodePlay }: {
  row: DraftReviewRow
  type: "subtitled" | "raw"
  onEpisodePlay?: (episodeNum: number) => void
}) {
  const fileType = type === "subtitled" ? "有字幕视频" : "无字幕视频"
  const realFiles = useMemo(
    () => (row.deliveryFiles ?? []).filter((f) => f.fileType === fileType).sort((a, b) => a.episodeNum - b.episodeNum),
    [row.deliveryFiles, fileType],
  )
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const [shouldAutoPlay, setShouldAutoPlay] = useState(false)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])

  function goToEpisode(idx: number, autoPlay = false) {
    setShouldAutoPlay(autoPlay)
    setExpandedIdx(idx)
    requestAnimationFrame(() => {
      itemRefs.current[idx]?.scrollIntoView({ behavior: "smooth", block: "center" })
    })
    const epNum = realFiles[idx]?.episodeNum
    if (epNum != null) onEpisodePlay?.(epNum)
  }

  function handleVideoEnded(currentIdx: number) {
    const nextIdx = currentIdx + 1
    if (nextIdx < realFiles.length) {
      goToEpisode(nextIdx, true)
    }
  }

  if (realFiles.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center">
        <span className="text-[13px] text-[#9ca3af]">暂无{type === "subtitled" ? "有字幕" : "无字幕"}视频</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 px-4 py-4">
      {realFiles.map((f, i) => (
        <div key={`${type}-${f.episodeNum}-${i}`} ref={(el) => { itemRefs.current[i] = el }}>
          {expandedIdx === i ? (
            <div className="flex flex-col gap-1.5 rounded-[6px] border border-[#e5e7eb] overflow-hidden">
              <InlineVideoPlayer
                src={f.fileUrl}
                autoPlay={shouldAutoPlay}
                onEnded={() => handleVideoEnded(i)}
              />
              <div className="flex items-center justify-between px-3 py-1.5 bg-white">
                <span className="text-[12px] text-[#374151] font-medium">第{f.episodeNum}集</span>
                <div className="flex items-center gap-1.5">
                  {i < realFiles.length - 1 && (
                    <button
                      type="button"
                      onClick={() => goToEpisode(i + 1)}
                      className="rounded-[4px] border border-[#38c08f] px-2 py-0.5 text-[11px] text-[#38c08f] hover:bg-[#f0fdf4] transition-colors"
                    >
                      下一集
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setExpandedIdx(null)}
                    className="rounded-[4px] border border-[#d1d5db] px-2 py-0.5 text-[11px] text-[#6b7280] hover:bg-[#f3f4f6] transition-colors"
                  >
                    收起
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <RealVideoEpisodeItem
              file={f}
              onPlay={() => goToEpisode(i, true)}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── 审核处理抽屉-左侧内容区（带 Tab）─────────────────────────────────────────

function ContentAreaWithTabs({
  row,
  readOnly = false,
  episodeName,
  onEpisodeNameChange,
  onEpisodePlay,
}: {
  row: DraftReviewRow
  readOnly?: boolean
  episodeName?: string
  onEpisodeNameChange?: (v: string) => void
  onEpisodePlay?: (episodeNum: number) => void
}) {
  const isDraft = row.taskType === "初版审核"

  const tabs = isDraft
    ? [{ key: "info", label: "任务信息" }, { key: "draft_video", label: "初版视频" }]
    : [{ key: "info", label: "任务信息" }, { key: "sub_video", label: "有字幕视频" }, { key: "raw_video", label: "无字幕视频" }]

  const [activeTab, setActiveTab] = useState(tabs[0].key)

  useEffect(() => {
    setActiveTab(tabs[0].key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.id, row.taskType])

  return (
    <div className="flex w-full flex-col rounded-[8px] border border-[#e5e7eb] bg-white shadow-sm overflow-hidden">
      <div className="flex shrink-0 items-center border-b border-[#e5e7eb] px-4 gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "relative px-3 py-3 text-[13px] font-medium transition-colors whitespace-nowrap",
              activeTab === tab.key
                ? "text-[#38c08f]"
                : "text-[#6b7280] hover:text-[#374151]"
            )}
          >
            {tab.label}
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full bg-[#38c08f]" />
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto bg-[#f9fafb]">
        {activeTab === "info" && (
          <TaskInfoPanel
            row={row}
            readOnly={readOnly}
            episodeName={episodeName}
            onEpisodeNameChange={onEpisodeNameChange}
          />
        )}
        {activeTab === "draft_video" && (
          <div className="px-4 py-4">
            {row.draftVideoUrl ? (
              <InlineVideoPlayer src={row.draftVideoUrl} />
            ) : (
              <div className="flex aspect-video w-full items-center justify-center rounded-[6px] border border-[#e5e7eb] bg-[#f9fafb]">
                <span className="text-[13px] text-[#9ca3af]">暂无初版视频</span>
              </div>
            )}
          </div>
        )}
        {activeTab === "sub_video" && <VideoListPanel row={row} type="subtitled" onEpisodePlay={onEpisodePlay} />}
        {activeTab === "raw_video" && <VideoListPanel row={row} type="raw" onEpisodePlay={onEpisodePlay} />}
      </div>
    </div>
  )
}

// ─── 审核详情抽屉 ────────────────────────────────────────────────────────────

// ─── 任务详情抽屉（只读，与审核弹窗同布局，无意见区/操作按钮）─────────────────

function ReviewDetailDrawer({
  row,
  onClose,
}: {
  row: DraftReviewRow | null
  onClose: () => void
}) {
  const scriptScrollRef = useRef<HTMLDivElement>(null)
  const paidDividerRef = useRef<HTMLDivElement>(null)

  if (!row) return null

  const nodes = buildNodesFromScriptContent(row.scriptContent ?? "", row.scriptPayBreakpointData)
  const totalWords = calcTotalWords(nodes)
  const episodeCount = nodes.filter((n) => n.type === "orange-divider").length + 1

  const paidEpisodeNum = (() => {
    if (!row.scriptPayEpisode) return null
    const m = row.scriptPayEpisode.match(/\d+/)
    return m ? Number(m[0]) : null
  })()

  function isPaidDivider(nodeId: string): boolean {
    if (paidEpisodeNum === null) return false
    return calcEpisodeIndex(nodes, nodeId) === paidEpisodeNum
  }

  function scrollToPaywall() {
    if (!scriptScrollRef.current || !paidDividerRef.current) return
    const container = scriptScrollRef.current
    const target = paidDividerRef.current
    const offsetTop = target.offsetTop - container.offsetTop - 60
    container.scrollTo({ top: offsetTop, behavior: "smooth" })
  }

  function scrollToEpisode(episodeNum: number) {
    if (!scriptScrollRef.current) return
    const container = scriptScrollRef.current
    if (episodeNum <= 1) {
      container.scrollTo({ top: 0, behavior: "smooth" })
      return
    }
    const target = container.querySelector(`[data-episode="${episodeNum - 1}"]`) as HTMLElement | null
    if (!target) return
    const offsetTop = target.offsetTop - container.offsetTop - 60
    container.scrollTo({ top: offsetTop, behavior: "smooth" })
  }

  return (
    <>
      <div className="fixed inset-0 z-[40] bg-black/25" onClick={onClose} />
      <div className="fixed right-0 top-0 z-[50] flex h-full w-[960px] flex-col bg-[#f5f6f7] shadow-2xl">

        {/* 顶部标题栏 */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#e5e7eb] bg-white px-6 py-3.5">
          <div className="flex items-center gap-3">
            <span className="text-[14px] font-semibold text-[#111827]">任务详情</span>
          </div>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-[6px] text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#374151] transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* 主体：左右分栏 */}
        <div className="flex min-h-0 flex-1 gap-3 p-4">

          {/* 左侧：内容区（Tab 切换，只读） */}
          <ContentAreaWithTabs row={row} readOnly onEpisodePlay={scrollToEpisode} />

          {/* 右侧：剧本内容（铺满整个右半部分） */}
          <div className="relative flex min-w-0 flex-1 min-h-0 flex-col rounded-[8px] border border-[#e5e7eb] bg-white shadow-sm overflow-hidden">
            <div className="flex shrink-0 items-center border-b border-[#e5e7eb] px-4 py-3">
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-[#9ca3af]" />
                <span className="text-[13px] font-semibold text-[#374151]">剧本内容</span>
              </div>
            </div>

            {/* 正文滚动区 */}
            <div ref={scriptScrollRef} className="flex-1 overflow-y-auto bg-[#f9fafb] px-4 py-4">
              <div className="rounded-[6px] border border-[#e5e7eb] bg-white px-5 py-4">
                {nodes.length > 0 ? nodes.map((node) => {
                  if (node.type === "paragraph") {
                    return (
                      <p
                        key={node.id}
                        className="mb-2 text-[13px] leading-relaxed text-[#374151]"
                        dangerouslySetInnerHTML={{ __html: node.html }}
                      />
                    )
                  }
                  if (node.type === "orange-divider") {
                    const paid = isPaidDivider(node.id)
                    const epIdx = calcEpisodeIndex(nodes, node.id)
                    return (
                      <div key={node.id} ref={paid ? paidDividerRef : undefined} data-episode={epIdx}>
                        <DraftOrangeDivider nodes={nodes} nodeId={node.id} isPaidEpisode={paid} />
                      </div>
                    )
                  }
                  return null
                }) : (
                  <p className="py-8 text-center text-[13px] text-[#9ca3af]">暂无剧本内容</p>
                )}
              </div>
            </div>

            {/* 底部字数栏 */}
            <div className="shrink-0 flex items-center border-t border-[#e5e7eb] bg-white px-4 py-2">
              <span className="text-[12px] text-[#9ca3af]">
                全文字数：<span className="font-medium text-[#374151]">{totalWords.toLocaleString()} 字</span>
                <span className="mx-2 text-[#d1d5db]">|</span>
                集数：<span className="font-medium text-[#374151]">{Math.max(1, nodes.filter((n) => n.type === "orange-divider").length)} 集</span>
              </span>
            </div>

            {/* 悬浮"查看卡点"按钮 */}
            <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 z-10">
              <button
                onClick={scrollToPaywall}
                className="pointer-events-auto flex items-center justify-center rounded-full border border-[#f97316] bg-white px-4 py-2 text-[12.5px] font-medium text-[#ea580c] shadow-md hover:bg-[#fff7ed] transition-colors"
                style={{ writingMode: "vertical-rl", textOrientation: "mixed", letterSpacing: "0.05em" }}
              >
                查看卡点
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── 剧本内容节点构建 ─────────────────────────────────────────────────────────

function buildNodesFromScriptContent(content: string, payBreakpointData?: string): EditorNode[] {
  const paragraphs = content.split("\n").filter((s) => s.trim())
  if (paragraphs.length === 0) return []

  let dividerPositions: number[] = []
  try {
    if (payBreakpointData) dividerPositions = JSON.parse(payBreakpointData)
  } catch { /* ignore */ }
  const dividerSet = new Set(dividerPositions)

  const result: EditorNode[] = []
  let counter = 0
  const nextId = () => `dr-${counter++}`
  paragraphs.forEach((text, i) => {
    result.push({ type: "paragraph", id: nextId(), html: text })
    if (dividerSet.has(i)) {
      result.push({ type: "orange-divider", id: nextId(), deletable: false })
    }
  })
  return result
}

function DraftOrangeDivider({
  nodes,
  nodeId,
  isPaidEpisode,
}: {
  nodes: EditorNode[]
  nodeId: string
  isPaidEpisode: boolean
}) {
  const episodeNum = calcEpisodeIndex(nodes, nodeId)
  const idx = nodes.findIndex((n) => n.id === nodeId)
  const wordCount = calcSegmentWords(nodes, idx)
  return (
    <div className="my-4 flex select-none items-center gap-2">
      <div className="h-px flex-1 bg-[#f97316]" />
      <div className={cn("flex items-center gap-1.5 rounded-[4px] border px-3 py-1", "border-[#f97316] bg-[#fff7ed]")}>
        <span className="text-[12px] font-medium text-[#ea580c]">
          第{episodeNum}集，总计{wordCount}字
        </span>
        {isPaidEpisode && (
          <span className="ml-1 rounded-[3px] bg-[#f97316] px-1.5 py-0.5 text-[10.5px] font-semibold text-white leading-none">
            付费卡点
          </span>
        )}
      </div>
      <div className="h-px flex-1 bg-[#f97316]" />
    </div>
  )
}

// ─── 审核处理抽屉 ─────────────────────────────────────────────────────────────

function ReviewActionDrawer({
  row,
  onClose,
  onSave,
  onSubmit,
}: {
  row: DraftReviewRow | null
  onClose: () => void
  onSave?: (records: AuditOpinionRecord[], episodeName: string) => void | Promise<void>
  onSubmit: (
    result: "审核通过" | "驳回修改",
    ctx: { records: AuditOpinionRecord[]; episodeName: string },
  ) => void | Promise<void>
}) {
  const [opinionRecords, setOpinionRecords] = useState<AuditOpinionRecord[]>([])
  const [episodeName, setEpisodeName] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [opinionError, setOpinionError] = useState("")
  const [saved, setSaved] = useState(false)
  const [previewGallery, setPreviewGallery] = useState<{ images: string[]; index: number } | null>(null)
  const scriptScrollRef = useRef<HTMLDivElement>(null)
  const paidDividerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!row) return
    setEpisodeName(row.episodeName)
    setOpinionRecords(row.initialOpinionRecords ?? [])
  }, [row?.id])

  if (!row) return null

  const nodes = buildNodesFromScriptContent(row.scriptContent ?? "", row.scriptPayBreakpointData)
  const totalWords = calcTotalWords(nodes)
  const episodeCount = nodes.filter((n) => n.type === "orange-divider").length + 1

  const paidEpisodeNum = (() => {
    if (!row.scriptPayEpisode) return null
    const m = row.scriptPayEpisode.match(/\d+/)
    return m ? Number(m[0]) : null
  })()

  function isPaidDivider(nodeId: string): boolean {
    if (paidEpisodeNum === null) return false
    return calcEpisodeIndex(nodes, nodeId) === paidEpisodeNum
  }

  function scrollToPaywall() {
    if (!scriptScrollRef.current || !paidDividerRef.current) return
    const container = scriptScrollRef.current
    const target = paidDividerRef.current
    const offsetTop = target.offsetTop - container.offsetTop - 60
    container.scrollTo({ top: offsetTop, behavior: "smooth" })
  }

  function scrollToEpisode(episodeNum: number) {
    if (!scriptScrollRef.current) return
    const container = scriptScrollRef.current
    if (episodeNum <= 1) {
      container.scrollTo({ top: 0, behavior: "smooth" })
      return
    }
    const target = container.querySelector(`[data-episode="${episodeNum - 1}"]`) as HTMLElement | null
    if (!target) return
    const offsetTop = target.offsetTop - container.offsetTop - 60
    container.scrollTo({ top: offsetTop, behavior: "smooth" })
  }

  function handlePass() {
    setOpinionError("")
    void onSubmit("审核通过", { records: opinionRecords, episodeName })
  }

  function handleReject() {
    if (!opinionRecords.some(r => r.text.trim())) {
      setOpinionError("驳回修改时审核意见为必填项，请至少填写一条记录内容")
      return
    }
    setOpinionError("")
    void onSubmit("驳回修改", { records: opinionRecords, episodeName })
  }

  function handleRecordChange(id: string, patch: Partial<AuditOpinionRecord>) {
    setOpinionRecords(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))
  }

  function handleRecordDelete(id: string) {
    setOpinionRecords(prev => prev.filter(r => r.id !== id))
  }

  function handleAddRecord() {
    const newId = `r-${Date.now()}`
    const idx = opinionRecords.length + 1
    setOpinionRecords(prev => [
      ...prev,
      { id: newId, title: `记录 ${idx}`, text: "", images: [], createdAt: nowStr(), updatedAt: nowStr() },
    ])
    setEditingId(newId)
  }

  return (
    <>
      <div className="fixed inset-0 z-[40] bg-black/25" onClick={onClose} />
      <div className="fixed right-0 top-0 z-[50] flex h-full w-[1440px] flex-col bg-[#f5f6f7] shadow-2xl">

        {/* 顶部标题栏 */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#e5e7eb] bg-white px-6 py-3.5">
          <div className="flex items-center gap-3">
            <span className="text-[14px] font-semibold text-[#111827]">漫剧审核</span>
          </div>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-[6px] text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#374151] transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* 主体：三列横向布局 */}
        <div className="flex min-h-0 flex-1 gap-3 p-4">

          {/* 第一列：剧本内容（26%） */}
          <div className="relative flex w-[26%] shrink-0 flex-col rounded-[8px] border border-[#e5e7eb] bg-white shadow-sm overflow-hidden">
            {/* 列标题 */}
            <div className="flex shrink-0 items-center gap-2 border-b border-[#e5e7eb] px-4 py-3">
              <FileText size={14} className="text-[#9ca3af]" />
              <span className="text-[13px] font-semibold text-[#374151]">剧本内容</span>
            </div>

            {/* 正文滚动区 */}
            <div ref={scriptScrollRef} className="flex-1 overflow-y-auto bg-[#f9fafb] px-4 py-4">
              <div className="rounded-[6px] border border-[#e5e7eb] bg-white px-5 py-4">
                {nodes.length > 0 ? nodes.map((node) => {
                  if (node.type === "paragraph") {
                    return (
                      <p
                        key={node.id}
                        className="mb-2 text-[13px] leading-relaxed text-[#374151]"
                        dangerouslySetInnerHTML={{ __html: node.html }}
                      />
                    )
                  }
                  if (node.type === "orange-divider") {
                    const paid = isPaidDivider(node.id)
                    const epIdx = calcEpisodeIndex(nodes, node.id)
                    return (
                      <div key={node.id} ref={paid ? paidDividerRef : undefined} data-episode={epIdx}>
                        <DraftOrangeDivider nodes={nodes} nodeId={node.id} isPaidEpisode={paid} />
                      </div>
                    )
                  }
                  return null
                }) : (
                  <p className="py-8 text-center text-[13px] text-[#9ca3af]">暂无剧本内容</p>
                )}
              </div>
            </div>

            {/* 底部字数栏 */}
            <div className="shrink-0 flex items-center border-t border-[#e5e7eb] bg-white px-4 py-2">
              <span className="text-[12px] text-[#9ca3af]">
                全文字数：<span className="font-medium text-[#374151]">{totalWords.toLocaleString()} 字</span>
                <span className="mx-2 text-[#d1d5db]">|</span>
                集数：<span className="font-medium text-[#374151]">{Math.max(1, nodes.filter((n) => n.type === "orange-divider").length)} 集</span>
              </span>
            </div>

            {/* 悬浮查看卡点按钮 */}
            <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 z-10">
              <button
                onClick={scrollToPaywall}
                className="pointer-events-auto flex items-center justify-center rounded-full border border-[#f97316] bg-white px-4 py-2 text-[12.5px] font-medium text-[#ea580c] shadow-md hover:bg-[#fff7ed] transition-colors"
                style={{ writingMode: "vertical-rl", textOrientation: "mixed", letterSpacing: "0.05em" }}
              >
                查看卡点
              </button>
            </div>
          </div>

          {/* 第二列：漫剧信息（44%） */}
          <div className="flex w-[44%] shrink-0 flex-col min-h-0">
            <ContentAreaWithTabs row={row} episodeName={episodeName} onEpisodeNameChange={setEpisodeName} onEpisodePlay={scrollToEpisode} />
          </div>

          {/* 第三列：审核意见（30%） */}
          <div className="flex flex-1 min-h-0 flex-col rounded-[8px] border border-[#e5e7eb] bg-white shadow-sm">
            {/* 列标题 */}
            <div className="flex shrink-0 items-center justify-between border-b border-[#e5e7eb] px-4 py-3">
              <span className="text-[13px] font-semibold text-[#374151]">审核意见</span>
              <button
                onClick={handleAddRecord}
                className="flex items-center gap-1 rounded-[5px] border border-[#38c08f] px-2.5 py-1 text-[11.5px] font-medium text-[#38c08f] hover:bg-[#f0fdf4] transition-colors"
              >
                <Plus size={11} />
                新增记录
              </button>
            </div>

            {/* 记录列表（内部独立滚动） */}
            <div
              className="flex-1 min-h-0 overflow-y-auto scroll-smooth px-4 py-3 flex flex-col gap-3"
              style={{ paddingBottom: "12px" }}
              onClick={(e) => { if (e.target === e.currentTarget) setEditingId(null) }}
            >
              {opinionRecords.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-[12.5px] text-[#9ca3af]">
                  <p>暂无审核记录</p>
                  <p className="mt-1">点击【新增记录】添加第一条</p>
                </div>
              )}
              {opinionRecords.map(record => (
                <AuditRecordCard
                  key={record.id}
                  record={record}
                  isEditing={editingId === record.id}
                  onActivate={() => setEditingId(record.id)}
                  onChange={handleRecordChange}
                  onDelete={(id) => { handleRecordDelete(id); if (editingId === id) setEditingId(null) }}
                  onImagePreview={(src, allImages) => setPreviewGallery({ images: allImages ?? [src], index: allImages ? allImages.indexOf(src) : 0 })}
                />
              ))}
            </div>

            {/* 底部操作栏（固定贴底） */}
            <div className="shrink-0 border-t border-[#e5e7eb]">
              {opinionError && (
                <div className="border-b border-[#fee2e2] bg-[#fff5f5] px-4 py-2">
                  <p className="text-[12px] text-[#ef4444]">{opinionError}</p>
                </div>
              )}
              <div className="flex items-center justify-between gap-2 px-4 py-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      void (async () => {
                        try {
                          await onSave?.(opinionRecords, episodeName)
                          setSaved(true)
                          setTimeout(() => setSaved(false), 2000)
                        } catch {
                          /* 错误提示由 onSave 实现方处理 */
                        }
                      })()
                    }}
                    className="h-[30px] rounded-[6px] border border-[#d1d5db] px-4 text-[12.5px] font-medium text-[#374151] hover:border-[#38c08f] hover:text-[#38c08f] transition-colors"
                  >
                    保存
                  </button>
                  {saved && <span className="text-[12px] text-[#38c08f]">已保存</span>}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleReject}
                    className="h-[30px] rounded-[6px] border border-[#f87171] px-4 text-[12.5px] font-medium text-[#ef4444] hover:bg-[#fff5f5] transition-colors"
                  >
                    驳回修改
                  </button>
                  <button
                    onClick={handlePass}
                    className="h-[30px] rounded-[6px] bg-[#38c08f] px-4 text-[12.5px] font-medium text-white hover:bg-[#2da87a] transition-colors"
                  >
                    审核通过
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* 图片画廊预览 */}
      {previewGallery && <ImageGalleryModal images={previewGallery.images} initialIndex={previewGallery.index} onClose={() => setPreviewGallery(null)} />}
    </>
  )
}

// ─── 审核记录抽屉 ────────────────────────────────────────────────────────────

// ─── 审核记录抽屉辅助常量 ──────────────────────────────────────────────────────

// ─── 审核意见 - 记录类型 ──────────────────────────────────────────────────────

function nowStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`
}

// ─── 单条审核记录卡片 ──────────────────────────────────────────────────────────

const AUDIT_IMAGE_LIMIT = 15

function AuditRecordCard({
  record,
  isEditing,
  onActivate,
  onChange,
  onDelete,
  onImagePreview,
}: {
  record: AuditOpinionRecord
  isEditing: boolean
  onActivate: () => void
  onChange: (id: string, patch: Partial<AuditOpinionRecord>) => void
  onDelete: (id: string) => void
  onImagePreview: (src: string, allImages?: string[]) => void
}) {
  const cardRef = useRef<HTMLDivElement>(null)
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
    if (currentCount >= AUDIT_IMAGE_LIMIT) {
      showLimitMsg()
      return
    }

    const slots = AUDIT_IMAGE_LIMIT - currentCount
    const allowed = imageItems.slice(0, slots)
    if (imageItems.length > slots) showLimitMsg()

    allowed.forEach(item => {
      const file = item.getAsFile()
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string
        const newImg: AuditOpinionImage = {
          id: `img-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          dataUrl,
          name: file.name || "粘贴图片.png",
        }
        onChange(record.id, { images: [...record.images, newImg], updatedAt: nowStr() })
      }
      reader.readAsDataURL(file)
    })
  }, [record.id, record.images, onChange])

  function removeImage(imgId: string) {
    onChange(record.id, { images: record.images.filter(i => i.id !== imgId), updatedAt: nowStr() })
  }

  const isEmpty = !record.text.trim() && record.images.length === 0

  return (
    <div
      ref={cardRef}
      onClick={!isEditing ? onActivate : undefined}
      onPaste={isEditing ? handlePaste : undefined}
      className={cn(
        "shrink-0 rounded-[8px] border bg-white transition-all",
        isEditing
          ? "border-[#38c08f] shadow-md ring-1 ring-[#38c08f]/20 cursor-default"
          : "overflow-hidden border-[#e5e7eb] shadow-sm hover:border-[#a7f3d0] hover:shadow cursor-pointer"
      )}
    >
      {isEditing ? (
        /* ── 编辑态 ── */
        <div className="flex flex-col">
          {/* 编辑头 */}
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
          {/* 文字编辑 */}
          <div className="px-3 pt-2.5">
            <textarea
              autoFocus
              value={record.text}
              onChange={(e) => onChange(record.id, { text: e.target.value, updatedAt: nowStr() })}
              placeholder="请输入本条审核记录内容，可在此处粘贴截图"
              rows={4}
              className="w-full resize-none rounded-[6px] border border-[#e5e7eb] bg-white px-3 py-2 text-[12.5px] text-[#374151] placeholder-[#bfbfbf] outline-none transition-colors focus:border-[#38c08f]"
            />
          </div>
          {/* 图片区 */}
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
              {record.images.length >= AUDIT_IMAGE_LIMIT
                ? "已达上限（15张），如需新增请先删除部分图片"
                : `可在此卡片内粘贴截图上传，支持多张（已上传 ${record.images.length}/15）`}
            </p>
          </div>
        </div>
      ) : (
        /* ── 折叠态（固定高度摘要条）── */
        <div className="flex h-[68px] items-center gap-2.5 px-3.5">
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
              <img
                src={record.images[0].dataUrl}
                alt={record.images[0].name}
                className="h-full w-full object-cover"
              />
              {record.images.length > 1 && (
                <div className="absolute inset-0 flex items-center justify-center rounded-[4px] bg-black/45">
                  <span className="text-[10px] font-semibold leading-none text-white">
                    +{record.images.length - 1}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── 审核记录抽屉辅助常量 ──────────────────────────────────────────────────────
// 任务类型 → 对应的阶段
const taskTypeToStage: Record<TaskType, ReviewStageType> = {
  "初版审核": "初版",
  "终版审核": "终版",
  "修改版审核": "修改版",
}

// 状态 → 节点圆点颜色
const reviewRecordDotColor: Record<ReviewRecordStatus, string> = {
  "提交审核": "bg-[#9ca3af] border-[#d1d5db]",
  "驳回修改": "bg-[#f59e0b] border-[#fde68a]",
  "审核通过": "bg-[#38c08f] border-[#bbf7d0]",
  "审核取消": "bg-[#ef4444] border-[#fecaca]",
  "发起成片修改": "bg-[#8b5cf6] border-[#c4b5fd]",
}

// 状态 → 卡片样式
const reviewRecordCardStyle: Record<ReviewRecordStatus, { bg: string; border: string; titleColor: string }> = {
  "提交审核": { bg: "bg-white", border: "border-[#e5e7eb]", titleColor: "text-[#374151]" },
  "驳回修改": { bg: "bg-[#fefce8]", border: "border-[#fef08a]", titleColor: "text-[#a16207]" },
  "审核通过": { bg: "bg-[#f0fdf4]", border: "border-[#bbf7d0]", titleColor: "text-[#16a34a]" },
  "审核取消": { bg: "bg-[#fff1f2]", border: "border-[#fecaca]", titleColor: "text-[#dc2626]" },
  "发起成片修改": { bg: "bg-[#f5f3ff]", border: "border-[#c4b5fd]", titleColor: "text-[#7c3aed]" },
}

const reviewStageLabel: Record<ReviewStageType, { text: string; color: string }> = {
  "初版": { text: "初版", color: "text-[#2563eb] bg-[#eff6ff] border-[#bfdbfe]" },
  "终版": { text: "终版", color: "text-[#16a34a] bg-[#f0fdf4] border-[#bbf7d0]" },
  "修改版": { text: "修改版", color: "text-[#ea580c] bg-[#fff7ed] border-[#fed7aa]" },
}

function ReviewRecordDrawer({
  row,
  onClose,
}: {
  row: DraftReviewRow | null
  onClose: () => void
}) {
  const [previewGallery, setPreviewGallery] = useState<{ images: string[]; index: number } | null>(null)

  if (!row) return null

  const stageFilter = taskTypeToStage[row.taskType]
  const records = (row.auditRecords ?? []).filter((r) => r.stageType === stageFilter)

  return (
    <>
      <div className="fixed inset-0 z-[40] bg-black/20" onClick={onClose} />
      <div className="fixed right-0 top-0 z-[50] flex h-full w-[500px] flex-col bg-white shadow-2xl">

        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-[#e5e7eb] px-5 py-4">
          <p className="text-[14px] font-semibold text-[#111827]">审核记录</p>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-[6px] text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#374151] transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* 可滚动主体 */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {/* 时间线 */}
          {records.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f3f4f6]">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5 text-[#9ca3af]">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6M9 8h.01M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
                </svg>
              </div>
              <p className="text-[13px] text-[#9ca3af]">暂无审核记录</p>
            </div>
          ) : (
            <div className="relative pl-6">
              {/* 竖向时间线 */}
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[#e5e7eb]" />

              {records.map((rec, idx, arr) => {
                const card = reviewRecordCardStyle[rec.status] ?? reviewRecordCardStyle["提交审核"]
                const dot = reviewRecordDotColor[rec.status] ?? "bg-[#9ca3af] border-[#d1d5db]"
                const stage = reviewStageLabel[rec.stageType] ?? { text: rec.stageType, color: "text-[#6b7280] bg-[#f3f4f6] border-[#e5e7eb]" }
                const isReject = rec.status === "驳回修改"
                const hasOpinions = isReject && rec.opinionRecords && rec.opinionRecords.length > 0
                const isLast = idx === arr.length - 1

                return (
                  <div key={rec.id} className={cn("relative", isLast ? "mb-0" : "mb-4")}>
                    {/* 节点圆点 */}
                    <div className={cn(
                      "absolute -left-6 top-[11px] h-[13px] w-[13px] rounded-full border-2",
                      dot
                    )} />

                    {/* 内容卡片 */}
                    <div className={cn("rounded-[6px] border px-3.5 py-3", card.bg, card.border)}>
                      {/* 第一行：状态标题 + 阶段标签 + 操作人 */}
                      <div className="flex items-center gap-2">
                        <span className={cn("flex-1 text-[12.5px] font-semibold leading-none", card.titleColor)}>
                          {rec.status}
                        </span>
                        <span className={cn(
                          "inline-flex items-center rounded-[3px] border px-1.5 py-0.5 text-[10.5px] font-medium leading-none",
                          stage.color
                        )}>
                          {stage.text}
                        </span>
                        <span className="text-[11.5px] text-[#6b7280]">{rec.operator}</span>
                      </div>

                      {/* 第二行：时间 */}
                      <div className="mt-1.5 text-[11.5px] text-[#9ca3af]">{rec.time}</div>

                      {/* 驳回意见区：多条审核记录 */}
                      {isReject && (
                        <div className="mt-3 flex flex-col gap-2">
                          {hasOpinions ? (
                            rec.opinionRecords!.map((op, opIdx) => {
                              const hasText = !!op.text.trim()
                              const hasImages = op.images.length > 0
                              if (!hasText && !hasImages) return null
                              return (
                                <div
                                  key={op.id}
                                  className="rounded-[5px] border border-[#fef08a] bg-[#fffbeb] px-3 py-2.5"
                                >
                                  {/* 序号标记 */}
                                  <div className="mb-1.5 flex items-center gap-1.5">
                                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#f59e0b] text-[9.5px] font-bold leading-none text-white">
                                      {opIdx + 1}
                                    </span>
                                  </div>
                                  {/* 文字内容 */}
                                  {hasText && (
                                    <p className="text-[12px] leading-relaxed text-[#78350f] whitespace-pre-wrap">
                                      {op.text}
                                    </p>
                                  )}
                                  {/* 图片缩略图 */}
                                  {hasImages && (
                                    <div className={cn("flex flex-wrap gap-1.5", hasText ? "mt-2" : "")}>
                                      {op.images.map(img => (
                                        <div
                                          key={img.id}
                                          className="group relative h-14 w-14 shrink-0 cursor-pointer overflow-hidden rounded-[4px] border border-[#fde68a] bg-white"
                                          onClick={() => setPreviewGallery({ images: op.images.map((m: any) => m.dataUrl), index: op.images.indexOf(img) })}
                                        >
                                          <img src={img.dataUrl} alt={img.name} className="h-full w-full object-cover" />
                                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <ZoomIn size={12} className="text-white" />
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )
                            })
                          ) : rec.remark ? (
                            /* 兼容旧格式：只有 remark 没有 opinionRecords */
                            <div className="rounded-[5px] border border-[#fef08a] bg-[#fffbeb] px-3 py-2 text-[12px] leading-relaxed text-[#78350f]">
                              {rec.remark}
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="border-t border-[#e5e7eb] px-5 py-3">
          <button onClick={onClose} className="w-full rounded-[6px] border border-[#d1d5db] py-1.5 text-[13px] text-[#374151] hover:bg-[#f5f6f7] transition-colors">
            关闭
          </button>
        </div>
      </div>

      {/* 图片画廊预览 */}
      {previewGallery && <ImageGalleryModal images={previewGallery.images} initialIndex={previewGallery.index} onClose={() => setPreviewGallery(null)} />}
    </>
  )
}


// ─── API 字段映射 ───────────────────────────────────────────────────────────────

const PLACEHOLDER_COVER = "https://placehold.co/320x180/f3f4f6/9ca3af?text=封面"

function formatApiTime(iso: string | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function mapOpinionsToRecords(opinions: unknown[] | undefined): AuditOpinionRecord[] {
  if (!opinions?.length) return []
  return opinions.map((op: any, i) => ({
    id: String(op.id ?? `op-${i}`),
    title: `记录 ${i + 1}`,
    text: op.content ?? "",
    images: Array.isArray(op.images)
      ? op.images.map((url: string, j: number) => ({
          id: `img-${op.id ?? i}-${j}`,
          dataUrl: url,
          name: `图片${j + 1}`,
        }))
      : [],
    createdAt: formatApiTime(op.createdAt) || nowStr(),
    updatedAt: formatApiTime(op.updatedAt) || nowStr(),
  }))
}

function mapReviewTaskToRow(task: any, opts?: { includeOpinions?: boolean }): DraftReviewRow {
  const pt = task.productionTask ?? {}
  const producer = pt.producer?.name ?? ""
  const reviewer = task.reviewer?.name ?? ""
  const scriptName = pt.taskName ?? ""
  const scriptId = pt.script?.scriptId ?? (pt.scriptId != null ? String(pt.scriptId) : "")

  const script = pt.script ?? {}
  const delivery = task.delivery
  const files: any[] = delivery?.files ?? []

  let coverImage = PLACEHOLDER_COVER
  const copyrightImages: string[] = []
  let draftVideoUrl: string | undefined
  const deliveryFiles: DeliveryFileInfo[] = []

  if (delivery?.coverUrl) coverImage = delivery.coverUrl
  for (const f of files) {
    deliveryFiles.push({
      fileUrl: f.fileUrl,
      fileName: f.fileName ?? "",
      fileSize: f.fileSize ?? 0,
      fileType: f.fileType ?? "",
      episodeNum: f.episodeNum ?? 0,
    })
    if (f.fileType === "初版视频") draftVideoUrl = f.fileUrl
    if (f.fileType === "封面图" && !delivery?.coverUrl) coverImage = f.fileUrl
    if (f.fileType === "版权证明") copyrightImages.push(f.fileUrl)
  }

  return {
    id: String(task.id),
    scriptName,
    scriptId,
    episodeCount: pt.episodeCount ?? 0,
    producer,
    taskType: task.taskType as TaskType,
    reviewStatus: task.reviewStatus as ReviewStatus,
    submitTime: formatApiTime(task.createdAt),
    reviewer,
    remark: "",
    artStyle: pt.artStyle ?? "",
    visualEffect: pt.visualEffect ?? "",
    aspectRatio: pt.aspectRatio ?? "",
    productionRemark: pt.productionRemark ?? "",
    episodeName: task.episodeName ?? "",
    coverImage,
    copyrightImages,
    scriptContent: script.content ?? "",
    scriptPayBreakpointData: script.payBreakpointData ?? undefined,
    scriptPayEpisode: script.payEpisode ?? undefined,
    draftVideoUrl,
    deliveryFiles,
    initialOpinionRecords: opts?.includeOpinions ? mapOpinionsToRecords(task.opinions) : undefined,
  }
}

function mapLogActionToStatus(action: string): ReviewRecordStatus {
  if (action === "已取消") return "审核取消"
  const allowed: ReviewRecordStatus[] = ["提交审核", "驳回修改", "审核通过", "审核取消", "发起成片修改"]
  if (allowed.includes(action as ReviewRecordStatus)) return action as ReviewRecordStatus
  return "提交审核"
}

function parseLogOpinionSnapshot(snapshot: string | undefined): AuditOpinionRecord[] | undefined {
  if (!snapshot) return undefined
  try {
    const arr = JSON.parse(snapshot) as { content?: string; images?: string[] }[]
    if (!Array.isArray(arr)) return undefined
    return arr.map((op, i) => ({
      id: `log-op-${i}`,
      title: `记录 ${i + 1}`,
      text: op.content ?? "",
      images: (op.images ?? []).map((url, j) => ({
        id: `log-img-${i}-${j}`,
        dataUrl: url,
        name: `图片${j + 1}`,
      })),
      createdAt: "",
      updatedAt: "",
    }))
  } catch {
    return undefined
  }
}

function mapAuditLogToDraftRecord(log: any, index: number): DraftAuditRecord {
  const status = mapLogActionToStatus(log.action ?? "")
  const opinionRecords =
    (status === "驳回修改" || status === "发起成片修改") ? parseLogOpinionSnapshot(log.opinionSnapshot) : undefined
  return {
    id: Number(log.id) || index,
    status,
    time: formatApiTime(log.createdAt),
    operator: log.operator?.name ?? "",
    stageType: (log.stageType ?? "初版") as ReviewStageType,
    opinionRecords,
  }
}

function opinionsToApiPayload(records: AuditOpinionRecord[]) {
  return records
    .filter((r) => r.text.trim() !== "" || r.images.length > 0)
    .map((r) => ({ content: r.text, images: r.images.map((i) => i.dataUrl) }))
}

const TABLE_HEADERS = ["任务名称", "剧本ID", "集数", "制作人", "任务类型", "审核状态", "操作"]

const draftReviewMock: DraftReviewRow[] = []

export default function DraftReview() {
  const [data, setData] = useState<DraftReviewRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState(defaultFilters)
  const [applied, setApplied] = useState(defaultFilters)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<PageSizeOption>(10)
  const [detailRow, setDetailRow] = useState<DraftReviewRow | null>(null)
  const [reviewRow, setReviewRow] = useState<DraftReviewRow | null>(null)
  const [recordRow, setRecordRow] = useState<DraftReviewRow | null>(null)

  const canDetail = usePerm("review.comic.detail")
  const canReview = usePerm("review.comic.review")
  const canLog = usePerm("review.comic.log")

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { page, pageSize }
      if (applied.scriptName.trim()) params.taskName = applied.scriptName.trim()
      if (applied.scriptId.trim()) params.scriptId = applied.scriptId.trim()
      if (applied.producer.trim()) params.producer = applied.producer.trim()
      if (applied.taskType) params.taskType = applied.taskType
      if (applied.reviewStatus) params.reviewStatus = applied.reviewStatus
      const res = await comicReviewApi.list(params)
      const list = Array.isArray(res.list) ? res.list : []
      setTotal(Number(res.total) || 0)
      setData(list.map((t: any) => mapReviewTaskToRow(t)))
    } catch {
      setData([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [applied, page, pageSize])

  useEffect(() => {
    void fetchTasks()
  }, [fetchTasks])

  async function handleReviewSubmit(
    rowId: string,
    result: "审核通过" | "驳回修改",
    ctx: { records: AuditOpinionRecord[]; episodeName: string },
  ) {
    try {
      await comicReviewApi.review(Number(rowId), {
        result,
        episodeName: ctx.episodeName,
        opinions: opinionsToApiPayload(ctx.records),
      })
      setReviewRow(null)
      toast.success(result === "审核通过" ? "审核通过" : "已驳回，请修改后重新提交")
      await fetchTasks()
    } catch (e: any) {
      toast.error(e?.message ?? "审核失败")
    }
  }

  function handleQuery() {
    setApplied({
      scriptName: filters.scriptName.trim(),
      scriptId: filters.scriptId.trim(),
      producer: filters.producer.trim(),
      taskType: filters.taskType,
      reviewStatus: filters.reviewStatus,
    })
    setPage(1)
  }

  function handleReset() {
    setFilters(emptyFilters)
    setApplied(emptyFilters)
    setPage(1)
  }

  const pageData = data

  const inputCls =
    "h-[30px] w-full rounded-[6px] border border-[#d1d5db] bg-white px-3 text-[13px] placeholder-[#9ca3af] outline-none focus:border-[#38c08f] transition-colors"

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* global toast is used */}

      {/* 筛选区 */}
      <div className="rounded-t-[8px] border border-[#e5e7eb] bg-white px-5 py-4 shrink-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
          <div className="flex items-center gap-1.5">
            <span className="whitespace-nowrap text-[13px] text-[#374151]">任务名称</span>
            <div style={{ width: 148 }}>
              <input type="text" value={filters.scriptName} onChange={(e) => setFilters((f) => ({ ...f, scriptName: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && handleQuery()} placeholder="请输入任务名称" className={inputCls} />
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="whitespace-nowrap text-[13px] text-[#374151]">剧本ID</span>
            <div style={{ width: 148 }}>
              <input type="text" value={filters.scriptId} onChange={(e) => setFilters((f) => ({ ...f, scriptId: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && handleQuery()} placeholder="请输入剧本ID" className={inputCls} />
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="whitespace-nowrap text-[13px] text-[#374151]">制作人</span>
            <div style={{ width: 120 }}>
              <input type="text" value={filters.producer} onChange={(e) => setFilters((f) => ({ ...f, producer: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && handleQuery()} placeholder="请输入制作人" className={inputCls} />
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="whitespace-nowrap text-[13px] text-[#374151]">任务类型</span>
            <SelectFilter value={filters.taskType} onChange={(v) => setFilters((f) => ({ ...f, taskType: v }))} options={taskTypeOptions} placeholder="请选择任务类型" width={148} />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="whitespace-nowrap text-[13px] text-[#374151]">审核状态</span>
            <SelectFilter value={filters.reviewStatus} onChange={(v) => setFilters((f) => ({ ...f, reviewStatus: v }))} options={reviewStatusOptions} placeholder="请选择审核状态" width={148} />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={handleQuery} className="flex h-[30px] items-center gap-1.5 rounded-[6px] bg-[#38c08f] px-4 text-[13px] font-medium text-white hover:bg-[#2da87a] transition-colors">
              <Search size={13} />查询
            </button>
            <button onClick={handleReset} className="flex h-[30px] items-center gap-1.5 rounded-[6px] border border-[#d1d5db] bg-white px-4 text-[13px] text-[#374151] hover:bg-[#f5f6f7] transition-colors">
              <RotateCcw size={13} />重置
            </button>
          </div>
        </div>
      </div>

      {/* 列表区 */}
      <div className="flex flex-col flex-1 min-h-0 border-x border-b border-[#e5e7eb] bg-white rounded-b-[8px]">
        <div className="flex-1 overflow-auto min-h-0">
          <table className="w-full min-w-[1060px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#f9fafb]">
                {TABLE_HEADERS.map((h, idx) => (
                  <th key={`th-${idx}`} className="sticky top-0 z-10 border-b border-[#e5e7eb] bg-[#f9fafb] px-4 py-3 text-left text-[12.5px] font-medium text-[#6b7280] whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageData.length === 0 ? (
                <tr>
                  <td colSpan={TABLE_HEADERS.length} className="py-16 text-center text-[13px] text-[#9ca3af]">{loading ? "加载中..." : "暂无数据"}</td>
                </tr>
              ) : (
                pageData.map((row, i) => {
                  const sStyle = reviewStatusStyle[row.reviewStatus] ?? { bg: "bg-[#f3f4f6]", text: "text-[#6b7280]" }
                  const tStyle = taskTypeStyle[row.taskType] ?? { bg: "bg-[#f3f4f6]", text: "text-[#6b7280]" }
                  return (
                    <tr key={`draft-row-${row.id}`} className={cn("transition-colors hover:bg-[#f9fafb]", i < pageData.length - 1 && "border-b border-[#f3f4f6]")}>
                      <td className="max-w-[160px] px-4 py-3">
                        {canDetail ? (
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const d = await comicReviewApi.detail(Number(row.id))
                                setDetailRow(mapReviewTaskToRow(d))
                              } catch (e: any) {
                                toast.error(e?.message ?? "加载详情失败")
                              }
                            }}
                            className="block truncate font-medium text-[#2563eb] hover:text-[#1d4ed8] hover:underline transition-colors text-left"
                            title={row.scriptName}
                          >
                            {row.scriptName}
                          </button>
                        ) : (
                          <span className="block truncate font-medium text-[#111827] text-left" title={row.scriptName}>
                            {row.scriptName}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3"><span className="font-mono text-[12px] text-[#6b7280]">{row.scriptId}</span></td>
                      <td className="px-4 py-3 text-[#4b5563] whitespace-nowrap">{row.episodeCount}集</td>
                      <td className="px-4 py-3 text-[#4b5563] whitespace-nowrap">{row.producer}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={cn("inline-flex items-center rounded-[4px] px-2 py-0.5 text-[11.5px] font-medium", tStyle.bg, tStyle.text)}>{row.taskType}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={cn("inline-flex items-center rounded-[4px] px-2 py-0.5 text-[11.5px] font-medium", sStyle.bg, sStyle.text)}>{row.reviewStatus}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {row.reviewStatus === "审核中" && canReview && (
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const [d, logs] = await Promise.all([
                                    comicReviewApi.detail(Number(row.id)),
                                    comicReviewApi.logs(Number(row.id)),
                                  ])
                                  const auditRecords = (Array.isArray(logs) ? logs : []).map(mapAuditLogToDraftRecord)
                                  setReviewRow({ ...mapReviewTaskToRow(d, { includeOpinions: true }), auditRecords })
                                } catch (e: any) {
                                  toast.error(e?.message ?? "加载审核数据失败")
                                }
                              }}
                              className="rounded-[4px] border border-[#38c08f] px-2.5 py-1 text-[12px] font-medium text-[#38c08f] hover:bg-[#f0fdf4] transition-colors whitespace-nowrap"
                            >
                              审核
                            </button>
                          )}
                          {canLog && (
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const logs = await comicReviewApi.logs(Number(row.id))
                                  const auditRecords = (Array.isArray(logs) ? logs : []).map(mapAuditLogToDraftRecord)
                                  setRecordRow({ ...row, auditRecords })
                                } catch (e: any) {
                                  toast.error(e?.message ?? "加载审核记录失败")
                                }
                              }}
                              className="rounded-[4px] border border-[#2563eb] px-2.5 py-1 text-[12px] font-medium text-[#2563eb] hover:bg-[#eff6ff] transition-colors whitespace-nowrap"
                            >
                              审核记录
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="shrink-0">
          <ListPagination
            total={total}
            currentPage={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
          />
        </div>
      </div>

      <ReviewDetailDrawer row={detailRow} onClose={() => setDetailRow(null)} />
      <ReviewActionDrawer
        key={reviewRow?.id ?? "none"}
        row={reviewRow}
        onClose={() => setReviewRow(null)}
        onSave={async (records, episodeName) => {
          if (!reviewRow) return
          try {
            await comicReviewApi.saveDraft(Number(reviewRow.id), {
              episodeName,
              opinions: opinionsToApiPayload(records),
            })
            toast.success("已保存")
          } catch (e: any) {
            toast.error(e?.message ?? "保存失败")
            throw e
          }
        }}
        onSubmit={(result, ctx) => handleReviewSubmit(reviewRow!.id, result, ctx)}
      />
      {recordRow && <ReviewRecordDrawer row={recordRow} onClose={() => setRecordRow(null)} />}
    </div>
  )
}
