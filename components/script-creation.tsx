"use client"

import { useState, useMemo, useRef, useEffect, useCallback } from "react"
import { Search, RotateCcw, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { SelectFilter } from "@/components/shared"
import { scriptDraftApi, bookApi } from "@/lib/api"
import { toast } from "@/lib/toast"
import { ListPagination, type PageSizeOption } from "@/components/list-pagination"
import { usePerm } from "@/components/admin-layout"
import { ScriptEditorDrawer, BookDetail, bookDetailMockMap, sharedParagraphs, TRIAL_PARAGRAPH_INDEX, EditorNode, buildInitialNodes, calcTotalWords, calcEpisodeIndex, calcSegmentWords } from "@/components/book-management"

// ─── 类型定义 ─────────────────────────────────────────────────────────────────

interface AuditRecord {
  time: string
  operator: string
  action: string
  remark: string
}

interface ScriptRow {
  id: string
  bookDbId: number
  scriptName: string
  episodeCount: number
  sourceBookId: string
  scriptType: "原作" | "多版本"
  originalScriptId: string
  auditStatus: "待提审" | "待认领" | "审核中" | "审核通过" | "驳回修改" | "审核不通过"
  reviewer: string
  submitTime: string
  auditRecords: AuditRecord[]
}

// ─── 列表项映射 ───────────────────────────────────────────────────────────────

function formatDateTime(iso: string | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function mapDraftToRow(d: {
  id: number
  scriptName: string
  episodeCount: number
  bookId: number
  book?: { bookId?: string }
  scriptType: string
  originalScriptId?: number | null
  originalScript?: { scriptId?: string } | null
  auditStatus: string
  reviewer?: { name?: string } | null
  createdAt: string
  updatedAt: string
}): ScriptRow {
  const origBizId = d.originalScript?.scriptId
  return {
    id: String(d.id),
    bookDbId: d.bookId,
    scriptName: d.scriptName,
    episodeCount: d.episodeCount,
    sourceBookId: d.book?.bookId ?? String(d.bookId),
    scriptType: d.scriptType as ScriptRow["scriptType"],
    originalScriptId: origBizId ? String(origBizId) : "",
    auditStatus: d.auditStatus as ScriptRow["auditStatus"],
    reviewer: d.reviewer?.name ?? "",
    submitTime: formatDateTime(d.updatedAt || d.createdAt),
    auditRecords: [],
  }
}

const draftMock: ScriptRow[] = []

// ─── 默认筛选值 ───────────────────────────────────────────────────────────────

const defaultFilters = {
  scriptName: "",
  sourceBookId: "",
  scriptType: "",
  originalScriptId: "",
  auditStatus: "",
  reviewer: "",
}

// ─── 选项配置 ─────────────────────────────────────────────────────────────────

const scriptTypeOptions = [
  { label: "原作", value: "原作" },
  { label: "多版本", value: "多版本" },
]

const auditStatusOptions = [
  { label: "待提审", value: "待提审" },
  { label: "待认领", value: "待认领" },
  { label: "审核中", value: "审核中" },
  { label: "审核通过", value: "审核通过" },
  { label: "驳回修改", value: "驳回修改" },
  { label: "审核不通过", value: "审核不通过" },
]

// ─── 状态样式 ─────────────────────────────────────────────────────────────────

const auditStatusStyle: Record<string, { bg: string; text: string }> = {
  待提审: { bg: "bg-[#f3f4f6]", text: "text-[#6b7280]" },
  待认领: { bg: "bg-[#eff6ff]", text: "text-[#2563eb]" },
  审核中: { bg: "bg-[#fff7ed]", text: "text-[#ea580c]" },
  审核通过: { bg: "bg-[#ecfdf5]", text: "text-[#059669]" },
  驳回修改: { bg: "bg-[#fffbeb]", text: "text-[#d97706]" },
  审核不通过: { bg: "bg-[#fef2f2]", text: "text-[#dc2626]" },
}


// ─── 审核记录节点样式（与剧本审核保持一致）──────────────────────────────────────

const auditActionStyle: Record<string, { dot: string; bg: string; text: string }> = {
  "提交审核": { dot: "border-[#9ca3af] bg-white", bg: "bg-[#f9fafb]", text: "text-[#374151]" },
  "领取任务": { dot: "border-[#f97316] bg-white", bg: "bg-[#fff7ed]", text: "text-[#ea580c]" },
  "驳回修改": { dot: "border-[#d97706] bg-white", bg: "bg-[#fffbeb]", text: "text-[#d97706]" },
  "审核通过": { dot: "border-[#059669] bg-[#059669]", bg: "bg-[#ecfdf5]", text: "text-[#059669]" },
  "审核不通过": { dot: "border-[#dc2626] bg-[#dc2626]", bg: "bg-[#fef2f2]", text: "text-[#dc2626]" },
}

// ─── 审核记录抽屉 ─────────────────────────────────────────────────────────────

function AuditRecordDrawer({
  row,
  records,
  loading,
  onClose,
}: {
  row: ScriptRow | null
  records: AuditRecord[]
  loading: boolean
  onClose: () => void
}) {
  if (!row) return null

  return (
    <>
      {/* 遮罩 */}
      <div
        className="fixed inset-0 z-[40] bg-black/20"
        onClick={onClose}
      />
      {/* 抽屉 */}
      <div className="fixed right-0 top-0 z-[50] flex h-full w-[420px] flex-col bg-white shadow-2xl">
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-[#e5e7eb] px-5 py-4">
          <div>
            <p className="text-[14px] font-semibold text-[#111827]">审核记录</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-[6px] text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#374151] transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* 记录列表 */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="py-12 text-center text-[13px] text-[#9ca3af]">加载中...</div>
          ) : records.length === 0 ? (
            <div className="py-12 text-center text-[13px] text-[#9ca3af]">暂无审核记录</div>
          ) : (
            <div className="relative pl-5">
              {/* 时间轴竖线 */}
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[#e5e7eb]" />
              <div className="flex flex-col gap-4">
                {records.map((r, i) => {
                  const style = auditActionStyle[r.action] ?? {
                    dot: "border-[#9ca3af] bg-white",
                    bg: "bg-[#f9fafb]",
                    text: "text-[#374151]",
                  }
                  return (
                    <div key={i} className="relative">
                      {/* 圆点 */}
                      <span
                        className={cn(
                          "absolute -left-[13px] top-[5px] h-2.5 w-2.5 rounded-full border-2",
                          style.dot
                        )}
                      />
                      <div className={cn("rounded-[6px] border border-[#f3f4f6] px-4 py-3", style.bg)}>
                        <div className="flex items-center justify-between">
                          <span className={cn("text-[12px] font-medium", style.text)}>{r.action}</span>
                          <span className="text-[11px] text-[#9ca3af]">{r.operator}</span>
                        </div>
                        {r.remark && (
                          <p className="mt-1 text-[12px] text-[#6b7280] whitespace-pre-wrap">{r.remark}</p>
                        )}
                        <p className="mt-1.5 text-[11px] text-[#9ca3af]">{r.time}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="border-t border-[#e5e7eb] px-5 py-3">
          <button
            onClick={onClose}
            className="w-full rounded-[6px] border border-[#d1d5db] py-1.5 text-[13px] text-[#374151] hover:bg-[#f5f6f7] transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </>
  )
}

// ─── 删除确认弹层 ─────────────────────────────────────────────────────────────

function DeleteConfirmModal({
  row,
  onConfirm,
  onCancel,
}: {
  row: ScriptRow | null
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!row) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/25">
      <div className="w-[360px] rounded-[10px] bg-white shadow-2xl">
        <div className="px-6 pt-5 pb-4">
          <p className="text-[15px] font-semibold text-[#111827]">确认删除</p>
          <p className="mt-2 text-[13px] text-[#4b5563]">
            确定要删除剧本 <span className="font-medium text-[#111827]">「{row.scriptName}」</span> 吗？删除后无法恢复。
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[#f3f4f6] px-6 py-3">
          <button
            onClick={onCancel}
            className="rounded-[6px] border border-[#d1d5db] bg-white px-4 py-1.5 text-[13px] text-[#374151] hover:bg-[#f5f6f7] transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="rounded-[6px] bg-[#dc2626] px-4 py-1.5 text-[13px] font-medium text-white hover:bg-[#b91c1c] transition-colors"
          >
            确认删除
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── 进入工作台：构建 BookDetail ──────────────────────────────────────────────

function buildScriptDetail(row: ScriptRow): BookDetail {
  // 优先从 bookDetailMockMap 取已有 detail，否则构造一个
  const existing = bookDetailMockMap[row.sourceBookId]
  if (existing) return existing
  return {
    bookId: row.sourceBookId,
    bookName: row.scriptName,
    totalWordCount: 12000,
    trialWordCount: 704,
    breakpointLabel: `原书：试读字数704字，占全文6%`,
    contentParagraphs: sharedParagraphs,
  }
}

// ─── 剧本详情 mock 数据映射 ───────────────────────────────────────────────────

// 每条剧本对应一个详情，包含正文 + 分集线位置
interface ScriptBreakpoint { afterParagraphIdx: number; label: string }
interface ScriptDetailData {
  id: string
  scriptName: string
  totalWordCount: number
  trialWordCount: number
  breakpointLabel: string
  contentParagraphs: string[]
  scriptBreakpoints: ScriptBreakpoint[]
}

// 构建详情数据（复用 sharedParagraphs，按集数切分位置）
function buildScriptDetailData(row: ScriptRow): ScriptDetailData {
  const paragraphCount = sharedParagraphs.length
  const breakpoints: ScriptBreakpoint[] = []
  const gap = Math.max(3, Math.floor(paragraphCount / Math.max(row.episodeCount, 2)))
  for (let ep = 1; ep < row.episodeCount; ep++) {
    const idx = Math.min(ep * gap - 1, paragraphCount - 2)
    if (idx > 0 && !breakpoints.find(b => b.afterParagraphIdx === idx)) {
      breakpoints.push({
        afterParagraphIdx: idx,
        label: `第${ep}集`,
      })
    }
  }
  return {
    id: row.id,
    scriptName: row.scriptName,
    totalWordCount: 12000,
    trialWordCount: 704,
    breakpointLabel: `原书：试读字数704字，占全文6%`,
    contentParagraphs: sharedParagraphs,
    scriptBreakpoints: breakpoints,
  }
}

// ─── 只读橙色分集线 ───────────────────────────────────────────────────────────

function ReadonlyOrangeDivider({ nodes, nodeId }: { nodes: EditorNode[]; nodeId: string }) {
  const idx = nodes.findIndex((n) => n.id === nodeId)
  const episodeNum = calcEpisodeIndex(nodes, nodeId)
  const wordCount = calcSegmentWords(nodes, idx)
  return (
    <div className="my-1 flex select-none items-center gap-2 py-0.5">
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

// ─── 剧本详情抽屉（只读） ─────────────────────────────────────────────────────

function ScriptDetailDrawer({
  row,
  onClose,
}: {
  row: ScriptRow
  onClose: () => void
}) {
  const [nodes, setNodes] = useState<EditorNode[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const [draft, book] = await Promise.all([
          scriptDraftApi.detail(Number(row.id)),
          bookApi.detail(row.bookDbId).catch(() => null),
        ])

        if (cancelled) return

        const draftContent = (draft.content as string) || ""
        const bookContent = book ? (book.content as string) || "" : ""
        const rawText = draftContent.trim() ? draftContent : bookContent
        const paragraphs = rawText.split(/\r?\n/).filter((s: string) => s.trim())
        const breakpointLabel = book?.payBreakpoint || ""

        let dividerPositions: number[] = []
        const bpData = draft.payBreakpointData as string | undefined
        if (bpData) {
          try { dividerPositions = JSON.parse(bpData) } catch { /* ignore */ }
        }

        const dividerSet = new Set(dividerPositions)
        const result: EditorNode[] = []
        let idCounter = 0
        const nextId = () => `ro-${idCounter++}`

        paragraphs.forEach((text: string, i: number) => {
          result.push({ type: "paragraph", id: nextId(), html: text })
          if (i === TRIAL_PARAGRAPH_INDEX - 1 && breakpointLabel) {
            result.push({ type: "blue-divider", id: nextId(), label: breakpointLabel })
          }
          if (dividerSet.has(i)) {
            result.push({ type: "orange-divider", id: nextId(), deletable: false })
          }
        })

        if (dividerPositions.length === 0) {
          result.push({ type: "orange-divider", id: nextId(), deletable: false })
        }

        setNodes(result)
      } catch {
        setNodes([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [row])

  const totalWords = calcTotalWords(nodes)

  return (
    <>
      <div className="fixed inset-0 bg-black/40" style={{ zIndex: 60 }} onClick={onClose} />
      <div
        className="fixed right-0 top-0 flex h-full w-[1040px] flex-col bg-white"
        style={{ zIndex: 61, boxShadow: "-4px 0 32px rgba(0,0,0,0.15)" }}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-[#e5e7eb] px-6 py-4">
          <div>
            <h2 className="text-[15px] font-semibold text-[#111827]">剧本详情</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-[4px] text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#374151] transition-colors"
            aria-label="关闭"
          >
            <X size={16} />
          </button>
        </div>

        {/* 剧本名称（只读展示） */}
        <div className="border-b border-[#e5e7eb] px-6 py-3.5">
          <div className="flex items-center gap-3">
            <span className="whitespace-nowrap text-[13px] font-medium text-[#374151]">剧本名称</span>
            <span className="text-[13px] text-[#111827]">{row.scriptName}</span>
          </div>
        </div>

        {/* 只读内容区 */}
        <div className="relative flex-1 overflow-y-auto bg-[#f9fafb] px-8 py-5">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <span className="text-[13px] text-[#9ca3af]">加载中...</span>
            </div>
          ) : (
          <div className="mx-auto max-w-[860px] rounded-[6px] border border-[#e5e7eb] bg-white px-8 py-6 min-h-full">
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
              if (node.type === "blue-divider") {
                return (
                  <div key={node.id} className="my-6 flex select-none items-center gap-3">
                    <div className="h-px flex-1 bg-[#3b82f6]" />
                    <span className="whitespace-nowrap rounded-[4px] border border-[#3b82f6] bg-[#eff6ff] px-3 py-1 text-[12px] font-medium text-[#2563eb]">
                      {node.label}
                    </span>
                    <div className="h-px flex-1 bg-[#3b82f6]" />
                  </div>
                )
              }
              if (node.type === "orange-divider") {
                return <ReadonlyOrangeDivider key={node.id} nodes={nodes} nodeId={node.id} />
              }
              return null
            })}
          </div>
          )}
        </div>

        {/* 底部：只显示全文字数 */}
        <div className="flex items-center border-t border-[#e5e7eb] bg-white px-6 py-3.5">
          <span className="text-[13px] text-[#6b7280]">
            全文字数：<span className="font-medium text-[#111827]">{totalWords.toLocaleString()} 字</span>
            <span className="mx-2 text-[#d1d5db]">|</span>
            集数：<span className="font-medium text-[#111827]">{Math.max(1, nodes.filter((n) => n.type === "orange-divider").length)} 集</span>
          </span>
        </div>
      </div>
    </>
  )
}

// ─── 主组件 ───────────────────────────────────────────────────────────────────

export default function ScriptCreation() {
  const [data, setData] = useState<ScriptRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({ ...defaultFilters })
  const [applied, setApplied] = useState({ ...defaultFilters })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<PageSizeOption>(10)

  // 弹层状态
  const [auditRow, setAuditRow] = useState<ScriptRow | null>(null)
  const [auditLogs, setAuditLogs] = useState<AuditRecord[]>([])
  const [auditLogsLoading, setAuditLogsLoading] = useState(false)
  const [deleteRow, setDeleteRow] = useState<ScriptRow | null>(null)
  const [workbenchRow, setWorkbenchRow] = useState<ScriptRow | null>(null)
  const [workbenchDetail, setWorkbenchDetail] = useState<BookDetail | null>(null)
  const [detailRow, setDetailRow] = useState<ScriptRow | null>(null)

  const canEdit = usePerm("scriptCreate.edit")
  const canDelete = usePerm("scriptCreate.delete")
  const canLog = usePerm("scriptCreate.log")

  const fetchDrafts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await scriptDraftApi.list({
        page,
        pageSize,
        scriptName: applied.scriptName.trim() || undefined,
        sourceBookId: applied.sourceBookId.trim() || undefined,
        scriptType: applied.scriptType || undefined,
        originalScriptId: applied.originalScriptId.trim() || undefined,
        auditStatus: applied.auditStatus || undefined,
        reviewer: applied.reviewer.trim() || undefined,
      })
      const list = Array.isArray(res.list) ? res.list : []
      setData(list.map((item) => mapDraftToRow(item as Parameters<typeof mapDraftToRow>[0])))
      setTotal(typeof res.total === "number" ? res.total : 0)
    } catch {
      setData([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, applied])

  useEffect(() => {
    void fetchDrafts()
  }, [fetchDrafts])

  useEffect(() => {
    if (!auditRow) {
      setAuditLogs([])
      return
    }
    let cancelled = false
    setAuditLogsLoading(true)
    scriptDraftApi
      .auditLogs(Number(auditRow.id))
      .then((logs) => {
        if (cancelled) return
        const list = Array.isArray(logs) ? logs : []
        setAuditLogs(
          list.map((log: { createdAt?: string; operator?: { name?: string }; action: string; opinion?: string }) => ({
            time: formatDateTime(log.createdAt),
            operator: log.operator?.name ?? "",
            action: log.action,
            remark: log.opinion ?? "",
          }))
        )
      })
      .catch((e) => {
        if (!cancelled) {
          setAuditLogs([])
          toast.error(e instanceof Error ? e.message : "加载审核记录失败")
        }
      })
      .finally(() => {
        if (!cancelled) setAuditLogsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [auditRow])

  function handleQuery() { setApplied({ ...filters }); setPage(1) }
  function handleReset() { setFilters({ ...defaultFilters }); setApplied({ ...defaultFilters }); setPage(1) }
  function setField(key: keyof typeof defaultFilters, val: string) {
    setFilters((prev) => ({ ...prev, [key]: val }))
  }

  async function handleDelete() {
    if (!deleteRow) return
    try {
      await scriptDraftApi.delete(Number(deleteRow.id))
      setDeleteRow(null)
      await fetchDrafts()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "删除失败")
    }
  }

  async function openWorkbench(row: ScriptRow) {
    try {
      const [book, draft] = await Promise.all([
        bookApi.detail(row.bookDbId),
        scriptDraftApi.detail(Number(row.id)),
      ])

      const draftContent = draft.content as string | undefined
      const hasDraftContent = draftContent && draftContent.trim().length > 0
      const sourceParagraphs = (book.content || "").split(/\r?\n/).filter((s: string) => s.trim())
      const draftParagraphs = hasDraftContent
        ? draftContent.split(/\r?\n/).filter((s: string) => s.trim())
        : []
      const paragraphs = draftParagraphs.length > 0 ? draftParagraphs
        : sourceParagraphs.length > 0 ? sourceParagraphs
        : sharedParagraphs

      let dividerPositions: number[] | undefined
      const bpData = draft.payBreakpointData as string | undefined
      if (bpData) {
        try { dividerPositions = JSON.parse(bpData) } catch { /* ignore */ }
      }

      setWorkbenchDetail({
        bookId: book.bookId ?? row.sourceBookId,
        bookName: book.bookName ?? row.scriptName,
        totalWordCount: book.wordCount ?? 0,
        trialWordCount: Math.round((book.wordCount ?? 0) * 0.05),
        breakpointLabel: book.payBreakpoint || "",
        contentParagraphs: paragraphs,
        dividerPositions,
      })
      setWorkbenchRow(row)
    } catch {
      setWorkbenchDetail(null)
      setWorkbenchRow(row)
    }
  }

  // 操作列按钮显示规则
  function showDelete(status: string) { return status === "待提审" }
  function showWorkbench(status: string) { return status === "待提审" || status === "驳回修改" }
  function showAuditRecord(status: string) { return status !== "待提审" }

  const TABLE_HEADERS = ["剧本名称", "集数", "原书ID", "类型", "原剧本ID", "审核状态", "审核员", "操作"]

  return (
    <div className="flex flex-col flex-1 min-h-0 rounded-lg border border-[#e5e7eb] bg-white">


      {/* 筛选区 */}
      <div className="border-b border-[#e5e7eb] px-5 py-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap text-[13px] text-[#374151]">剧本名称</span>
            <input
              type="text" value={filters.scriptName}
              onChange={(e) => setField("scriptName", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleQuery()}
              placeholder="请输入剧本名称"
              className="h-[30px] w-[160px] rounded-[6px] border border-[#d1d5db] bg-white px-3 text-[13px] text-[#374151] placeholder-[#9ca3af] outline-none focus:border-[#38c08f] transition-colors"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap text-[13px] text-[#374151]">原书ID</span>
            <input
              type="text" value={filters.sourceBookId}
              onChange={(e) => setField("sourceBookId", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleQuery()}
              placeholder="请输入原书ID"
              className="h-[30px] w-[160px] rounded-[6px] border border-[#d1d5db] bg-white px-3 text-[13px] text-[#374151] placeholder-[#9ca3af] outline-none focus:border-[#38c08f] transition-colors"
            />
          </div>
          <SelectFilter label="类型" value={filters.scriptType} options={scriptTypeOptions} onChange={(v) => setField("scriptType", v)} width="w-[112px]" />
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap text-[13px] text-[#374151]">原剧本ID</span>
            <input
              type="text" value={filters.originalScriptId}
              onChange={(e) => setField("originalScriptId", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleQuery()}
              placeholder="请输入原剧本ID"
              className="h-[30px] w-[160px] rounded-[6px] border border-[#d1d5db] bg-white px-3 text-[13px] text-[#374151] placeholder-[#9ca3af] outline-none focus:border-[#38c08f] transition-colors"
            />
          </div>
          <SelectFilter label="审核状态" value={filters.auditStatus} options={auditStatusOptions} onChange={(v) => setField("auditStatus", v)} placeholder="请选择状态" width="w-[136px]" />
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap text-[13px] text-[#374151]">审核员</span>
            <input
              type="text" value={filters.reviewer}
              onChange={(e) => setField("reviewer", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleQuery()}
              placeholder="请输入审核员"
              className="h-[30px] w-[120px] rounded-[6px] border border-[#d1d5db] bg-white px-3 text-[13px] text-[#374151] placeholder-[#9ca3af] outline-none focus:border-[#38c08f] transition-colors"
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={handleQuery} className="flex items-center gap-1.5 rounded-[6px] bg-[#38c08f] px-4 py-1.5 text-[13px] font-medium text-white hover:bg-[#2da87a] transition-colors">
              <Search size={13} />查询
            </button>
            <button onClick={handleReset} className="flex items-center gap-1.5 rounded-[6px] border border-[#d1d5db] bg-white px-4 py-1.5 text-[13px] text-[#374151] hover:bg-[#f5f6f7] transition-colors">
              <RotateCcw size={12} />重置
            </button>
          </div>
        </div>
      </div>

      {/* 表格 */}
      <div className="flex-1 overflow-auto min-h-0">
        <table className="w-full min-w-[1120px] border-collapse text-[13px]">
          <thead>
            <tr className="bg-[#f9fafb]">
              {TABLE_HEADERS.map((h) => (
                <th key={h} className="sticky top-0 z-10 border-b border-[#e5e7eb] bg-[#f9fafb] px-4 py-2.5 text-left text-[12.5px] font-medium text-[#6b7280] whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={TABLE_HEADERS.length} className="py-16 text-center text-[13px] text-[#9ca3af]">
                  {loading ? "加载中..." : "暂无匹配数据"}
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
                  {/* 剧本名称 */}
                  <td className="px-4 py-3 font-medium max-w-[200px]">
                    <button
                      onClick={() => setDetailRow(row)}
                      className="line-clamp-1 block text-left text-[#2563eb] hover:text-[#1d4ed8] hover:underline transition-colors"
                    >
                      {row.scriptName}
                    </button>
                  </td>
                  {/* 集数 */}
                  <td className="px-4 py-3 text-[#4b5563]">{row.episodeCount}</td>
                  {/* 原书ID */}
                  <td className="px-4 py-3 text-[#6b7280] font-mono text-[12px] whitespace-nowrap">{row.sourceBookId}</td>
                  {/* 类型 */}
                  <td className="px-4 py-3">
                    <span className={cn(
                      "inline-flex items-center rounded-[4px] px-2 py-0.5 text-[11.5px] font-medium",
                      row.scriptType === "原作" ? "bg-[#eff6ff] text-[#2563eb]" : "bg-[#f5f3ff] text-[#7c3aed]"
                    )}>
                      {row.scriptType}
                    </span>
                  </td>
                  {/* 原剧本ID */}
                  <td className="px-4 py-3 text-[#6b7280] font-mono text-[12px] whitespace-nowrap">
                    {row.originalScriptId || <span className="font-sans text-[#d1d5db]">--</span>}
                  </td>
                  {/* 审核状态 */}
                  <td className="px-4 py-3">
                    <span className={cn(
                      "inline-flex items-center rounded-[4px] px-2 py-0.5 text-[11.5px] font-medium",
                      auditStatusStyle[row.auditStatus]?.bg,
                      auditStatusStyle[row.auditStatus]?.text
                    )}>
                      {row.auditStatus}
                    </span>
                  </td>
                  {/* 审核员 */}
                  <td className="px-4 py-3 text-[#4b5563]">
                    {row.reviewer || <span className="text-[#d1d5db]">--</span>}
                  </td>
                  {/* 操作列 */}
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {showWorkbench(row.auditStatus) && canEdit && (
                        <button
                          onClick={() => openWorkbench(row)}
                          className="rounded-[4px] border border-[#38c08f] px-2.5 py-1 text-[12px] font-medium text-[#38c08f] hover:bg-[#f0fdf4] transition-colors whitespace-nowrap"
                        >
                          编辑
                        </button>
                      )}
                      {showAuditRecord(row.auditStatus) && canLog && (
                        <button
                          onClick={() => setAuditRow(row)}
                          className="rounded-[4px] border border-[#93c5fd] px-2.5 py-1 text-[12px] font-medium text-[#2563eb] hover:bg-[#eff6ff] transition-colors whitespace-nowrap"
                        >
                          审核记录
                        </button>
                      )}
                      {showDelete(row.auditStatus) && canDelete && (
                        <button
                          onClick={() => setDeleteRow(row)}
                          className="rounded-[4px] border border-[#fca5a5] px-2.5 py-1 text-[12px] font-medium text-[#dc2626] hover:bg-[#fef2f2] transition-colors whitespace-nowrap"
                        >
                          删除
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
          currentPage={page}
          pageSize={pageSize}
          onPageChange={(p) => setPage(p)}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
        />
      </div>

      {/* 弹层 */}
      <AuditRecordDrawer
        row={auditRow}
        records={auditLogs}
        loading={auditLogsLoading}
        onClose={() => setAuditRow(null)}
      />
      {workbenchRow && workbenchDetail && (
        <ScriptEditorDrawer
          bookName={workbenchRow.scriptName}
          detail={workbenchDetail}
          onClose={() => { setWorkbenchRow(null); setWorkbenchDetail(null) }}
          persistBookId={workbenchRow.bookDbId}
          persistScriptType={workbenchRow.scriptType}
          persistOriginalScriptId={
            workbenchRow.originalScriptId ? Number(workbenchRow.originalScriptId) : null
          }
          onPersistSave={async (body) => {
            await scriptDraftApi.update(Number(workbenchRow.id), body)
            await fetchDrafts()
          }}
          onPersistSubmit={async () => {
            await scriptDraftApi.submit(Number(workbenchRow.id))
            await fetchDrafts()
          }}
        />
      )}
      {detailRow && (
        <ScriptDetailDrawer
          row={detailRow}
          onClose={() => setDetailRow(null)}
        />
      )}
      <DeleteConfirmModal row={deleteRow} onConfirm={handleDelete} onCancel={() => setDeleteRow(null)} />
    </div>
  )
}
