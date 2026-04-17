"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Search, RotateCcw, ChevronDown, X, Upload, ZoomIn } from "lucide-react"
import { cn } from "@/lib/utils"
import { productionTaskApi, uploadApi } from "@/lib/api"
import { toast } from "@/lib/toast"
import { VideoPlayerModal, VideoThumbnail, RemoteVideoThumbnail } from "@/components/video-thumbnail"
import { ImageThumbnail, ImageUploadWithProgress, UploadProgressBar } from "@/components/image-thumbnail"
import type { UploadFileState, RemoteFileState } from "@/components/video-thumbnail"
import { FilterInput, SelectFilter, ImageGalleryModal } from "@/components/shared"
import { TASK_TYPE_OPTIONS, MY_TASK_PROGRESS_BY_TYPE } from "@/lib/constants"
import { formatDateTime } from "@/lib/format"
import { ListPagination } from "@/components/list-pagination"
import { useFilters } from "@/hooks/use-filters"
import { usePagination } from "@/hooks/use-pagination"
import { usePerm } from "@/components/admin-layout"
import { VideoSlot } from "@/components/video-slot"
import {
  sharedParagraphs,
  calcTotalWords,
  calcEpisodeIndex,
  calcSegmentWords,
  type EditorNode,
} from "@/lib/script-editor"


// ─── Types ────────────────────────────────────────────────────────────────────

type AuditStatus =
  | "领取任务"
  | "提交审核"
  | "驳回修改"
  | "审核通过"
  | "发起成片修改"
  | "已取消"

type AuditStageType = "初版" | "终版" | "修改版"

interface OpinionImage {
  id: string
  dataUrl: string
  name: string
}

interface OpinionRecord {
  id: string
  text: string
  images: OpinionImage[]
}

interface AuditRecord {
  id: number
  status: AuditStatus
  time: string
  operator: string
  remark?: string
  stageType: AuditStageType
  round?: number  // 用于标记第几轮修改版
  opinionRecords?: OpinionRecord[]
}

interface MyTaskRow {
  id: number
  scriptName: string
  scriptId: string
  episodeCount: number
  artStyle: string
  visualEffect: string
  aspectRatio: string
  productionRemark: string
  taskType: "制作" | "修改"
  taskProgress: string
  reviewer: string
  owner: string
  auditRecords: AuditRecord[]
  scriptContent?: string
  scriptPayBreakpointData?: string
  reviewEpisodeName?: string
}

type UploadType = "上传初版" | "上传终版" | "上传修改版"

// ─── Constants ────────────────────────────────────────────────────────────────


const auditProgressOptions = [
  { label: "待提审", value: "待提审" },
  { label: "审核中", value: "审核中" },
  { label: "驳回修改", value: "驳回修改" },
  { label: "审核通过", value: "审核通过" },
]

const defaultFilters = {
  scriptName: "",
  taskType: "",
  taskProgress: "",
  reviewer: "",
}

// ─── API helpers ─────────────────────────────────────────────────────────────

const formatApiDateTime = formatDateTime

function mapProductionTaskToRow(task: Record<string, unknown>): MyTaskRow {
  const t = task as {
    id: number
    taskName?: string
    scriptId?: number | string
    episodeCount?: number
    artStyle?: string
    visualEffect?: string
    aspectRatio?: string
    productionRemark?: string
    taskType?: string
    taskProgress?: string
    reviewer?: { name?: string }
    producer?: { name?: string }
  }
  const tt = t.taskType === "修改" ? "修改" : "制作"
  return {
    id: Number(t.id),
    scriptName: String(t.taskName ?? ""),
    scriptId: t.script?.scriptId != null ? String(t.script.scriptId) : String(t.scriptId ?? ""),
    episodeCount: Number(t.episodeCount ?? 0),
    artStyle: String(t.artStyle ?? ""),
    visualEffect: String(t.visualEffect ?? ""),
    aspectRatio: String(t.aspectRatio ?? ""),
    productionRemark: String(t.productionRemark ?? ""),
    taskType: tt,
    taskProgress: String(t.taskProgress ?? ""),
    reviewer: t.reviewer?.name ? String(t.reviewer.name) : "",
    owner: t.producer?.name ? String(t.producer.name) : "",
    auditRecords: [],
    reviewEpisodeName: t.reviewEpisodeName ? String(t.reviewEpisodeName) : undefined,
  }
}

function mapAuditLogsToRecords(logs: Array<Record<string, unknown>>): AuditRecord[] {
  return logs.map((log) => {
    const l = log as {
      id: number
      action: string
      stageType: string
      createdAt: string
      operator?: { name?: string }
      opinionSnapshot?: string
    }
    let opinionRecords: OpinionRecord[] | undefined
    if (l.opinionSnapshot) {
      try {
        const parsed = JSON.parse(l.opinionSnapshot) as { content?: string; images?: string[] }[]
        if (Array.isArray(parsed)) {
          opinionRecords = parsed.map((op, i) => ({
            id: `snap-${l.id}-${i}`,
            text: op.content ?? "",
            images: (op.images ?? []).map((url, j) => ({
              id: `img-${l.id}-${i}-${j}`,
              dataUrl: url,
              name: url.split("/").pop() || `image-${j}.jpg`,
            })),
          }))
        }
      } catch {
        /* ignore malformed snapshot */
      }
    }
    const status = l.action as AuditStatus
    return {
      id: l.id,
      status,
      time: formatApiDateTime(l.createdAt),
      operator: l.operator?.name ? String(l.operator.name) : "",
      stageType: l.stageType as AuditStageType,
      opinionRecords,
    }
  })
}

function uploadToPresignedUrl(
  uploadUrl: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", uploadUrl)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(xhr.statusText || "上传失败"))
    }
    xhr.onerror = () => reject(new Error("上传失败"))
    const ct = file.type || "application/octet-stream"
    xhr.setRequestHeader("Content-Type", ct)
    xhr.send(file)
  })
}

async function putToCosPresigned(
  file: File,
  opts: { fileType: "video" | "image"; scene?: string },
  onProgress: (pct: number) => void,
): Promise<{ fileUrl: string; fileName: string; fileSize: number }> {
  const presign = await uploadApi.presign({
    fileName: file.name,
    fileType: opts.fileType,
    scene: opts.scene,
  })
  await uploadToPresignedUrl(presign.uploadUrl, file, onProgress)
  return { fileUrl: presign.fileUrl, fileName: file.name, fileSize: file.size }
}

// ─── Badge Config ─────────────────────────────────────────────────────────────

const taskTypeBadge: Record<string, { bg: string; text: string; border: string }> = {
  "制作": { bg: "bg-[#eff6ff]", text: "text-[#2563eb]", border: "border-[#bfdbfe]" },
  "修改": { bg: "bg-[#fff7ed]", text: "text-[#c2410c]", border: "border-[#fed7aa]" },
}

const taskProgressBadge: Record<string, { bg: string; text: string; border: string }> = {
  "初版制作中": { bg: "bg-[#fffbeb]", text: "text-[#d97706]", border: "border-[#fde68a]" },
  "初版审核中": { bg: "bg-[#fdf4ff]", text: "text-[#9333ea]", border: "border-[#e9d5ff]" },
  "终版制作中": { bg: "bg-[#fff7ed]", text: "text-[#c2410c]", border: "border-[#fed7aa]" },
  "终版审核中": { bg: "bg-[#fdf2f8]", text: "text-[#be185d]", border: "border-[#fbcfe8]" },
  "修改版制作中": { bg: "bg-[#fffbeb]", text: "text-[#d97706]", border: "border-[#fde68a]" },
  "修改版审核中": { bg: "bg-[#fdf4ff]", text: "text-[#9333ea]", border: "border-[#e9d5ff]" },
  "已完成": { bg: "bg-[#f0fdf4]", text: "text-[#16a34a]", border: "border-[#bbf7d0]" },
  "已取消": { bg: "bg-[#f3f4f6]", text: "text-[#6b7280]", border: "border-[#e5e7eb]" },
}

const auditProgressBadge: Record<string, { bg: string; text: string; border: string }> = {
  "待提审": { bg: "bg-[#eff6ff]", text: "text-[#2563eb]", border: "border-[#bfdbfe]" },
  "审核中": { bg: "bg-[#fffbeb]", text: "text-[#d97706]", border: "border-[#fde68a]" },
  "驳回修改": { bg: "bg-[#fef2f2]", text: "text-[#dc2626]", border: "border-[#fecaca]" },
  "审核通过": { bg: "bg-[#f0fdf4]", text: "text-[#16a34a]", border: "border-[#bbf7d0]" },
}

