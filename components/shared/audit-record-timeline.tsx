"use client"

import { useState } from "react"
import { ZoomIn } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDateTime } from "@/lib/format"
import { ImageGalleryModal } from "./image-gallery-modal"

// ─── Types ────────────────────────────────────────────────────────────────────

/** Canonical audit-log action string, 1:1 with backend consts.Action* values. */
export type AuditAction =
  | "发布任务"
  | "领取任务"
  | "提交审核"
  | "驳回修改"
  | "审核通过"
  | "发起成片修改"
  | "已取消"

/** Stage bucket the action belongs to. Empty string = cross-stage (发布任务/领取任务). */
export type AuditStageType = "" | "全集" | "分集" | "返修版" | "二审"

export interface AuditOpinionImage {
  id: string
  dataUrl: string
  name: string
}

export interface AuditOpinionRecord {
  id: string
  text: string
  images: AuditOpinionImage[]
}

/** UI-shape audit record rendered in the timeline. */
export interface AuditRecord {
  id: number | string
  status: AuditAction
  time: string
  operator: string
  stageType: AuditStageType
  remark?: string
  opinionRecords?: AuditOpinionRecord[]
}

/** Raw API shape returned by `/production-tasks/:id/audit-logs` &
 *  `/comic-review/tasks/:id/logs` (identical schemas). */
export interface AuditLogDTO {
  id: number
  action: string
  stageType: string
  createdAt: string
  operator?: { name?: string } | null
  opinionSnapshot?: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const KNOWN_ACTIONS: AuditAction[] = [
  "发布任务",
  "领取任务",
  "提交审核",
  "驳回修改",
  "审核通过",
  "发起成片修改",
  "已取消",
]

function normalizeAction(action: string): AuditAction {
  if ((KNOWN_ACTIONS as string[]).includes(action)) return action as AuditAction
  return "提交审核"
}

function normalizeStage(stage: string): AuditStageType {
  if (stage === "全集" || stage === "分集" || stage === "返修版" || stage === "二审") {
    return stage
  }
  return ""
}

/**
 * Parse backend `ReviewAuditLog` rows into UI-shape `AuditRecord[]`.
 * Extracts opinion snapshot JSON for 驳回修改 / 发起成片修改 nodes.
 */
export function mapAuditLogsToRecords(logs: AuditLogDTO[]): AuditRecord[] {
  return logs.map((log, idx) => {
    let opinionRecords: AuditOpinionRecord[] | undefined
    if (log.opinionSnapshot) {
      try {
        const parsed = JSON.parse(log.opinionSnapshot) as Array<{
          content?: string
          images?: string[]
        }>
        if (Array.isArray(parsed)) {
          opinionRecords = parsed.map((op, i) => ({
            id: `snap-${log.id}-${i}`,
            text: op.content ?? "",
            images: (op.images ?? []).map((url, j) => ({
              id: `img-${log.id}-${i}-${j}`,
              dataUrl: url,
              name: url.split("/").pop() || `image-${j}.jpg`,
            })),
          }))
        }
      } catch {
        /* malformed snapshot: ignore, render as a plain node */
      }
    }
    return {
      id: log.id ?? idx,
      status: normalizeAction(log.action ?? ""),
      time: formatDateTime(log.createdAt),
      operator: log.operator?.name ?? "",
      stageType: normalizeStage(log.stageType ?? ""),
      opinionRecords,
    }
  })
}

// ─── Style maps ───────────────────────────────────────────────────────────────

const dotColor: Record<AuditAction, string> = {
  "发布任务": "bg-[#0ea5e9] border-[#bae6fd]",
  "领取任务": "bg-[#6366f1] border-[#c7d2fe]",
  "提交审核": "bg-[#9ca3af] border-[#d1d5db]",
  "驳回修改": "bg-[#f59e0b] border-[#fde68a]",
  "审核通过": "bg-[#38c08f] border-[#bbf7d0]",
  "发起成片修改": "bg-[#8b5cf6] border-[#c4b5fd]",
  "已取消": "bg-[#9ca3af] border-[#d1d5db]",
}

const cardStyle: Record<AuditAction, { bg: string; border: string; titleColor: string }> = {
  "发布任务": { bg: "bg-[#f0f9ff]", border: "border-[#bae6fd]", titleColor: "text-[#0369a1]" },
  "领取任务": { bg: "bg-[#eef2ff]", border: "border-[#c7d2fe]", titleColor: "text-[#4338ca]" },
  "提交审核": { bg: "bg-white", border: "border-[#e5e7eb]", titleColor: "text-[#374151]" },
  "驳回修改": { bg: "bg-[#fefce8]", border: "border-[#fef08a]", titleColor: "text-[#a16207]" },
  "审核通过": { bg: "bg-[#f0fdf4]", border: "border-[#bbf7d0]", titleColor: "text-[#16a34a]" },
  "发起成片修改": { bg: "bg-[#f5f3ff]", border: "border-[#c4b5fd]", titleColor: "text-[#7c3aed]" },
  "已取消": { bg: "bg-[#f3f4f6]", border: "border-[#e5e7eb]", titleColor: "text-[#6b7280]" },
}

const stageLabel: Record<Exclude<AuditStageType, "">, { text: string; color: string }> = {
  "全集": { text: "全集", color: "text-[#2563eb] bg-[#eff6ff] border-[#bfdbfe]" },
  "分集": { text: "分集", color: "text-[#16a34a] bg-[#f0fdf4] border-[#bbf7d0]" },
  "返修版": { text: "返修版", color: "text-[#ea580c] bg-[#fff7ed] border-[#fed7aa]" },
  "二审": { text: "二审", color: "text-[#7c3aed] bg-[#f5f3ff] border-[#ddd6fe]" },
}

// ─── Filtering ────────────────────────────────────────────────────────────────

/** 制作类型展示 全集 + 分集 + 二审；修改类型展示 返修版。
 *  跨阶段节点（发布任务 / 领取任务）在任一视图下都展示。 */
export function filterRecordsByTaskType(
  records: AuditRecord[],
  taskType: "制作" | "修改",
): AuditRecord[] {
  return records.filter((r) => {
    if (r.stageType === "") return true
    if (taskType === "制作") {
      return r.stageType === "全集" || r.stageType === "分集" || r.stageType === "二审"
    }
    return r.stageType === "返修版"
  })
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface AuditRecordTimelineProps {
  records: AuditRecord[]
  /** When provided, records are filtered by task type (制作 / 修改).
   *  When undefined, all records are shown as-is. */
  taskType?: "制作" | "修改"
  /** Shown when records is empty. */
  emptyLabel?: string
  /** Shown while parent is still fetching. */
  loading?: boolean
  loadingLabel?: string
  /** Override image resolution (e.g. `assetUrl`). */
  resolveImageSrc?: (url: string) => string
  /** z-index for the nested image gallery modal. */
  galleryZIndex?: number
}

export function AuditRecordTimeline({
  records,
  taskType,
  emptyLabel = "暂无审核记录",
  loading = false,
  loadingLabel = "加载中…",
  resolveImageSrc,
  galleryZIndex = 130,
}: AuditRecordTimelineProps) {
  const [previewGallery, setPreviewGallery] = useState<{
    images: string[]
    index: number
  } | null>(null)

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <p className="text-[13px] text-[#9ca3af]">{loadingLabel}</p>
      </div>
    )
  }

