"use client"

import { cn } from "@/lib/utils"
import { formatDateTime } from "@/lib/format"

// ─── Types ────────────────────────────────────────────────────────────────────

/** 剧本审核日志动作，与后端 consts.Action* / DraftStatus* 对齐。 */
export type ScriptAuditAction =
  | "提交审核"
  | "领取任务"
  | "驳回修改"
  | "审核通过"
  | "审核不通过"

/** 时间线节点 UI 数据。 */
export interface ScriptAuditNode {
  time: string
  operator: string
  action: string
  remark?: string
}

/** 后端 `ScriptAuditLog` 的接口响应形状（剧本创作 / 剧本审核共用）。 */
export interface ScriptAuditLogDTO {
  id?: number
  createdAt?: string
  action?: string
  opinion?: string
  operator?: { name?: string } | null
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

/** 将后端 `ScriptAuditLog` 列表映射为时间线节点。 */
export function mapScriptAuditLogsToNodes(
  logs: ScriptAuditLogDTO[],
): ScriptAuditNode[] {
  return logs.map((log) => ({
    time: formatDateTime(log.createdAt),
    operator: log.operator?.name ?? "",
    action: log.action ?? "",
    remark: log.opinion && log.opinion.trim() ? log.opinion : undefined,
  }))
}

// ─── Style map（按剧本创作为准：领取任务 = 橙色） ──────────────────────────────

const nodeStyle: Record<string, { dot: string; bg: string; text: string }> = {
  提交审核: {
    dot: "border-[#9ca3af] bg-white",
    bg: "bg-[#f9fafb]",
    text: "text-[#374151]",
  },
  领取任务: {
    dot: "border-[#f97316] bg-white",
    bg: "bg-[#fff7ed]",
    text: "text-[#ea580c]",
  },
  驳回修改: {
    dot: "border-[#d97706] bg-white",
    bg: "bg-[#fffbeb]",
    text: "text-[#d97706]",
  },
  审核通过: {
    dot: "border-[#059669] bg-[#059669]",
    bg: "bg-[#ecfdf5]",
    text: "text-[#059669]",
  },
  审核不通过: {
    dot: "border-[#dc2626] bg-[#dc2626]",
    bg: "bg-[#fef2f2]",
    text: "text-[#dc2626]",
  },
}

const defaultNodeStyle = {
  dot: "border-[#9ca3af] bg-white",
  bg: "bg-[#f9fafb]",
  text: "text-[#374151]",
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface ScriptAuditTimelineProps {
  records: ScriptAuditNode[]
  loading?: boolean
  emptyLabel?: string
  loadingLabel?: string
}

export function ScriptAuditTimeline({
  records,
  loading = false,
  emptyLabel = "暂无审核记录",
  loadingLabel = "加载中...",
}: ScriptAuditTimelineProps) {
  if (loading) {
    return (
      <div className="py-12 text-center text-[13px] text-[#9ca3af]">
        {loadingLabel}
      </div>
    )
  }

  if (records.length === 0) {
    return (
      <div className="py-12 text-center text-[13px] text-[#9ca3af]">
        {emptyLabel}
      </div>
    )
  }

  return (
    <div className="relative pl-5">
      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[#e5e7eb]" />
      <div className="flex flex-col gap-4">
        {records.map((node, i) => {
          const style = nodeStyle[node.action] ?? defaultNodeStyle
          return (
            <div key={i} className="relative">
              <span
                className={cn(
                  "absolute -left-[13px] top-[5px] h-2.5 w-2.5 rounded-full border-2",
                  style.dot,
                )}
              />
              <div
                className={cn(
                  "rounded-[6px] border border-[#f3f4f6] px-4 py-3",
                  style.bg,
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn("text-[12.5px] font-medium", style.text)}
                  >
                    {node.action}
                  </span>
                  <span className="text-[11.5px] text-[#9ca3af]">
                    {node.operator}
                  </span>
                </div>
                {node.remark && (
                  <p className="mt-1.5 text-[12px] leading-relaxed text-[#6b7280] whitespace-pre-wrap">
                    {node.remark}
                  </p>
                )}
                <p className="mt-1.5 text-[11px] text-[#9ca3af]">
                  {node.time}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