function StageBadge({ label, map }: { label: string; map: Record<string, { bg: string; text: string; border: string }> }) {
  const s = map[label] ?? { bg: "bg-[#f3f4f6]", text: "text-[#6b7280]", border: "border-[#e5e7eb]" }
  return (
    <span className={cn("inline-flex items-center rounded-[4px] border px-2 py-0.5 text-[11.5px] font-medium", s.bg, s.text, s.border)}>
      {label}
    </span>
  )
}

// ─── Script Detail Mock Map ───────────────────────────────────────────────────

// 按 row.id 映射付费卡点集数（与任务大厅保持一致）
const myTaskScriptDetailMockMap: Record<number, string> = {}

// ─── Script Detail Content Builder ───────────────────────────────────────────

function buildMyTaskDetailNodes(episodeCount: number): EditorNode[] {
  const paragraphCount = sharedParagraphs.length
  const gap = Math.max(3, Math.floor(paragraphCount / Math.max(episodeCount, 2)))
  const breakpointIndices = new Set<number>()
  for (let ep = 1; ep < episodeCount; ep++) {
    const idx = Math.min(ep * gap - 1, paragraphCount - 2)
    if (idx > 0) breakpointIndices.add(idx)
  }
  const result: EditorNode[] = []
  let counter = 0
  const nextId = () => `myt-${counter++}`
  sharedParagraphs.forEach((text, i) => {
    result.push({ type: "paragraph", id: nextId(), html: text })
    if (breakpointIndices.has(i)) {
      result.push({ type: "orange-divider", id: nextId(), deletable: false })
    }
  })
  result.push({ type: "orange-divider", id: nextId(), deletable: false })
  return result
}

function MyTaskReadonlyOrangeDivider({
  nodes, nodeId, isPaidEpisode,
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
      <div className="flex items-center gap-1.5 rounded-[4px] border border-[#f97316] bg-[#fff7ed] px-3 py-1">
        <span className="text-[12px] font-medium text-[#ea580c]">
          第{episodeNum}集，总计{wordCount}字
        </span>

      </div>
      <div className="h-px flex-1 bg-[#f97316]" />
    </div>
  )
}

// ─── Script Detail Drawer ─────────────────────────────────────────────────────

