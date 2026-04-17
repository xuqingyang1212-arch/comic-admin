"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Search, RotateCcw, ChevronDown, X, ZoomIn } from "lucide-react"
import { FilterInput, SelectFilter, DateRangePicker, ImageGalleryModal } from "@/components/shared"
import { ART_STYLE_OPTIONS, VISUAL_EFFECT_OPTIONS, ASPECT_RATIO_OPTIONS, TASK_TYPE_OPTIONS, TASK_HALL_PROGRESS_BY_TYPE } from "@/lib/constants"
import { formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import { productionTaskApi } from "@/lib/api"
import { toast } from "@/lib/toast"
import { ListPagination } from "@/components/list-pagination"
import { useFilters } from "@/hooks/use-filters"
import { usePagination } from "@/hooks/use-pagination"
import { usePerm } from "@/components/admin-layout"
import {
  sharedParagraphs,
  calcTotalWords,
  calcEpisodeIndex,
  calcSegmentWords,
  type EditorNode,
} from "@/lib/script-editor"


// ─── Constants ────────────────────────────────────────────────────────────────

const defaultFilters = {
  scriptName: "",
  scriptId: "",
  artStyle: "",
  visualEffect: "",
  aspectRatio: "",
  publishTimeRange: [] as [string, string] | [],
  taskType: "制作",
  taskProgress: "待认领",
  initiator: "",
  producer: "",
}

// ─── Types ────────────────────────────────────────────────────────────────────

type AuditStatus = "领取任务" | "提交审核" | "驳回修改" | "审核通过" | "发起成片修改" | "取消任务"
type AuditStageType = "初版" | "终版" | "修改版"

interface OpinionImage { id: string; dataUrl: string; name: string }
interface OpinionRecord { id: string; text: string; images: OpinionImage[] }
interface AuditRecord {
  id: number
  status: AuditStatus
  time: string
  operator: string
  remark?: string
  stageType: AuditStageType
  round?: number
  opinionRecords?: OpinionRecord[]
}

interface TaskRow {
  id: number
  scriptName: string
  scriptId: string
  episodeCount: number
  artStyle: string
  visualEffect: string
  aspectRatio: string
  productionRemark: string
  publishTime: string
  taskType: "制作" | "修改"
  taskProgress: string
  owner: string
  producer: string
  initiator: string
  auditRecords: AuditRecord[]
  payEpisode?: string
  scriptContent?: string
  scriptPayBreakpointData?: string
}

// ─── API mappers ─────────────────────────────────────────────────────────────

const formatPublishTime = formatDateTime

function mapActionToAuditStatus(action: string): AuditStatus {
  if (action === "已取消") return "取消任务"
  const known: AuditStatus[] = ["领取任务", "提交审核", "驳回修改", "审核通过", "发起成片修改", "取消任务"]
  if (known.includes(action as AuditStatus)) return action as AuditStatus
  return "提交审核"
}

function parseStageType(s: string | undefined): AuditStageType {
  if (s === "初版" || s === "终版" || s === "修改版") return s
  return "初版"
}

function parseOpinionSnapshot(raw: string | undefined): OpinionRecord[] {
  if (!raw) return []
  try {
    const arr = JSON.parse(raw) as { content?: string; images?: string[] }[]
    if (!Array.isArray(arr)) return []
    return arr.map((o, i) => ({
      id: `snap-${i}`,
      text: o.content ?? "",
      images: (o.images ?? []).map((url, j) => ({
        id: `img-${i}-${j}`,
        dataUrl: url,
        name: "",
      })),
    }))
  } catch {
    return []
  }
}

function mapAuditLogsToRecords(logs: any[]): AuditRecord[] {
  return logs.map((log) => {
    const status = mapActionToAuditStatus(String(log.action ?? ""))
    const opinionRecords = parseOpinionSnapshot(log.opinionSnapshot)
    const rec: AuditRecord = {
      id: Number(log.id),
      status,
      time: formatPublishTime(log.createdAt),
      operator: log.operator?.name ?? "",
      stageType: parseStageType(log.stageType),
    }
    if (opinionRecords.length > 0) rec.opinionRecords = opinionRecords
    return rec
  })
}

function mapApiTaskToRow(t: any): TaskRow {
  const taskType = t.taskType === "修改" ? "修改" : "制作"
  const producerName = t.producer?.name ?? ""
  return {
    id: Number(t.id),
    scriptName: String(t.taskName ?? ""),
    scriptId: t.script?.scriptId != null ? String(t.script.scriptId) : String(t.scriptId ?? ""),
    episodeCount: Number(t.episodeCount ?? 0),
    artStyle: String(t.artStyle ?? ""),
    visualEffect: String(t.visualEffect ?? ""),
    aspectRatio: String(t.aspectRatio ?? ""),
    productionRemark: String(t.productionRemark ?? ""),
    publishTime: formatPublishTime(t.publishTime),
    taskType,
    taskProgress: String(t.taskProgress ?? ""),
    owner: producerName,
    producer: producerName,
    initiator: t.initiator?.name ?? "",
    auditRecords: [],
  }
}

function mapDetailToTaskRow(detail: any, auditRecords: AuditRecord[]): TaskRow {
  const base = mapApiTaskToRow(detail)
  base.auditRecords = auditRecords
  base.payEpisode = detail.script?.payEpisode != null ? String(detail.script.payEpisode) : undefined
  if (detail.script?.scriptId != null) base.scriptId = String(detail.script.scriptId)
  base.scriptContent = detail.script?.content ?? undefined
  base.scriptPayBreakpointData = detail.script?.payBreakpointData ?? undefined
  return base
}

// ─── Audit Record Styles ──────────────────────────────────────────────────────

const auditStatusDotColor: Record<AuditStatus, string> = {
  "领取任务": "bg-[#6366f1] border-[#c7d2fe]",
  "提交审核": "bg-[#9ca3af] border-[#d1d5db]",
  "驳回修改": "bg-[#f59e0b] border-[#fde68a]",
  "审核通过": "bg-[#38c08f] border-[#bbf7d0]",
  "发起成片修改": "bg-[#94a3b8] border-[#cbd5e1]",
  "取消任务": "bg-[#f87171] border-[#fecaca]",
}

const auditStatusCardStyle: Record<AuditStatus, { bg: string; border: string; titleColor: string }> = {
  "领取任务": { bg: "bg-[#eef2ff]", border: "border-[#c7d2fe]", titleColor: "text-[#4338ca]" },
  "提交审核": { bg: "bg-white", border: "border-[#e5e7eb]", titleColor: "text-[#374151]" },
  "驳回修改": { bg: "bg-[#fefce8]", border: "border-[#fef08a]", titleColor: "text-[#a16207]" },
  "审核通过": { bg: "bg-[#f0fdf4]", border: "border-[#bbf7d0]", titleColor: "text-[#16a34a]" },
  "发起成片修改": { bg: "bg-[#f8fafc]", border: "border-[#e2e8f0]", titleColor: "text-[#475569]" },
  "取消任务": { bg: "bg-[#fff1f2]", border: "border-[#fecaca]", titleColor: "text-[#dc2626]" },
}

const stageTypeLabel: Record<AuditStageType, { text: string; color: string }> = {
  "初版": { text: "初版", color: "text-[#2563eb] bg-[#eff6ff] border-[#bfdbfe]" },
  "终版": { text: "终版", color: "text-[#16a34a] bg-[#f0fdf4] border-[#bbf7d0]" },
  "修改版": { text: "修改版", color: "text-[#ea580c] bg-[#fff7ed] border-[#fed7aa]" },
}

// ─── TaskHallAuditRecordDrawer ────────────────────────────────────────────────

function TaskHallAuditRecordDrawer({ row, onClose }: { row: TaskRow; onClose: () => void }) {
  const [previewGallery, setPreviewGallery] = useState<{ images: string[]; index: number } | null>(null)

  const records = row.auditRecords.filter((r) =>
    row.taskType === "制作"
      ? r.stageType === "初版" || r.stageType === "终版"
      : r.stageType === "修改版"
  )

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
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[#e5e7eb]" />
              {records.map((rec, idx, arr) => {
                const card = auditStatusCardStyle[rec.status] ?? auditStatusCardStyle["提交审核"]
                const dot = auditStatusDotColor[rec.status] ?? "bg-[#9ca3af] border-[#d1d5db]"
                const stage = stageTypeLabel[rec.stageType] ?? { text: rec.stageType, color: "text-[#6b7280] bg-[#f3f4f6] border-[#e5e7eb]" }
                const isOpinionNode = rec.status === "驳回修改" || rec.status === "发起成片修改"
                const hasOpinionRecords = isOpinionNode && rec.opinionRecords && rec.opinionRecords.length > 0
                const isLast = idx === arr.length - 1

                return (
                  <div key={rec.id} className={cn("relative", isLast ? "mb-0" : "mb-4")}>
                    <div className={cn("absolute -left-6 top-[11px] h-[13px] w-[13px] rounded-full border-2", dot)} />
                    <div className={cn("rounded-[6px] border px-3.5 py-3", card.bg, card.border)}>
                      <div className="flex items-center gap-2">
                        <span className={cn("flex-1 text-[12.5px] font-semibold leading-none", card.titleColor)}>
                          {rec.status}
                        </span>
                        {rec.status !== "领取任务" && (
                          <span className={cn("inline-flex items-center rounded-[3px] border px-1.5 py-0.5 text-[10.5px] font-medium leading-none", stage.color)}>
                            {stage.text}
                          </span>
                        )}
                        <span className="text-[11.5px] text-[#6b7280]">{rec.operator}</span>
                      </div>
                      <div className="mt-1.5 text-[11.5px] text-[#9ca3af]">{rec.time}</div>
                      {isOpinionNode && (
                        <div className="mt-3 flex flex-col gap-2">
                          {hasOpinionRecords ? (
                            rec.opinionRecords!.map((op) => {
                              const hasText = !!op.text.trim()
                              const hasImages = op.images.length > 0
                              if (!hasText && !hasImages) return null
                              return (
                                <div key={op.id} className="rounded-[5px] border border-[#fef08a] bg-[#fffbeb] px-3 py-2.5">
                                  {hasText && (
                                    <p className="text-[12px] leading-relaxed text-[#78350f] whitespace-pre-wrap">{op.text}</p>
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

        {/* 底部操作栏 */}
        <div className="shrink-0 border-t border-[#e5e7eb] px-5 py-3">
          <button
            onClick={onClose}
            className="w-full rounded-[6px] border border-[#d1d5db] py-1.5 text-[13px] text-[#374151] hover:bg-[#f5f6f7] transition-colors"
          >
            关闭
          </button>
        </div>
      </div>

      {previewGallery && <ImageGalleryModal images={previewGallery.images} initialIndex={previewGallery.index} onClose={() => setPreviewGallery(null)} zIndex={130} />}
    </>
  )
}

// ─── Script Detail Drawer ─────────────────────────────────────────────────────
const scriptDetailMockMap: Record<number, string> = {}

// ─── Script Detail Drawer ─────────────────────────────────────────────────────

function buildTaskDetailNodes(episodeCount: number): EditorNode[] {
  const paragraphCount = sharedParagraphs.length
  const gap = Math.max(3, Math.floor(paragraphCount / Math.max(episodeCount, 2)))
  const breakpointIndices = new Set<number>()
  for (let ep = 1; ep < episodeCount; ep++) {
    const idx = Math.min(ep * gap - 1, paragraphCount - 2)
    if (idx > 0) breakpointIndices.add(idx)
  }
  const result: EditorNode[] = []
  let counter = 0
  const nextId = () => `td-${counter++}`
  sharedParagraphs.forEach((text, i) => {
    result.push({ type: "paragraph", id: nextId(), html: text })
    if (breakpointIndices.has(i)) {
      result.push({ type: "orange-divider", id: nextId(), deletable: false })
    }
  })
  result.push({ type: "orange-divider", id: nextId(), deletable: false })
  return result
}

function TaskReadonlyOrangeDivider({
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

function TaskScriptDetailDrawer({
  row,
  onClose,
}: {
  row: TaskRow
  onClose: () => void
}) {
  const paidEpisode = row.payEpisode ?? ""
  const paidEpisodeNum = paidEpisode
    ? parseInt(paidEpisode.replace(/[^0-9]/g, ""), 10)
    : null

  const nodes = (() => {
    const content = row.scriptContent ?? ""
    const paragraphs = content.split("\n").filter((s) => s.trim())
    if (paragraphs.length === 0) return buildTaskDetailNodes(row.episodeCount)

    let dividerPositions: number[] = []
    try {
      if (row.scriptPayBreakpointData) dividerPositions = JSON.parse(row.scriptPayBreakpointData)
    } catch { /* ignore */ }
    const dividerSet = new Set(dividerPositions)

    const built: EditorNode[] = []
    let counter = 0
    const nextId = () => `td-${counter++}`
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
  const [previewGallery, setPreviewGallery] = useState<{ images: string[]; index: number } | null>(null)

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

  const infoFields = [
    { label: "任务名称", value: row.scriptName, mono: false },
    { label: "剧本ID", value: row.scriptId, mono: true },
    { label: "集数", value: `${row.episodeCount} 集`, mono: false },
    { label: "画风类型", value: row.artStyle, mono: false },
    { label: "视觉效果", value: row.visualEffect, mono: false },
    { label: "画面比例", value: row.aspectRatio, mono: false },
    { label: row.taskType === "修改" ? "修改意见" : "制作备注", value: row.taskType === "修改" ? "" : (row.productionRemark || "--"), mono: false },
  ]

  // 修改类型：从 auditRecords 中收集所有"发起成片修改/驳回修改"节点的 opinionRecords
  const modifyOpinionRecords: (OpinionRecord & { recordId: string })[] = []
  if (row.taskType === "修改") {
    row.auditRecords.forEach((rec) => {
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
          {/* 左侧只读正文 */}
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
                        <TaskReadonlyOrangeDivider
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

// ─── Task Badges ─────────────────────────────────────────────────────────────

function TaskTypeBadge({ type }: { type: string }) {
  const cfg: Record<string, { bg: string; text: string; border: string }> = {
    "制作": { bg: "bg-[#eff6ff]", text: "text-[#2563eb]", border: "border-[#bfdbfe]" },
    "修改": { bg: "bg-[#fff7ed]", text: "text-[#c2410c]", border: "border-[#fed7aa]" },
  }
  const c = cfg[type] ?? { bg: "bg-[#f3f4f6]", text: "text-[#6b7280]", border: "border-[#e5e7eb]" }
  return (
    <span className={cn("inline-flex items-center rounded-[4px] border px-2 py-0.5 text-[11.5px] font-medium", c.bg, c.text, c.border)}>
      {type}
    </span>
  )
}

function TaskProgressBadge({ progress }: { progress: string }) {
  const cfg: Record<string, { bg: string; text: string; border: string }> = {
    "待认领": { bg: "bg-[#eff6ff]", text: "text-[#2563eb]", border: "border-[#bfdbfe]" },
    "初版制作中": { bg: "bg-[#fffbeb]", text: "text-[#d97706]", border: "border-[#fde68a]" },
    "初版审核中": { bg: "bg-[#fdf4ff]", text: "text-[#9333ea]", border: "border-[#e9d5ff]" },
    "终版制作中": { bg: "bg-[#fff7ed]", text: "text-[#c2410c]", border: "border-[#fed7aa]" },
    "终版审核中": { bg: "bg-[#fdf2f8]", text: "text-[#be185d]", border: "border-[#fbcfe8]" },
    "修改版制作中": { bg: "bg-[#fffbeb]", text: "text-[#d97706]", border: "border-[#fde68a]" },
    "修改版审核中": { bg: "bg-[#fdf4ff]", text: "text-[#9333ea]", border: "border-[#e9d5ff]" },
    "已完成": { bg: "bg-[#ecfdf5]", text: "text-[#059669]", border: "border-[#a7f3d0]" },
    "已取消": { bg: "bg-[#f3f4f6]", text: "text-[#6b7280]", border: "border-[#e5e7eb]" },
  }
  const c = cfg[progress] ?? cfg["已取消"]
  return (
    <span className={cn("inline-flex items-center rounded-[4px] border px-2 py-0.5 text-[11.5px] font-medium", c.bg, c.text, c.border)}>
      {progress}
    </span>
  )
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────

function ConfirmDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/30" style={{ zIndex: 200 }} onClick={onCancel} />
      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[360px] rounded-[8px] bg-white p-6 shadow-xl"
        style={{ zIndex: 201 }}
      >
        <p className="mb-5 text-[14px] text-[#374151]">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-[6px] border border-[#d1d5db] bg-white px-5 py-1.5 text-[13px] text-[#374151] hover:bg-[#f9fafb] transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="rounded-[6px] bg-[#f04438] px-5 py-1.5 text-[13px] font-medium text-white hover:bg-[#d03025] transition-colors"
          >
            确认取消任务
          </button>
        </div>
      </div>
    </>
  )
}

const taskHallMock: TaskRow[] = []

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TaskHall() {
  const [data, setData] = useState<TaskRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const { draft: filters, active: applied, update: setField, apply: applyFilters, reset: resetFilters } = useFilters(defaultFilters)
  const { page, pageSize, setPage, resetPage, paginationProps } = usePagination(10)
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [detailRow, setDetailRow] = useState<TaskRow | null>(null)
  const [auditDrawerRow, setAuditDrawerRow] = useState<TaskRow | null>(null)
  const [remarkTip, setRemarkTip] = useState<{ text: string; x: number; y: number } | null>(null)

  const canDetail = usePerm("comicMake.hall.detail")
  const canTake = usePerm("comicMake.hall.take")
  const canCancel = usePerm("comicMake.hall.cancel")
  const canLog = usePerm("comicMake.hall.log")

  function handleTaskTypeChange(val: string) {
    setField("taskType", val)
    setField("taskProgress", "")
  }

  function handleQuery() { applyFilters(); resetPage() }
  function handleReset() { resetFilters(); resetPage() }

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    try {
      const a = applied
      const params: Record<string, string | number> = {
        page,
        pageSize,
      }
      if (a.scriptName.trim()) params.taskName = a.scriptName.trim()
      if (a.scriptId.trim()) params.scriptId = a.scriptId.trim()
      if (a.artStyle) params.artStyle = a.artStyle
      if (a.visualEffect) params.visualEffect = a.visualEffect
      if (a.aspectRatio) params.aspectRatio = a.aspectRatio
      if (a.taskType) params.taskType = a.taskType
      if (a.taskProgress) params.taskProgress = a.taskProgress
      if (a.initiator.trim()) params.initiator = a.initiator.trim()
      if (a.producer.trim()) params.producer = a.producer.trim()
      if (a.publishTimeRange.length === 2) {
        params.startDate = a.publishTimeRange[0]
        params.endDate = a.publishTimeRange[1]
      }
      const res = await productionTaskApi.hall(params)
      const list = (res.list ?? []).map(mapApiTaskToRow)
      setTotal(res.total ?? 0)
      setData(list)
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

  async function handleClaim(id: number) {
    try {
      await productionTaskApi.claim(id)
      toast.success("领取成功")
      await fetchTasks()
    } catch (e) {
      toast.errorFrom(e, "领取失败")
    }
  }

  async function handleCancelConfirm(id: number) {
    try {
      await productionTaskApi.cancel(id)
      setConfirmId(null)
      toast.success("任务已取消")
      await fetchTasks()
    } catch (e) {
      toast.errorFrom(e, "取消失败")
    }
  }

  async function openTaskDetail(id: number) {
    try {
      const [detail, logs] = await Promise.all([
        productionTaskApi.detail(id),
        productionTaskApi.auditLogs(id),
      ])
      const auditRecords = mapAuditLogsToRecords(logs ?? [])
      setDetailRow(mapDetailToTaskRow(detail, auditRecords))
    } catch (e) {
      toast.errorFrom(e, "加载详情失败")
    }
  }

  async function openAuditDrawer(row: TaskRow) {
    try {
      const logs = await productionTaskApi.auditLogs(row.id)
      const auditRecords = mapAuditLogsToRecords(logs ?? [])
      setAuditDrawerRow({ ...row, auditRecords })
    } catch (e) {
      toast.errorFrom(e, "加载审核记录失败")
    }
  }

  const pagedData = data

  const columns = [
    { label: "任务名称", w: "" },
    { label: "剧本ID", w: "" },
    { label: "集数", w: "" },
    { label: "画风类型", w: "" },
    { label: "视觉效果", w: "" },
    { label: "画面比例", w: "" },
    { label: "制作备注", w: "" },
    { label: "发布时间", w: "" },
    { label: "任务类型", w: "" },
    { label: "任务进度", w: "" },
    { label: "发起人", w: "" },
    { label: "制作人", w: "" },
    { label: "操作", w: "w-px" },
  ]

  const confirmRow = data.find((t) => t.id === confirmId)
  const progressOptions = filters.taskType ? TASK_HALL_PROGRESS_BY_TYPE[filters.taskType] ?? [] : []

  return (
    <>
      <div className="flex flex-col gap-0 rounded-lg border border-[#e5e7eb] bg-white flex-1 min-h-0">

        {/* Filter area */}
        <div className="border-b border-[#e5e7eb] px-5 py-4">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <FilterInput
              label="任务名称" placeholder="请输入任务名称"
              value={filters.scriptName} onChange={(v) => setField("scriptName", v)} width="w-[150px]"
            />
            <FilterInput
              label="剧本ID" placeholder="请输入剧本ID"
              value={filters.scriptId} onChange={(v) => setField("scriptId", v)} width="w-[160px]"
            />
            <SelectFilter label="画风类型" options={ART_STYLE_OPTIONS} value={filters.artStyle} onChange={(v) => setField("artStyle", v)} width="w-[110px]" />
            <SelectFilter label="视觉效果" options={VISUAL_EFFECT_OPTIONS} value={filters.visualEffect} onChange={(v) => setField("visualEffect", v)} width="w-[90px]" />
            <SelectFilter label="画面比例" options={ASPECT_RATIO_OPTIONS} value={filters.aspectRatio} onChange={(v) => setField("aspectRatio", v)} width="w-[110px]" />
            <div className="flex items-center gap-2">
              <span className="whitespace-nowrap text-[13px] text-[#374151]">发布时间</span>
              <DateRangePicker value={filters.publishTimeRange} onChange={(v) => setField("publishTimeRange", v)} />
            </div>
            <SelectFilter label="任务类型" options={TASK_TYPE_OPTIONS} value={filters.taskType} onChange={handleTaskTypeChange} width="w-[90px]" />
            {/* 任务进度：联动禁用 */}
            <div className="flex items-center gap-2">
              <span className="whitespace-nowrap text-[13px] text-[#374151]">任务进度</span>
              {filters.taskType ? (
                <SelectFilter label="" options={progressOptions} value={filters.taskProgress} onChange={(v) => setField("taskProgress", v)} width="w-[130px]" />
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
              label="发起人" placeholder="请输入发起人"
              value={filters.initiator} onChange={(v) => setField("initiator", v)} width="w-[130px]"
            />
            <FilterInput
              label="制作人" placeholder="请输入制作人"
              value={filters.producer} onChange={(v) => setField("producer", v)} width="w-[130px]"
            />
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={handleQuery}
                className="flex h-[30px] items-center gap-1.5 rounded-[6px] bg-[#38c08f] px-4 text-[13px] font-medium text-white hover:bg-[#2da87a] transition-colors"
              >
                <Search size={13} />查询
              </button>
              <button
                onClick={handleReset}
                className="flex h-[30px] items-center gap-1.5 rounded-[6px] border border-[#d1d5db] bg-white px-4 text-[13px] text-[#374151] hover:bg-[#f5f6f7] transition-colors"
              >
                <RotateCcw size={13} />重置
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-x-auto">
          <table className="w-full min-w-[1400px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#f9fafb]">
                {columns.map(({ label, w }) => (
                  <th key={label} className={cn("sticky top-0 z-10 border-b border-[#e5e7eb] bg-[#f9fafb] px-4 py-3 text-left text-[12.5px] font-medium text-[#6b7280] whitespace-nowrap", w)}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="py-12 text-center text-[13px] text-[#9ca3af]">{loading ? "加载中…" : "暂无数据"}</td>
                </tr>
              ) : (
                pagedData.map((row, i) => (
                  <tr
                    key={row.id}
                    className={cn("transition-colors hover:bg-[#f9fafb]", i < pagedData.length - 1 && "border-b border-[#f3f4f6]")}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      {canDetail ? (
                        <button
                          onClick={() => void openTaskDetail(row.id)}
                          className="text-left text-[13px] font-medium text-[#2563eb] hover:text-[#1d4ed8] hover:underline transition-colors"
                        >
                          {row.scriptName}
                        </button>
                      ) : (
                        <span className="text-left text-[13px] font-medium text-[#111827]">{row.scriptName}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] text-[#4b5563] whitespace-nowrap">{row.scriptId}</td>
                    <td className="px-4 py-3 text-[#4b5563] whitespace-nowrap">{row.episodeCount}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center rounded-[4px] border border-[#ddd6fe] bg-[#f5f3ff] px-2 py-0.5 text-[11.5px] font-medium text-[#7c3aed]">
                        {row.artStyle}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center rounded-[4px] border border-[#bfdbfe] bg-[#eff6ff] px-2 py-0.5 text-[11.5px] font-medium text-[#2563eb]">
                        {row.visualEffect}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[12.5px] text-[#4b5563] whitespace-nowrap">{row.aspectRatio}</td>
                    <td className="px-4 py-3 text-[12.5px] text-[#6b7280] whitespace-nowrap">
                      {row.taskType === "修改" ? <span className="text-[#d1d5db]">--</span> : row.productionRemark ? (
                        <span
                          className="cursor-default"
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect()
                            setRemarkTip({ text: row.productionRemark, x: rect.left, y: rect.bottom + 4 })
                          }}
                          onMouseLeave={() => setRemarkTip(null)}
                        >
                          {row.productionRemark.replace(/\n/g, " ")}
                        </span>
                      ) : <span className="text-[#d1d5db]">--</span>}
                    </td>
                    <td className="px-4 py-3 text-[12.5px] text-[#6b7280] whitespace-nowrap">{row.publishTime}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <TaskTypeBadge type={row.taskType} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <TaskProgressBadge progress={row.taskProgress} />
                    </td>
                    <td className="px-4 py-3 text-[12.5px] text-[#374151] whitespace-nowrap">{row.initiator}</td>
                    <td className="px-4 py-3 text-[12.5px] text-[#374151] whitespace-nowrap">
                      {row.producer ? row.producer : <span className="text-[#d1d5db]">--</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {/* 领取任务：仅 制作+待认领 显示 */}
                        {row.taskType === "制作" && row.taskProgress === "待认领" && canTake && (
                          <button
                            onClick={() => handleClaim(row.id)}
                            className="rounded-[4px] border border-[#38c08f] px-2.5 py-1 text-[12px] font-medium text-[#38c08f] hover:bg-[#f0fdf4] transition-colors whitespace-nowrap"
                          >
                            领取任务
                          </button>
                        )}
                        {/* 取消任务：已完成、已取消不显示 */}
                        {row.taskProgress !== "已完成" && row.taskProgress !== "已取消" && canCancel && (
                          <button
                            onClick={() => setConfirmId(row.id)}
                            className="rounded-[4px] border border-[#fca5a5] px-2.5 py-1 text-[12px] text-[#f04438] hover:bg-[#fff1f0] transition-colors whitespace-nowrap"
                          >
                            取消任务
                          </button>
                        )}
                        {/* 审核记录：待认领时不显示 */}
                        {row.taskProgress !== "待认领" && canLog && (
                          <button
                            onClick={() => void openAuditDrawer(row)}
                            className="rounded-[4px] border border-[#2563eb] px-2.5 py-1 text-[12px] font-medium text-[#2563eb] hover:bg-[#eff6ff] transition-colors whitespace-nowrap"
                          >
                            审核记录
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

        {/* Pagination */}
        <ListPagination
          total={total}
          {...paginationProps}
        />
      </div>
      {detailRow && (
        <TaskScriptDetailDrawer
          row={detailRow}
          onClose={() => setDetailRow(null)}
        />
      )}

      {auditDrawerRow && (
        <TaskHallAuditRecordDrawer
          row={auditDrawerRow}
          onClose={() => setAuditDrawerRow(null)}
        />
      )}

      {/* Confirm Dialog */}
      {confirmId !== null && confirmRow && (
        <ConfirmDialog
          message={`确认取消任务「${confirmRow.scriptName}」？取消后状态将变为【已取消】且不可恢复。`}
          onConfirm={() => handleCancelConfirm(confirmId)}
          onCancel={() => setConfirmId(null)}
        />
      )}

      {/* Remark tooltip (fixed, escapes overflow) */}
      {remarkTip && (
        <div
          className="pointer-events-none fixed z-[9999] w-max max-w-[360px] whitespace-pre-wrap rounded-[6px] border border-[#e5e7eb] bg-white px-4 py-3 text-[12.5px] leading-[1.8] text-[#374151] shadow-xl"
          style={{ left: remarkTip.x, top: remarkTip.y }}
        >
          {remarkTip.text}
        </div>
      )}

    </>
  )
}