  const visible = taskType ? filterRecordsByTaskType(records, taskType) : records

  if (visible.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f3f4f6]">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="h-5 w-5 text-[#9ca3af]"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12h6m-6 4h6M9 8h.01M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
            />
          </svg>
        </div>
        <p className="text-[13px] text-[#9ca3af]">{emptyLabel}</p>
      </div>
    )
  }

  return (
    <>
      <div className="relative pl-6">
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[#e5e7eb]" />

        {visible.map((rec, idx, arr) => {
          const card = cardStyle[rec.status] ?? cardStyle["提交审核"]
          const dot = dotColor[rec.status] ?? "bg-[#9ca3af] border-[#d1d5db]"
          const stage = rec.stageType ? stageLabel[rec.stageType] : null
          const isOpinionNode =
            rec.status === "驳回修改" || rec.status === "发起成片修改"
          const hasOpinionRecords =
            isOpinionNode &&
            rec.opinionRecords &&
            rec.opinionRecords.length > 0
          const isLast = idx === arr.length - 1

          return (
            <div key={rec.id} className={cn("relative", isLast ? "mb-0" : "mb-4")}>
              <div
                className={cn(
                  "absolute -left-6 top-[11px] h-[13px] w-[13px] rounded-full border-2",
                  dot,
                )}
              />

              <div
                className={cn(
                  "rounded-[6px] border px-3.5 py-3",
                  card.bg,
                  card.border,
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex-1 text-[12.5px] font-semibold leading-none",
                      card.titleColor,
                    )}
                  >
                    {rec.status}
                  </span>
                  {stage && (
                    <span
                      className={cn(
                        "inline-flex items-center rounded-[3px] border px-1.5 py-0.5 text-[10.5px] font-medium leading-none",
                        stage.color,
                      )}
                    >
                      {stage.text}
                    </span>
                  )}
                  {rec.operator && (
                    <span className="text-[11.5px] text-[#6b7280]">{rec.operator}</span>
                  )}
                </div>

                <div className="mt-1.5 text-[11.5px] text-[#9ca3af]">{rec.time}</div>

                {isOpinionNode && (
                  <div className="mt-3 flex flex-col gap-2">
                    {hasOpinionRecords ? (
                      rec.opinionRecords!.map((op, opIdx) => {
                        const hasText = !!op.text.trim()
                        const hasImages = op.images.length > 0
                        if (!hasText && !hasImages) return null
                        return (
                          <div
                            key={op.id}
                            className="rounded-[5px] border border-[#fef08a] bg-[#fffbeb] px-3 py-2.5"
                          >
                            <div className="mb-1.5 flex items-center gap-1.5">
                              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#f59e0b] text-[9.5px] font-bold leading-none text-white">
                                {opIdx + 1}
                              </span>
                            </div>
                            {hasText && (
                              <p className="text-[12px] leading-relaxed text-[#78350f] whitespace-pre-wrap">
                                {op.text}
                              </p>
                            )}
                            {hasImages && (
                              <div
                                className={cn(
                                  "flex flex-wrap gap-1.5",
                                  hasText ? "mt-2" : "",
                                )}
                              >
                                {op.images.map((img, imgIdx) => (
                                  <div
                                    key={img.id}
                                    className="group relative h-14 w-14 shrink-0 cursor-pointer overflow-hidden rounded-[4px] border border-[#fde68a] bg-white"
                                    onClick={() =>
                                      setPreviewGallery({
                                        images: op.images.map((m) => m.dataUrl),
                                        index: imgIdx,
                                      })
                                    }
                                  >
                                    <img
                                      src={resolveImageSrc ? resolveImageSrc(img.dataUrl) : img.dataUrl}
                                      alt={img.name}
                                      className="h-full w-full object-cover"
                                    />
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

      {previewGallery && (
        <ImageGalleryModal
          images={previewGallery.images}
          initialIndex={previewGallery.index}
          onClose={() => setPreviewGallery(null)}
          zIndex={galleryZIndex}
          resolveSrc={resolveImageSrc}
        />
      )}
    </>
  )
}