function MyTaskScriptDetailDrawer({
  row,
  onClose,
}: {
  row: MyTaskRow
  onClose: () => void
}) {
  const [previewGallery, setPreviewGallery] = useState<{ images: string[]; index: number } | null>(null)
  const [detailAuditRecords, setDetailAuditRecords] = useState<AuditRecord[]>(row.auditRecords)

  useEffect(() => {
    let cancelled = false
    productionTaskApi
      .auditLogs(row.id)
      .then((logs) => {
        if (!cancelled) setDetailAuditRecords(mapAuditLogsToRecords(logs as Record<string, unknown>[]))
      })
      .catch(() => {
        if (!cancelled) setDetailAuditRecords([])
      })
    return () => {
      cancelled = true
    }
  }, [row.id])

  const paidEpisode = ""
  const paidEpisodeNum = paidEpisode
    ? parseInt(paidEpisode.replace(/[^0-9]/g, ""), 10)
    : null

  const nodes = (() => {
    const content = row.scriptContent ?? ""
    const paragraphs = content.split("\n").filter((s) => s.trim())
    if (paragraphs.length === 0) return buildMyTaskDetailNodes(row.episodeCount)

    let dividerPositions: number[] = []
    try {
      if (row.scriptPayBreakpointData) dividerPositions = JSON.parse(row.scriptPayBreakpointData)
    } catch { /* ignore */ }
    const dividerSet = new Set(dividerPositions)

    const built: EditorNode[] = []
    let counter = 0
    const nextId = () => `myt-${counter++}`
    paragraphs.forEach((text, i) => {
      built.push({ type: "paragraph", id: nextId(), html: text })
      if (dividerSet.has(i)) {
        built.push({ type: "orange-divider", id: nextId(), deletable: false })
      }
    })
    return built
  })()
  const totalWords = calcTotalWords(nodes)

  const scrollRef = useRef<HTMLDivElement>(null)
  const paidDividerRef = useRef<HTMLDivElement>(null)

  function scrollToBreakpoint() {
    if (!scrollRef.current || !paidDividerRef.current) return
    const container = scrollRef.current
    const target = paidDividerRef.current
    const offsetTop = target.offsetTop - container.offsetTop - 80
    container.scrollTo({ top: offsetTop, behavior: "smooth" })
  }

  function isPaidDivider(nodeId: string): boolean {
    if (paidEpisodeNum === null) return false
    return calcEpisodeIndex(nodes, nodeId) === paidEpisodeNum
  }

  // 与任务大厅剧本详情弹窗字段保持一致
  const infoFields = [
    { label: "任务名称", value: row.scriptName, mono: false },
    { label: "剧本ID", value: row.scriptId, mono: true },
    { label: "集数", value: `${row.episodeCount} 集`, mono: false },
    { label: "画风类型", value: row.artStyle, mono: false },
    { label: "视觉效果", value: row.visualEffect, mono: false },
    { label: "画面比例", value: row.aspectRatio, mono: false },
    { label: row.taskType === "修改" ? "修改意见" : "制作备注", value: row.taskType === "修改" ? "" : (row.productionRemark || "--"), mono: false },
  ]

  // 修改类型：从 auditRecords 提取"发起成片修改/驳回修改"节点的 opinionRecords
  const modifyOpinionRecords: (OpinionRecord & { recordId: string })[] = []
  if (row.taskType === "修改") {
    detailAuditRecords.forEach((rec) => {
      if ((rec.status === "发起成片修改" || rec.status === "驳回修改") && rec.opinionRecords) {
        rec.opinionRecords.forEach((op) => {
          if (op.text.trim() || op.images.length > 0) {
            modifyOpinionRecords.push({ ...op, recordId: `${rec.id}-${op.id}` })
          }
        })
      } else if ((rec.status === "发起成片修改" || rec.status === "驳回修改") && rec.remark) {
        modifyOpinionRecords.push({ id: `r-${rec.id}`, text: rec.remark, images: [], recordId: `r-${rec.id}` } as any)
      }
    })
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40" style={{ zIndex: 120 }} onClick={onClose} />
      <div
        className="fixed right-0 top-0 flex h-full w-[1060px] flex-col bg-white"
        style={{ zIndex: 121, boxShadow: "-4px 0 32px rgba(0,0,0,0.15)" }}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-[#e5e7eb] px-6 py-4">
          <div className="flex items-center gap-3">
            <h2 className="text-[15px] font-semibold text-[#111827]">任务详情</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-[4px] text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#374151] transition-colors"
            aria-label="关闭"
          >
            <X size={16} />
          </button>
        </div>

        {/* 内容区：左侧正文 + 右侧信息卡 */}
        <div className="flex flex-1 overflow-hidden">
          {/* 左侧：只读正文 */}
          <div className="relative flex flex-1 flex-col overflow-hidden border-r border-[#e5e7eb]">
            <div ref={scrollRef} className="flex-1 overflow-y-auto bg-[#f9fafb] px-8 py-5">
              <div className="mx-auto max-w-[760px] rounded-[6px] border border-[#e5e7eb] bg-white px-8 py-6">
                {nodes.map((node) => {
                  if (node.type === "paragraph") {
                    return (
                      <p
                        key={node.id}
                        className="mb-2 text-[14px] leading-relaxed text-[#374151]"
                        dangerouslySetInnerHTML={{ __html: node.html }}
                      />
                    )
                  }
                  if (node.type === "orange-divider") {
                    const paid = isPaidDivider(node.id)
                    return (
                      <div key={node.id} ref={paid ? paidDividerRef : undefined}>
                        <MyTaskReadonlyOrangeDivider
                          nodes={nodes}
                          nodeId={node.id}
                          isPaidEpisode={paid}
                        />
                      </div>
                    )
                  }
                  return null
                })}
              </div>
            </div>

            {/* 底部字数 */}
            <div className="flex items-center border-t border-[#e5e7eb] bg-white px-6 py-3">
              <span className="text-[13px] text-[#6b7280]">
                全文字数：<span className="font-medium text-[#111827]">{totalWords.toLocaleString()} 字</span>
                <span className="mx-2 text-[#d1d5db]">|</span>
                集数：<span className="font-medium text-[#111827]">{Math.max(1, nodes.filter((n) => n.type === "orange-divider").length)} 集</span>
              </span>
            </div>
          </div>

          {/* 右侧：基础信息卡 */}
          <div className="w-[260px] shrink-0 overflow-y-auto px-5 py-5">
            <p className="mb-3 text-[11.5px] font-semibold uppercase tracking-wide text-[#9ca3af]">基础信息</p>
            <div className="flex flex-col gap-4">
              {infoFields.map(({ label, value, mono }) => (
                <div key={label}>
                  <p className="text-[11.5px] text-[#9ca3af]">{label}</p>
                  {label === "修改意见" ? (
                    modifyOpinionRecords.length > 0 ? (
                      <div className="mt-1.5 flex flex-col gap-2">
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
                      <p className="mt-0.5 text-[12.5px] text-[#d1d5db]">--</p>
                    )
                  ) : (
                    <p className={cn("mt-0.5 break-all text-[12.5px]", mono ? "font-mono text-[#4b5563]" : "text-[#374151]", label === "制作备注" && "whitespace-pre-wrap")}>
                      {label === "画风类型" ? (
                        <span className="inline-flex items-center rounded-[4px] border border-[#ddd6fe] bg-[#f5f3ff] px-2 py-0.5 text-[11.5px] font-medium text-[#7c3aed]">{value}</span>
                      ) : label === "视觉效果" ? (
                        <span className="inline-flex items-center rounded-[4px] border border-[#bfdbfe] bg-[#eff6ff] px-2 py-0.5 text-[11.5px] font-medium text-[#2563eb]">{value}</span>
                      ) : value}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {previewGallery && <ImageGalleryModal images={previewGallery.images} initialIndex={previewGallery.index} onClose={() => setPreviewGallery(null)} zIndex={130} />}
    </>
  )
}

// ─── Audit Record Drawer ──────────────────────────────────────────────────────

// 状态 → 节点圆点颜色
const auditStatusDotColor: Record<AuditStatus, string> = {
  "领取任务": "bg-[#6366f1] border-[#c7d2fe]",
  "提交审核": "bg-[#9ca3af] border-[#d1d5db]",
  "驳回修改": "bg-[#f59e0b] border-[#fde68a]",
  "审核通过": "bg-[#38c08f] border-[#bbf7d0]",
  "发起成片修改": "bg-[#94a3b8] border-[#cbd5e1]",
  "已取消": "bg-[#9ca3af] border-[#d1d5db]",
}

const auditStatusCardStyle: Record<AuditStatus, { bg: string; border: string; titleColor: string }> = {
  "领取任务": { bg: "bg-[#eef2ff]", border: "border-[#c7d2fe]", titleColor: "text-[#4338ca]" },
  "提交审核": { bg: "bg-white", border: "border-[#e5e7eb]", titleColor: "text-[#374151]" },
  "驳回修改": { bg: "bg-[#fefce8]", border: "border-[#fef08a]", titleColor: "text-[#a16207]" },
  "审核通过": { bg: "bg-[#f0fdf4]", border: "border-[#bbf7d0]", titleColor: "text-[#16a34a]" },
  "发起成片修改": { bg: "bg-[#f8fafc]", border: "border-[#e2e8f0]", titleColor: "text-[#475569]" },
  "已取消": { bg: "bg-[#f3f4f6]", border: "border-[#e5e7eb]", titleColor: "text-[#6b7280]" },
}

// 阶段标签
const stageTypeLabel: Record<AuditStageType, { text: string; color: string }> = {
  "初版": { text: "初版", color: "text-[#2563eb] bg-[#eff6ff] border-[#bfdbfe]" },
  "终版": { text: "终版", color: "text-[#16a34a] bg-[#f0fdf4] border-[#bbf7d0]" },
  "修改版": { text: "修改版", color: "text-[#ea580c] bg-[#fff7ed] border-[#fed7aa]" },
}

function AuditRecordDrawer({ row, onClose }: { row: MyTaskRow; onClose: () => void }) {
  const [previewGallery, setPreviewGallery] = useState<{ images: string[]; index: number } | null>(null)
  const [auditRecords, setAuditRecords] = useState<AuditRecord[]>(row.auditRecords)
  const [logsLoading, setLogsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLogsLoading(true)
    productionTaskApi
      .auditLogs(row.id)
      .then((logs) => {
        if (!cancelled) setAuditRecords(mapAuditLogsToRecords(logs as Record<string, unknown>[]))
      })
      .catch(() => {
        if (!cancelled) setAuditRecords([])
      })
      .finally(() => {
        if (!cancelled) setLogsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [row.id])

  return (
    <>
      <div className="fixed inset-0 z-[90] bg-black/40" onClick={onClose} />
      <div className="fixed right-0 top-0 z-[100] flex h-full w-[420px] flex-col bg-white shadow-xl">

        {/* 头部 */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#e5e7eb] px-5 py-4">
          <span className="text-[15px] font-semibold text-[#111827]">审核记录</span>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-[4px] text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#374151] transition-colors"
            aria-label="关闭"
          >
            <X size={16} />
          </button>
        </div>

        {/* 可滚动主体 */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {logsLoading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <p className="text-[13px] text-[#9ca3af]">加载中…</p>
            </div>
          ) : auditRecords.length === 0 ? (
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

              {/* 按 taskType 过滤：制作展示初版+终版，修改展示修改版 */}
              {auditRecords
                .filter((r) =>
                  row.taskType === "制作"
                    ? r.stageType === "初版" || r.stageType === "终版"
                    : r.stageType === "修改版"
                )
                .map((rec, idx, arr) => {
                  const card = auditStatusCardStyle[rec.status] ?? auditStatusCardStyle["提交审核"]
                  const dot = auditStatusDotColor[rec.status] ?? "bg-[#9ca3af] border-[#d1d5db]"
                  const stage = stageTypeLabel[rec.stageType] ?? { text: rec.stageType, color: "text-[#6b7280] bg-[#f3f4f6] border-[#e5e7eb]" }
                  const isOpinionNode = rec.status === "驳回修改" || rec.status === "发起成片修改"
                  const hasOpinionRecords = isOpinionNode && rec.opinionRecords && rec.opinionRecords.length > 0
                  const isLast = idx === arr.length - 1

                  return (
                    <div key={rec.id} className={cn("relative", isLast ? "mb-0" : "mb-4")}>
                      {/* 节点圆点 */}
                      <div className={cn(
                        "absolute -left-6 top-[11px] h-[13px] w-[13px] rounded-full border-2",
                        dot
                      )} />

                      {/* 内容卡片 */}
                      <div className={cn(
                        "rounded-[6px] border px-3.5 py-3",
                        card.bg, card.border
                      )}>
                        {/* 第一行：状态标题 + 阶段标签 + 操作人 */}
                        <div className="flex items-center gap-2">
                          <span className={cn("flex-1 text-[12.5px] font-semibold leading-none", card.titleColor)}>
                            {rec.status}
                          </span>
                          {rec.status !== "领取任务" && (
                            <span className={cn(
                              "inline-flex items-center rounded-[3px] border px-1.5 py-0.5 text-[10.5px] font-medium leading-none",
                              stage.color
                            )}>
                              {stage.text}
                            </span>
                          )}
                          <span className="text-[11.5px] text-[#6b7280]">{rec.operator}</span>
                        </div>

                        {/* 第二行：时间 */}
                        <div className="mt-1.5 text-[11.5px] text-[#9ca3af]">{rec.time}</div>

                        {/* 意见记录区（驳回修改 / 发起成片修改节点） */}
                        {isOpinionNode && (
                          <div className="mt-3 flex flex-col gap-2">
                            {hasOpinionRecords ? (
                              rec.opinionRecords!.map((op) => {
                                const hasText = !!op.text.trim()
                                const hasImages = op.images.length > 0
                                if (!hasText && !hasImages) return null
                                return (
                                  <div
                                    key={op.id}
                                    className="rounded-[5px] border border-[#fef08a] bg-[#fffbeb] px-3 py-2.5"
                                  >
                                    {hasText && (
                                      <p className="text-[12px] leading-relaxed text-[#78350f] whitespace-pre-wrap">
                                        {op.text}
                                      </p>
                                    )}
                                    {hasImages && (
                                      <div className={cn("flex flex-wrap gap-1.5", hasText ? "mt-2" : "")}>
                                        {op.images.map((img, imgIdx) => (
                                          <div
                                            key={img.id}
                                            className="group relative h-14 w-14 shrink-0 cursor-pointer overflow-hidden rounded-[4px] border border-[#fde68a] bg-white"
                                            onClick={() => setPreviewGallery({ images: op.images.map((m) => m.dataUrl), index: imgIdx })}
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
                              <div className="rounded-[4px] border border-[#fef08a] bg-[#fefce8] px-2.5 py-1.5 text-[12px] leading-relaxed text-[#78350f]">
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

        {/* 底部固定操作栏 */}
        <div className="shrink-0 border-t border-[#e5e7eb] px-5 py-3">
          <button
            onClick={onClose}
            className="w-full rounded-[6px] border border-[#d1d5db] py-1.5 text-[13px] text-[#374151] hover:bg-[#f5f6f7] transition-colors"
          >
            关闭
          </button>
        </div>
      </div>

      {/* 图片画廊预览 */}
      {previewGallery && <ImageGalleryModal images={previewGallery.images} initialIndex={previewGallery.index} onClose={() => setPreviewGallery(null)} zIndex={130} />}
    </>
  )
}

// ─── Upload Drawer ────────────────────────────────────────────────────────────

// Extract episode number from filename
function extractEpisodeNum(filename: string): number | null {
  const base = filename.replace(/\.[^.]+$/, "")
  const patterns = [
    /第\s*(\d+)\s*集/,
    /ep\s*0*(\d+)/i,
    /episode\s*[_-]?\s*0*(\d+)/i,
    /[_\-\s]0*(\d+)[_\-\s]/,
    /^0*(\d+)$/,
    /0*(\d+)/,
  ]
  for (const pat of patterns) {
    const m = base.match(pat)
    if (m) {
      const n = parseInt(m[1], 10)
      if (!isNaN(n) && n > 0) return n
    }
  }
  return null
}

// Episode video list with per-slot progress + thumbnail on done + batch upload
function EpisodeVideoListWithProgress({
  episodeCount,
  labelPrefix = "",
  videos,
  remoteVideos,
  unmatched,
  onSetVideo,
  onClearVideo,
  onBatchFiles,
}: {
  episodeCount: number
  labelPrefix?: string
  videos: (UploadFileState | null)[]
  remoteVideos?: (RemoteFileState | null)[]
  unmatched: File[]
  onSetVideo: (idx: number, f: File) => void
  onClearVideo: (idx: number) => void
  onBatchFiles: (files: File[]) => void
}) {
  const slotRefs = useRef<(HTMLInputElement | null)[]>([])
  const batchRef = useRef<HTMLInputElement>(null)
  const [playingSrc, setPlayingSrc] = useState<{ url: string; title: string } | null>(null)

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[12px] text-[#9ca3af]">共 {episodeCount} 集，每集上传 1 个视频（MP4 / MOV），单个文件不超过500MB</span>
        <button
          type="button"
          onClick={() => batchRef.current?.click()}
          className="rounded-[4px] border border-[#d1d5db] bg-white px-2.5 py-1 text-[12px] text-[#374151] hover:border-[#38c08f] hover:text-[#38c08f] transition-colors"
        >
          批量上传
        </button>
        <input
          ref={batchRef}
          type="file"
          accept="video/mp4,video/quicktime"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            if (files.length) onBatchFiles(files)
            e.target.value = ""
          }}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        {Array.from({ length: episodeCount }, (_, i) => {
          const s = videos[i] ?? null
          const r = remoteVideos?.[i] ?? null
          const slotLabel = `第${i + 1}集${labelPrefix ? `（${labelPrefix}）` : ""}`
          return (
            <div key={i}>
              {s?.done ? (
                <div className="flex items-center gap-2">
                  <span className="w-[92px] shrink-0 text-[12px] font-medium text-[#374151] whitespace-nowrap">{slotLabel}</span>
                  <div className="flex-1 min-w-0">
                    <VideoThumbnail
                      state={s}
                      onPlay={() => {
                        const url = s.remoteUrl || URL.createObjectURL(s.file)
                        setPlayingSrc({ url, title: s.file.name })
                      }}
                      onRemove={() => onClearVideo(i)}
                    />
                  </div>
                </div>
              ) : s ? (
                <div className="flex items-center gap-2 rounded-[6px] border border-[#e5e7eb] bg-[#f9fafb] px-3 py-2">
                  <span className="w-[92px] shrink-0 text-[12px] font-medium text-[#374151] whitespace-nowrap">{slotLabel}</span>
                  <div className="flex flex-1 flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Upload size={12} className="shrink-0 text-[#9ca3af]" />
                      <span className="flex-1 truncate text-[12px] text-[#111827]">{s.file.name}</span>
                      <span className="shrink-0 text-[11px] text-[#9ca3af]">{(s.file.size / 1024 / 1024).toFixed(1)} MB</span>
                      <span className="shrink-0 text-[11px] font-medium text-[#6b7280]">{s.progress}%</span>
                      <button
                        onClick={() => onClearVideo(i)}
                        className="shrink-0 rounded-[3px] border border-[#fecaca] bg-white px-1.5 py-0.5 text-[11px] text-[#dc2626] hover:bg-[#fef2f2] transition-colors"
                      >
                        取消
                      </button>
                    </div>
                    <div className="h-1 w-full overflow-hidden rounded-full bg-[#f3f4f6]">
                      <div
                        className="h-full rounded-full bg-[#60a5fa] transition-all duration-200"
                        style={{ width: `${s.progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              ) : r ? (
                <div className="flex items-center gap-2">
                  <span className="w-[92px] shrink-0 text-[12px] font-medium text-[#374151] whitespace-nowrap">{slotLabel}</span>
                  <div className="flex-1 min-w-0">
                    <RemoteVideoThumbnail
                      state={r}
                      onPlay={() => setPlayingSrc({ url: r.remoteUrl, title: r.fileName })}
                      onRemove={() => onClearVideo(i)}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-[6px] border border-[#e5e7eb] bg-[#f9fafb] px-3 py-2">
                  <span className="w-[92px] shrink-0 text-[12px] font-medium text-[#374151] whitespace-nowrap">{slotLabel}</span>
                  <div
                    onClick={() => slotRefs.current[i]?.click()}
                    className="flex flex-1 cursor-pointer items-center gap-1.5 text-[12.5px] text-[#9ca3af] hover:text-[#38c08f] transition-colors"
                  >
                    <Upload size={13} />
                    点击上传视频（MP4 / MOV），不超过500MB
                  </div>
                </div>
              )}
              <input
                ref={(el) => { slotRefs.current[i] = el }}
                type="file"
                accept="video/mp4,video/quicktime"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onSetVideo(i, f); e.target.value = "" }}
              />
            </div>
          )
        })}
      </div>

      {unmatched.length > 0 && (
        <div className="mt-2 rounded-[6px] border border-[#fde68a] bg-[#fffbeb] px-3 py-2.5">
          <div className="mb-1 text-[12px] font-medium text-[#92400e]">以下文件未能匹配到对应集数：</div>
          {unmatched.map((f, i) => (
            <div key={i} className="text-[11.5px] text-[#b45309]">· {f.name}</div>
          ))}
        </div>
      )}

      {playingSrc && <VideoPlayerModal src={playingSrc.url} title={playingSrc.title} onClose={() => setPlayingSrc(null)} />}
    </div>
  )
}

// ─── useEpisodeVideoGroup ────────────────────────────────────────────────────
// Reusable hook for one episode-video group (有字幕 or 无字幕)

function useEpisodeVideoGroup(episodeCount: number) {
  const [videos, setVideos] = useState<(UploadFileState | null)[]>(() =>
    Array(episodeCount).fill(null)
  )
  const [unmatched, setUnmatched] = useState<File[]>([])

  useEffect(() => {
    setVideos((prev) => {
      const next: (UploadFileState | null)[] = Array(episodeCount).fill(null)
      for (let i = 0; i < Math.min(prev.length, episodeCount); i++) next[i] = prev[i]
      return next
    })
  }, [episodeCount])

  function setVideo(idx: number, f: File) {
    setVideos((prev) => {
      const next = [...prev]
      next[idx] = { file: f, progress: 0, done: false }
      return next
    })
    putToCosPresigned(f, { fileType: "video", scene: "final" }, (p) => {
      setVideos((prev) => {
        const n = [...prev]
        if (n[idx]?.file === f) n[idx] = { ...n[idx]!, progress: p }
        return n
      })
    })
      .then(({ fileUrl }) => {
        setVideos((prev) => {
          const n = [...prev]
          if (n[idx]?.file === f) n[idx] = { ...n[idx]!, progress: 100, done: true, remoteUrl: fileUrl }
          return n
        })
      })
      .catch((e) => {
        toast.errorFrom(e, "视频上传失败")
        setVideos((prev) => {
          const n = [...prev]
          if (n[idx]?.file === f) n[idx] = null
          return n
        })
      })
  }

  function clearVideo(idx: number) {
    setVideos((prev) => {
      const next = [...prev]
      next[idx] = null
      return next
    })
  }

  function handleBatch(files: File[], maxEpisode: number) {
    const matched: { idx: number; file: File }[] = []
    const um: File[] = []
    files.forEach((f) => {
      const n = extractEpisodeNum(f.name)
      if (n !== null && n >= 1 && n <= maxEpisode) matched.push({ idx: n - 1, file: f })
      else um.push(f)
    })
    setUnmatched(um)
    matched.forEach(({ idx, file }) => setVideo(idx, file))
  }

  return { videos, unmatched, setVideo, clearVideo, handleBatch }
}

// ─── UploadDrawer (main) ─────────────────────────────────────────────────────

function UploadDrawer({
  uploadType, row, onClose, onSubmitSuccess,
}: {
  uploadType: UploadType
  row: MyTaskRow
  onClose: () => void
  onSubmitSuccess: () => void
}) {
  // ── 字段级错误 state ──
  const [errDraft, setErrDraft] = useState<string | null>(null)
  const [errCover, setErrCover] = useState<string | null>(null)
  const [errSubtitled, setErrSubtitled] = useState<string | null>(null)
  const [errUnsubtitled, setErrUnsubtitled] = useState<string | null>(null)
  const [errCopyright, setErrCopyright] = useState<string | null>(null)
  const [errEpisodeName, setErrEpisodeName] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // ── 剧集名称（终版 / 修改版，优先使用审核员修改的名称） ──
  const [episodeName, setEpisodeName] = useState<string>(row.reviewEpisodeName || row.scriptName)

  // ── 初版 state ──
  const [draftVideoState, setDraftVideoState] = useState<UploadFileState | null>(null)
  const [remoteDraftVideo, setRemoteDraftVideo] = useState<RemoteFileState | null>(null)

  // ── 终版 / 修改版 state ──
  const [coverStates, setCoverStates] = useState<UploadFileState[]>([])
  const [remoteCoverStates, setRemoteCoverStates] = useState<RemoteFileState[]>([])
  const [copyrightStates, setCopyrightStates] = useState<UploadFileState[]>([])
  const [remoteCopyrightStates, setRemoteCopyrightStates] = useState<RemoteFileState[]>([])

  // Two independent episode video groups
  const subtitled = useEpisodeVideoGroup(row.episodeCount)
  const unsubtitled = useEpisodeVideoGroup(row.episodeCount)

  // Remote video states for episodes loaded from draft
  const [remoteSubtitled, setRemoteSubtitled] = useState<(RemoteFileState | null)[]>(() => Array(row.episodeCount).fill(null))
  const [remoteUnsubtitled, setRemoteUnsubtitled] = useState<(RemoteFileState | null)[]>(() => Array(row.episodeCount).fill(null))

  // ── Load saved draft on mount ──
  useEffect(() => {
    const deliveryType = uploadType === "上传初版" ? "初版" : uploadType === "上传终版" ? "终版" : "修改版"
    productionTaskApi.listDeliveries(row.id, deliveryType).then((deliveries: any[]) => {
      if (!deliveries || deliveries.length === 0) {
        initialLoadDone.current = true
        return
      }
      const d = deliveries[0]
      if (d.episodeName && !row.reviewEpisodeName) setEpisodeName(d.episodeName)
      const files: any[] = d.files ?? []
      if (uploadType === "上传初版") {
        const draft = files.find((f: any) => f.fileType === "初版视频")
        if (draft) setRemoteDraftVideo({ remoteUrl: draft.fileUrl, fileName: draft.fileName, fileSize: draft.fileSize })
      } else {
        const covers = files.filter((f: any) => f.fileType === "封面图")
        if (covers.length) setRemoteCoverStates(covers.map((f: any) => ({ remoteUrl: f.fileUrl, fileName: f.fileName, fileSize: f.fileSize })))
        const cr = files.filter((f: any) => f.fileType === "版权证明")
        if (cr.length) setRemoteCopyrightStates(cr.map((f: any) => ({ remoteUrl: f.fileUrl, fileName: f.fileName, fileSize: f.fileSize })))
        const sub = files.filter((f: any) => f.fileType === "有字幕视频")
        if (sub.length) {
          setRemoteSubtitled((prev) => {
            const next = [...prev]
            sub.forEach((f: any) => { if (f.episodeNum >= 1 && f.episodeNum <= next.length) next[f.episodeNum - 1] = { remoteUrl: f.fileUrl, fileName: f.fileName, fileSize: f.fileSize } })
            return next
          })
        }
        const unsub = files.filter((f: any) => f.fileType === "无字幕视频")
        if (unsub.length) {
          setRemoteUnsubtitled((prev) => {
            const next = [...prev]
            unsub.forEach((f: any) => { if (f.episodeNum >= 1 && f.episodeNum <= next.length) next[f.episodeNum - 1] = { remoteUrl: f.fileUrl, fileName: f.fileName, fileSize: f.fileSize } })
            return next
          })
        }
      }
      // Mark load as done AFTER remote states are populated, so auto-save won't wipe data
      setTimeout(() => { initialLoadDone.current = true }, 200)
    }).catch(() => {
      initialLoadDone.current = true
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── 字段补齐后自动清除对应错误 ──
  useEffect(() => { if (draftVideoState) setErrDraft(null) }, [draftVideoState])
  useEffect(() => { if (coverStates.length > 0 || remoteCoverStates.length > 0) setErrCover(null) }, [coverStates, remoteCoverStates])
  useEffect(() => {
    if (errSubtitled && subtitled.videos.every((v) => v !== null)) setErrSubtitled(null)
  }, [subtitled.videos, errSubtitled])
  useEffect(() => {
    if (errUnsubtitled && unsubtitled.videos.every((v) => v !== null)) setErrUnsubtitled(null)
  }, [unsubtitled.videos, errUnsubtitled])
  useEffect(() => { if (copyrightStates.length > 0) setErrCopyright(null) }, [copyrightStates])

  // ── Scroll refs ──
  const scrollBodyRef = useRef<HTMLDivElement>(null)
  const draftRef = useRef<HTMLDivElement>(null)
  const episodeNameRef = useRef<HTMLDivElement>(null)
  const coverRef = useRef<HTMLDivElement>(null)
  const subtitledRef = useRef<HTMLDivElement>(null)
  const unsubtitledRef = useRef<HTMLDivElement>(null)
  const copyrightRef = useRef<HTMLDivElement>(null)

  function scrollToRef(ref: React.RefObject<HTMLDivElement | null>) {
    if (!ref.current || !scrollBodyRef.current) return
    const body = scrollBodyRef.current
    const target = ref.current
    const offsetTop = target.offsetTop - body.offsetTop - 16
    body.scrollTo({ top: Math.max(0, offsetTop), behavior: "smooth" })
  }

  function handleDraftFile(f: File) {
    setDraftVideoState({ file: f, progress: 0, done: false })
    putToCosPresigned(f, { fileType: "video", scene: "drafts" }, (p) => {
      setDraftVideoState((prev) => (prev?.file === f ? { ...prev, progress: p } : prev))
    })
      .then(({ fileUrl }) => {
        setDraftVideoState((prev) => (prev?.file === f ? { ...prev, progress: 100, done: true, remoteUrl: fileUrl } : prev))
      })
      .catch((e) => {
        toast.errorFrom(e, "上传失败")
        setDraftVideoState(null)
      })
  }

  function handleAddCover(files: File[]) {
    setCoverStates((prev) => {
      const base = prev.length
      const added = files.map((f) => ({ file: f, progress: 0, done: false }))
      files.forEach((f, i) => {
        const idx = base + i
        putToCosPresigned(f, { fileType: "image", scene: "covers" }, (p) => {
          setCoverStates((cur) => {
            const n = [...cur]
            if (n[idx]?.file === f) n[idx] = { ...n[idx]!, progress: p }
            return n
          })
        })
          .then(({ fileUrl }) => {
            setCoverStates((cur) => {
              const n = [...cur]
              if (n[idx]?.file === f) n[idx] = { ...n[idx]!, progress: 100, done: true, remoteUrl: fileUrl }
              return n
            })
          })
          .catch((e) => {
            toast.errorFrom(e, "封面上传失败")
            setCoverStates((cur) => cur.filter((s) => s.file !== f))
          })
      })
      return [...prev, ...added]
    })
  }

  function handleAddCopyright(files: File[]) {
    setCopyrightStates((prev) => {
      const base = prev.length
      const added = files.map((f) => ({ file: f, progress: 0, done: false }))
      files.forEach((f, i) => {
        const idx = base + i
        putToCosPresigned(f, { fileType: "image", scene: "copyright" }, (p) => {
          setCopyrightStates((cur) => {
            const n = [...cur]
            if (n[idx]?.file === f) n[idx] = { ...n[idx]!, progress: p }
            return n
          })
        })
          .then(({ fileUrl }) => {
            setCopyrightStates((cur) => {
              const n = [...cur]
              if (n[idx]?.file === f) n[idx] = { ...n[idx]!, progress: 100, done: true, remoteUrl: fileUrl }
              return n
            })
          })
          .catch((e) => {
            toast.errorFrom(e, "版权材料上传失败")
            setCopyrightStates((cur) => cur.filter((s) => s.file !== f))
          })
      })
      return [...prev, ...added]
    })
  }

  type FileEntry = { fileType: string; episodeNum: number; fileUrl: string; fileName: string; fileSize: number }

  function collectAllFiles(): FileEntry[] {
    const files: FileEntry[] = []
    if (uploadType === "上传初版") {
      if (draftVideoState?.remoteUrl) {
        files.push({ fileType: "初版视频", episodeNum: 0, fileUrl: draftVideoState.remoteUrl, fileName: draftVideoState.file.name, fileSize: draftVideoState.file.size })
      } else if (remoteDraftVideo) {
        files.push({ fileType: "初版视频", episodeNum: 0, fileUrl: remoteDraftVideo.remoteUrl, fileName: remoteDraftVideo.fileName, fileSize: remoteDraftVideo.fileSize })
      }
    } else {
      coverStates.forEach((c) => { if (c.remoteUrl) files.push({ fileType: "封面图", episodeNum: 0, fileUrl: c.remoteUrl, fileName: c.file.name, fileSize: c.file.size }) })
      if (coverStates.length === 0) remoteCoverStates.forEach((r) => files.push({ fileType: "封面图", episodeNum: 0, fileUrl: r.remoteUrl, fileName: r.fileName, fileSize: r.fileSize }))

      for (let i = 0; i < row.episodeCount; i++) {
        const v = subtitled.videos[i]
        if (v?.remoteUrl) files.push({ fileType: "有字幕视频", episodeNum: i + 1, fileUrl: v.remoteUrl, fileName: v.file.name, fileSize: v.file.size })
        else if (remoteSubtitled[i]) files.push({ fileType: "有字幕视频", episodeNum: i + 1, fileUrl: remoteSubtitled[i]!.remoteUrl, fileName: remoteSubtitled[i]!.fileName, fileSize: remoteSubtitled[i]!.fileSize })
      }
      for (let i = 0; i < row.episodeCount; i++) {
        const v = unsubtitled.videos[i]
        if (v?.remoteUrl) files.push({ fileType: "无字幕视频", episodeNum: i + 1, fileUrl: v.remoteUrl, fileName: v.file.name, fileSize: v.file.size })
        else if (remoteUnsubtitled[i]) files.push({ fileType: "无字幕视频", episodeNum: i + 1, fileUrl: remoteUnsubtitled[i]!.remoteUrl, fileName: remoteUnsubtitled[i]!.fileName, fileSize: remoteUnsubtitled[i]!.fileSize })
      }

      copyrightStates.forEach((c) => { if (c.remoteUrl) files.push({ fileType: "版权证明", episodeNum: 0, fileUrl: c.remoteUrl, fileName: c.file.name, fileSize: c.file.size }) })
      if (copyrightStates.length === 0) remoteCopyrightStates.forEach((r) => files.push({ fileType: "版权证明", episodeNum: 0, fileUrl: r.remoteUrl, fileName: r.fileName, fileSize: r.fileSize }))
    }
    return files
  }

  function buildDeliveryBody(): Record<string, unknown> | null {
    const files = collectAllFiles()
    if (uploadType === "上传初版") {
      if (files.length === 0) return null
      return { deliveryType: "初版", episodeName: "", coverUrl: "", files }
    }
    if (files.length === 0 && !episodeName.trim()) return null
    const coverUrl = coverStates[0]?.remoteUrl ?? remoteCoverStates[0]?.remoteUrl ?? ""
    return {
      deliveryType: uploadType === "上传终版" ? "终版" : "修改版",
      episodeName: episodeName.trim(),
      coverUrl,
      files,
    }
  }

  // ── Auto-save draft on any change (upload complete or delete) ──
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialLoadDone = useRef(false)
  useEffect(() => {
    if (!initialLoadDone.current) return
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => {
      const body = buildDeliveryBody()
      if (!body) return
      productionTaskApi.saveDeliveryDraft(row.id, body).catch(() => {})
    }, 1000)
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftVideoState, remoteDraftVideo, coverStates, remoteCoverStates, copyrightStates, remoteCopyrightStates, subtitled.videos, unsubtitled.videos, remoteSubtitled, remoteUnsubtitled, episodeName])

  async function handleCancel() {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    try {
      const body = buildDeliveryBody()
      if (body) await productionTaskApi.saveDeliveryDraft(row.id, body)
    } catch { /* ignore */ }
    onClose()
  }

  // ── 提交校验：字段级定位 ──
  async function handleSubmit() {
    const hasDraftVideo = !!(draftVideoState?.remoteUrl || remoteDraftVideo)
    const hasCover = coverStates.some((c) => c.remoteUrl) || remoteCoverStates.length > 0
    const hasCopyright = copyrightStates.some((c) => c.remoteUrl) || remoteCopyrightStates.length > 0

    if (uploadType === "上传初版") {
      if (!hasDraftVideo) {
        setErrDraft("请上传初版视频")
        scrollToRef(draftRef)
        return
      }
      if (draftVideoState && (!draftVideoState.done || !draftVideoState.remoteUrl)) {
        setErrDraft("请等待视频上传完成")
        scrollToRef(draftRef)
        return
      }
      setErrDraft(null)
    } else {
      if (!episodeName.trim()) {
        setErrEpisodeName("请输入剧集名称")
        scrollToRef(episodeNameRef)
        return
      }
      setErrEpisodeName(null)

      if (!hasCover) {
        setErrCover("请上传封面图")
        scrollToRef(coverRef)
        return
      }
      if (coverStates.length > 0 && (!coverStates[0]?.done || !coverStates[0]?.remoteUrl)) {
        setErrCover("请等待封面上传完成")
        scrollToRef(coverRef)
        return
      }
      setErrCover(null)

      const missingSubCount = Array.from({ length: row.episodeCount }, (_, i) => i).filter((i) => !subtitled.videos[i] && !remoteSubtitled[i]).length
      if (missingSubCount > 0) {
        setErrSubtitled(`有 ${missingSubCount} 集视频未上传，请补齐后再提交`)
        scrollToRef(subtitledRef)
        return
      }
      setErrSubtitled(null)
      if (subtitled.videos.some((v) => v && (!v.done || !v.remoteUrl))) {
        setErrSubtitled("有字幕版本仍有文件上传中，请等待完成后再提交")
        scrollToRef(subtitledRef)
        return
      }

      const missingUnsubCount = Array.from({ length: row.episodeCount }, (_, i) => i).filter((i) => !unsubtitled.videos[i] && !remoteUnsubtitled[i]).length
      if (missingUnsubCount > 0) {
        setErrUnsubtitled(`有 ${missingUnsubCount} 集视频未上传，请补齐后再提交`)
        scrollToRef(unsubtitledRef)
        return
      }
      setErrUnsubtitled(null)
      if (unsubtitled.videos.some((v) => v && (!v.done || !v.remoteUrl))) {
        setErrUnsubtitled("无字幕版本仍有文件上传中，请等待完成后再提交")
        scrollToRef(unsubtitledRef)
        return
      }

      if (!hasCopyright) {
        setErrCopyright("请上传版权证明材料后再提交")
        scrollToRef(copyrightRef)
        return
      }
      if (copyrightStates.some((c) => !c.done || !c.remoteUrl)) {
        setErrCopyright("请等待版权证明材料上传完成")
        scrollToRef(copyrightRef)
        return
      }
      setErrCopyright(null)
    }

    setSubmitting(true)
    try {
      const body = buildDeliveryBody()!
      await productionTaskApi.submitDelivery(row.id, body)
      onSubmitSuccess()
    } catch (e) {
      toast.errorFrom(e, "提交失败")
    } finally {
      setSubmitting(false)
    }
  }

  const isDraftUpload = uploadType === "上传初版"

  // ── Section header helper ──
  function SectionHeader({ title, required = false }: { title: string; required?: boolean }) {
    return (
      <div className="flex items-center gap-2 border-b border-[#f3f4f6] pb-2">
        <div className="h-3 w-0.5 rounded-full bg-[#38c08f]" />
        <span className="text-[13px] font-semibold text-[#374151]">
          {title}{required && <span className="ml-0.5 text-[#dc2626]">*</span>}
        </span>
      </div>
    )
  }

  // ── 就地错误提示样式 ──
  function FieldError({ msg }: { msg: string }) {
    return (
      <div className="mt-1.5 flex items-center gap-1 text-[12px] text-[#dc2626]">
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3 shrink-0">
          <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm-.75 4a.75.75 0 0 1 1.5 0v3.5a.75.75 0 0 1-1.5 0V5zm.75 6.5a.875.875 0 1 1 0-1.75.875.875 0 0 1 0 1.75z" />
        </svg>
        {msg}
      </div>
    )
  }

  return (
    <>
      <div className="fixed inset-0 z-[90] bg-black/40" onClick={handleCancel} />
      <div className="fixed right-0 top-0 z-[100] flex h-full w-[620px] flex-col bg-white shadow-xl">

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#e5e7eb] px-6 py-4">
          <h2 className="text-[15px] font-semibold text-[#111827]">{uploadType}</h2>
          <button
            onClick={handleCancel}
            className="flex h-7 w-7 items-center justify-center rounded-[4px] text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#374151] transition-colors"
            aria-label="关闭"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div ref={scrollBodyRef} className="flex-1 overflow-y-auto px-6 py-5">
          <div className="flex flex-col gap-5">

            {/* 基础信息卡 */}
            <div className="rounded-[8px] border border-[#e5e7eb] bg-[#f9fafb] px-4 py-3.5">
              <div className="mb-2.5 text-[11.5px] font-semibold uppercase tracking-wide text-[#9ca3af]">基础信息</div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <div>
                  <div className="text-[11.5px] text-[#9ca3af]">任务名称</div>
                  <div className="mt-0.5 text-[12.5px] font-medium text-[#111827] leading-snug">{row.scriptName}</div>
                </div>
                <div>
                  <div className="text-[11.5px] text-[#9ca3af]">集数</div>
                  <div className="mt-0.5 text-[12.5px] font-medium text-[#111827]">{row.episodeCount} 集</div>
                </div>
                <div>
                  <div className="text-[11.5px] text-[#9ca3af]">任务类型</div>
                  <div className="mt-1"><StageBadge label={row.taskType} map={taskTypeBadge} /></div>
                </div>
                <div>
                  <div className="text-[11.5px] text-[#9ca3af]">任务进度</div>
                  <div className="mt-1"><StageBadge label={row.taskProgress} map={taskProgressBadge} /></div>
                </div>
              </div>
            </div>

            {/* ── 上传初版：单视频 ── */}
            {isDraftUpload && (
              <div ref={draftRef} className="flex flex-col gap-3">
                <SectionHeader title="上传附件" required />
                <div className={cn(
                  "rounded-[6px] transition-colors",
                  errDraft ? "rounded-[6px] ring-1 ring-[#fca5a5] ring-offset-0" : ""
                )}>
                  <VideoSlot
                    hint="支持 MP4、MOV 格式，单个文件不超过 5GB"
                    state={draftVideoState}
                    remoteState={remoteDraftVideo}
                    onFile={handleDraftFile}
                    onRemove={() => { setDraftVideoState(null); setRemoteDraftVideo(null) }}
                  />
                </div>
                {errDraft && <FieldError msg={errDraft} />}
              </div>
            )}

            {/* ── 上传终版 / 修改版 ── */}
            {!isDraftUpload && (
              <>
                {/* 剧集名称 */}
                <div ref={episodeNameRef} className="flex flex-col gap-2">
                  <SectionHeader title="剧集名称" required />
                  <input
                    type="text"
                    value={episodeName}
                    onChange={(e) => {
                      setEpisodeName(e.target.value)
                      if (e.target.value.trim()) setErrEpisodeName(null)
                    }}
                    placeholder="请输入剧集名称"
                    className={cn(
                      "w-full rounded-[6px] border px-3 py-2 text-[13px] text-[#111827] outline-none placeholder:text-[#9ca3af] transition-colors",
                      "focus:border-[#6366f1] focus:ring-1 focus:ring-[#6366f1]",
                      errEpisodeName
                        ? "border-[#fca5a5] bg-[#fef2f2] focus:border-[#fca5a5] focus:ring-[#fca5a5]"
                        : "border-[#d1d5db] bg-white hover:border-[#9ca3af]"
                    )}
                  />
                  {errEpisodeName && <FieldError msg={errEpisodeName} />}
                </div>

                {/* 封面图 */}
                <div ref={coverRef} className="flex flex-col gap-3">
                  <SectionHeader title="上传封面图" required />
                  <div className={cn(
                    "rounded-[6px] transition-colors",
                    errCover ? "ring-1 ring-[#fca5a5] ring-offset-0" : ""
                  )}>
                    <ImageUploadWithProgress
                      label=""
                      required={false}
                      maxFiles={1}
                      states={coverStates}
                      remoteStates={remoteCoverStates}
                      onAdd={handleAddCover}
                      onRemove={(idx) => { setCoverStates((prev) => prev.filter((_, i) => i !== idx)); setRemoteCoverStates([]) }}
                      onRemoveRemote={() => setRemoteCoverStates([])}
                    />
                  </div>
                  {errCover && <FieldError msg={errCover} />}
                </div>

                {/* 有字幕版本 */}
                <div ref={subtitledRef} className="flex flex-col gap-3">
                  <SectionHeader title="上传有字幕版本" required />
                  {errSubtitled && (
                    <div className="flex items-center gap-1.5 rounded-[4px] border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[12px] text-[#dc2626]">
                      <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3 shrink-0">
                        <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm-.75 4a.75.75 0 0 1 1.5 0v3.5a.75.75 0 0 1-1.5 0V5zm.75 6.5a.875.875 0 1 1 0-1.75.875.875 0 0 1 0 1.75z" />
                      </svg>
                      {errSubtitled}
                    </div>
                  )}
                  <div className={cn(
                    "rounded-[6px] transition-colors",
                    errSubtitled ? "ring-1 ring-[#fca5a5] ring-offset-0" : ""
                  )}>
                    <EpisodeVideoListWithProgress
                      episodeCount={row.episodeCount}
                      labelPrefix="有字幕"
                      videos={subtitled.videos}
                      remoteVideos={remoteSubtitled}
                      unmatched={subtitled.unmatched}
                      onSetVideo={(idx, f) => subtitled.setVideo(idx, f)}
                      onClearVideo={(idx) => { subtitled.clearVideo(idx); setRemoteSubtitled((p) => { const n = [...p]; n[idx] = null; return n }) }}
                      onBatchFiles={(files) => subtitled.handleBatch(files, row.episodeCount)}
                    />
                  </div>
                </div>

                {/* 无字幕版本 */}
                <div ref={unsubtitledRef} className="flex flex-col gap-3">
                  <SectionHeader title="上传无字幕版本" required />
                  {errUnsubtitled && (
                    <div className="flex items-center gap-1.5 rounded-[4px] border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[12px] text-[#dc2626]">
                      <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3 shrink-0">
                        <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm-.75 4a.75.75 0 0 1 1.5 0v3.5a.75.75 0 0 1-1.5 0V5zm.75 6.5a.875.875 0 1 1 0-1.75.875.875 0 0 1 0 1.75z" />
                      </svg>
                      {errUnsubtitled}
                    </div>
                  )}
                  <div className={cn(
                    "rounded-[6px] transition-colors",
                    errUnsubtitled ? "ring-1 ring-[#fca5a5] ring-offset-0" : ""
                  )}>
                    <EpisodeVideoListWithProgress
                      episodeCount={row.episodeCount}
                      labelPrefix="无字幕"
                      videos={unsubtitled.videos}
                      remoteVideos={remoteUnsubtitled}
                      unmatched={unsubtitled.unmatched}
                      onSetVideo={(idx, f) => unsubtitled.setVideo(idx, f)}
                      onClearVideo={(idx) => { unsubtitled.clearVideo(idx); setRemoteUnsubtitled((p) => { const n = [...p]; n[idx] = null; return n }) }}
                      onBatchFiles={(files) => unsubtitled.handleBatch(files, row.episodeCount)}
                    />
                  </div>
                </div>

                {/* 版权证明材料（必填） */}
                <div ref={copyrightRef} className="flex flex-col gap-3">
                  <SectionHeader title="上传版权证明材料" required />
                  {errCopyright && (
                    <div className="flex items-center gap-1.5 rounded-[4px] border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[12px] text-[#dc2626]">
                      <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3 shrink-0">
                        <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm-.75 4a.75.75 0 0 1 1.5 0v3.5a.75.75 0 0 1-1.5 0V5zm.75 6.5a.875.875 0 1 1 0-1.75.875.875 0 0 1 0 1.75z" />
                      </svg>
                      {errCopyright}
                    </div>
                  )}
                  <div className={cn(
                    "rounded-[6px] transition-colors",
                    errCopyright ? "ring-1 ring-[#fca5a5] ring-offset-0" : ""
                  )}>
                    <ImageUploadWithProgress
                      label=""
                      required={false}
                      maxFiles={15}
                      states={copyrightStates}
                      remoteStates={remoteCopyrightStates}
                      onAdd={handleAddCopyright}
                      onRemove={(idx) => { setCopyrightStates((prev) => prev.filter((_, i) => i !== idx)) }}
                      onRemoveRemote={(idx) => setRemoteCopyrightStates((prev) => prev.filter((_, i) => i !== idx))}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-[#e5e7eb] px-6 py-3.5">
          <button
            type="button"
            disabled={submitting}
            onClick={handleCancel}
            className="rounded-[6px] border border-[#d1d5db] bg-white px-5 py-2 text-[13px] text-[#374151] hover:bg-[#f5f6f7] transition-colors disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleSubmit()}
            className="rounded-[6px] bg-[#38c08f] px-5 py-2 text-[13px] font-medium text-white hover:bg-[#2da87a] transition-colors disabled:opacity-50"
          >
            确认提交
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

const myTaskMock: MyTaskRow[] = []

export default function MyTask() {
  const [data, setData] = useState<MyTaskRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const { draft: filters, active: applied, update: setField, apply: applyFilters, reset: resetFilters } = useFilters(defaultFilters)
  const { page, pageSize, setPage, resetPage, paginationProps } = usePagination(10)

  const [auditDrawerRow, setAuditDrawerRow] = useState<MyTaskRow | null>(null)
  const [uploadDrawerRow, setUploadDrawerRow] = useState<MyTaskRow | null>(null)
  const [uploadType, setUploadType] = useState<UploadType>("上传初版")
  const [detailRow, setDetailRow] = useState<MyTaskRow | null>(null)
  const [querySeq, setQuerySeq] = useState(0)

  const canDetail = usePerm("comicMake.my.detail")
  const canUpload1 = usePerm("comicMake.my.upload1")
  const canUpload2 = usePerm("comicMake.my.upload2")
  const canUpload3 = usePerm("comicMake.my.upload3")
  const canLog = usePerm("comicMake.my.log")

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    try {
      const res = await productionTaskApi.mine({
        page,
        pageSize,
        taskName: applied.scriptName.trim() || undefined,
        taskType: applied.taskType || undefined,
        taskProgress: applied.taskProgress || undefined,
        reviewer: applied.reviewer.trim() || undefined,
      })
      const list = ((res.list ?? []) as Record<string, unknown>[]).map(
        mapProductionTaskToRow,
      )
      setTotal(Number(res.total))
      setData(list)
    } catch {
      setData([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, applied.scriptName, applied.taskType, applied.taskProgress, applied.reviewer, querySeq])

  useEffect(() => {
    void fetchTasks()
  }, [fetchTasks])

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(total / pageSize) || 1)
    if (page > maxPage) setPage(maxPage)
  }, [total, pageSize, page, setPage])

  function handleTaskTypeChange(val: string) {
    setField("taskType", val)
    setField("taskProgress", "")
  }

  function handleQuery() {
    applyFilters()
    resetPage()
    setQuerySeq((n) => n + 1)
  }

  function handleReset() {
    resetFilters()
    resetPage()
  }

  const uploadToastLabel: Record<UploadType, string> = {
    "上传初版": "已提交初版审核",
    "上传终版": "已提交终版审核",
    "上传修改版": "已提交修改版审核",
  }

  function handleDeliverySuccess() {
    toast.success(uploadToastLabel[uploadType])
    setUploadDrawerRow(null)
    void fetchTasks()
  }

  async function openDetailDrawer(row: MyTaskRow) {
    try {
      const detail = await productionTaskApi.detail(row.id)
      setDetailRow({
        ...row,
        scriptContent: detail.script?.content ?? undefined,
        scriptPayBreakpointData: detail.script?.payBreakpointData ?? undefined,
      })
    } catch {
      setDetailRow(row)
    }
  }

  function openUpload(row: MyTaskRow, type: UploadType) {
    setUploadType(type)
    setUploadDrawerRow(row)
  }

  // Determine which upload button to show per new taskType + taskProgress model
  function getUploadButton(row: MyTaskRow): UploadType | null {
    if (row.taskType === "制作" && row.taskProgress === "初版制作中") return "上传初版"
    if (row.taskType === "制作" && row.taskProgress === "终版制作中") return "上传终版"
    if (row.taskType === "修改" && row.taskProgress === "修改版制作中") return "上传修改版"
    return null
  }

  return (
    <>
      <div className="flex flex-col gap-0 rounded-lg border border-[#e5e7eb] bg-white flex-1 min-h-0">

        {/* Filter area */}
        <div className="border-b border-[#e5e7eb] px-5 py-4">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <FilterInput
              label="任务名称"
              placeholder="请输入任务名称"
              value={filters.scriptName}
              onChange={(v) => setField("scriptName", v)}
              width="w-[140px]"
            />
            <SelectFilter
              label="任务类型"
              options={TASK_TYPE_OPTIONS}
              value={filters.taskType}
              onChange={handleTaskTypeChange}
              width="w-[90px]"
            />
            {/* 任务进度：联动任务类型 */}
            <div className="flex items-center gap-2">
              <span className="whitespace-nowrap text-[13px] text-[#374151]">任务进度</span>
              {filters.taskType ? (
                <SelectFilter
                  label=""
                  options={MY_TASK_PROGRESS_BY_TYPE[filters.taskType] ?? []}
                  value={filters.taskProgress}
                  onChange={(v) => setField("taskProgress", v)}
                  width="w-[130px]"
                />
              ) : (
                <button
                  disabled
                  className="flex h-[30px] w-[130px] cursor-not-allowed items-center gap-1.5 rounded-[6px] border border-[#e5e7eb] bg-[#f9fafb] px-3 text-[13px] text-[#9ca3af]"
                >
                  <span className="flex-1 text-left truncate">请先选择任务类型</span>
                  <ChevronDown size={12} className="shrink-0" />
                </button>
              )}
            </div>
            <FilterInput
              label="审核员"
              placeholder="请输入审核员"
              value={filters.reviewer}
              onChange={(v) => setField("reviewer", v)}
              width="w-[120px]"
            />
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={handleQuery}
                className="flex h-[30px] items-center gap-1.5 rounded-[6px] bg-[#38c08f] px-4 text-[13px] font-medium text-white hover:bg-[#2da87a] transition-colors"
              >
                <Search size={13} />
                查询
              </button>
              <button
                onClick={handleReset}
                className="flex h-[30px] items-center gap-1.5 rounded-[6px] border border-[#d1d5db] bg-white px-4 text-[13px] text-[#374151] hover:bg-[#f5f6f7] transition-colors"
              >
                <RotateCcw size={13} />
                重置
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-x-auto">
          <table className="w-full min-w-[800px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#f9fafb]">
                {[
                  { label: "任务名称", w: "" },
                  { label: "集数", w: "" },
                  { label: "任务类型", w: "" },
                  { label: "任务进度", w: "" },
                  { label: "审核员", w: "" },
                  { label: "操作", w: "w-px" },
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
                  <td colSpan={6} className="py-12 text-center text-[13px] text-[#9ca3af]">
                    {loading ? "加载中…" : "暂无数据"}
                  </td>
                </tr>
              ) : (
                data.map((row, i) => {
                  const uploadBtn = getUploadButton(row)
                  const canUpload =
                    uploadBtn === "上传初版"
                      ? canUpload1
                      : uploadBtn === "上传终版"
                        ? canUpload2
                        : uploadBtn === "上传修改版"
                          ? canUpload3
                          : false
                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        "transition-colors hover:bg-[#f9fafb]",
                        i < data.length - 1 && "border-b border-[#f3f4f6]"
                      )}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        {canDetail ? (
                          <button
                            onClick={() => void openDetailDrawer(row)}
                            className="text-left font-medium text-[#2563eb] hover:text-[#1d4ed8] hover:underline transition-colors"
                          >
                            {row.scriptName}
                          </button>
                        ) : (
                          <span className="text-left font-medium text-[#111827]">{row.scriptName}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#4b5563] whitespace-nowrap">{row.episodeCount} 集</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StageBadge label={row.taskType} map={taskTypeBadge} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StageBadge label={row.taskProgress} map={taskProgressBadge} />
                      </td>
                      <td className="px-4 py-3 text-[#4b5563] whitespace-nowrap">{row.reviewer}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {uploadBtn && canUpload && (
                            <button
                              onClick={() => openUpload(row, uploadBtn)}
                              className="rounded-[4px] border border-[#38c08f] px-2.5 py-1 text-[12px] font-medium text-[#38c08f] hover:bg-[#f0fdf4] transition-colors whitespace-nowrap"
                            >
                              {uploadBtn}
                            </button>
                          )}
                          {canLog && (
                            <button
                              onClick={() => setAuditDrawerRow(row)}
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

        {/* Pagination */}
        <ListPagination
          total={total}
          {...paginationProps}
        />
      </div>

      {/* Script Detail Drawer */}
      {detailRow && (
        <MyTaskScriptDetailDrawer
          row={detailRow}
          onClose={() => setDetailRow(null)}
        />
      )}

      {/* Audit Record Drawer */}
      {auditDrawerRow && (
        <AuditRecordDrawer
          row={auditDrawerRow}
          onClose={() => setAuditDrawerRow(null)}
        />
      )}

      {/* Upload Drawer */}
      {uploadDrawerRow && (
        <UploadDrawer
          uploadType={uploadType}
          row={uploadDrawerRow}
          onClose={() => setUploadDrawerRow(null)}
          onSubmitSuccess={handleDeliverySuccess}
        />
      )}

    </>
  )
}
