"use client"
// 审核管理 > 剧本审核
import { useState, useMemo, useRef, useCallback, useEffect } from "react"
import { Search, RotateCcw, ChevronDown, CheckCircle, X, Bold, Underline, Strikethrough, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { SelectFilter, PublishTaskDrawer } from "@/components/shared"
import { formatDateTime } from "@/lib/format"
import { scriptAuditApi, scriptDraftApi, bookApi } from "@/lib/api"
import { toast } from "@/lib/toast"
import { ListPagination } from "@/components/list-pagination"
import { useFilters } from "@/hooks/use-filters"
import { usePagination } from "@/hooks/use-pagination"
import {
  sharedParagraphs,
  TRIAL_PARAGRAPH_INDEX,
  calcTotalWords,
  calcEpisodeIndex,
  calcSegmentWords,
  buildInitialNodes,
  type EditorNode,
} from "@/lib/script-editor"

// ─── 类型 ──────────────────────────────────────────────────────────────────────

interface ApprovalNode {
  time: string
  operator: string
  action: string
  remark?: string
}

interface ScriptRow {
  id: string
  bookDbId: number
  scriptName: string
  episodeCount: number
  sourceBookId: string
  scriptType: "原作" | "多版本"
  originalScriptId: string
  auditStatus: "待认领" | "审核中" | "驳回修改" | "审核通过" | "审核不通过"
  scriptwriter: string
  reviewer: string
  approvalProgress: ApprovalNode[]
  auditRecords: ApprovalNode[]
  paidBreakpointNodeId: string | null
  paidBreakpointEpisode: number | null
}

type MyAuditStatus = "审核中" | "驳回修改" | "审核通过" | "审核不通过"

interface MyAuditRow {
  id: string
  bookDbId: number
  scriptName: string
  episodeCount: number
  sourceBookId: string
  scriptType: "原作" | "多版本"
  originalScriptId: string
  scriptwriter: string
  auditStatus: MyAuditStatus
  auditRecords: ApprovalNode[]
  paidBreakpointNodeId: string | null
  paidBreakpointEpisode: number | null
}

interface PublishInfo {
  scriptDbId: number
  displayScriptId: string
  scriptName: string
  episodeCount: number
  paidEpisode: number | null
}

type ScriptType = ScriptRow["scriptType"]

const formatAuditTime = formatDateTime

function mapAuditLogToNode(log: {
  createdAt?: string
  action?: string
  opinion?: string
  operator?: { name?: string }
}): ApprovalNode {
  return {
    time: formatAuditTime(log.createdAt),
    operator: log.operator?.name ?? "",
    action: log.action ?? "",
    remark: log.opinion?.trim() ? log.opinion : undefined,
  }
}

type ApiScriptDraft = {
  id: number
  scriptName?: string
  episodeCount?: number
  bookId?: number
  book?: { bookId?: string }
  scriptType?: string
  originalScriptId?: number | null
  originalScript?: { scriptId?: string } | null
  auditStatus?: string
  writer?: { name?: string }
  reviewer?: { name?: string }
  payEpisode?: string
}

function parsePayEpisode(ep: string | undefined): number | null {
  if (ep == null || ep === "") return null
  const n = parseInt(String(ep).replace(/\D/g, ""), 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

function mapDraftToScriptRow(d: ApiScriptDraft): ScriptRow {
  const st = d.scriptType === "多版本" ? "多版本" : "原作"
  const origBizId = d.originalScript?.scriptId
  const status = (d.auditStatus ?? "待认领") as ScriptRow["auditStatus"]
  return {
    id: String(d.id),
    bookDbId: d.bookId ?? 0,
    scriptName: d.scriptName ?? "",
    episodeCount: d.episodeCount ?? 0,
    sourceBookId: d.book?.bookId ?? (d.bookId != null ? String(d.bookId) : ""),
    scriptType: st as ScriptType,
    originalScriptId: st === "多版本" && origBizId ? String(origBizId) : "",
    auditStatus: status,
    scriptwriter: d.writer?.name ?? "",
    reviewer: d.reviewer?.name ?? "",
    approvalProgress: [],
    auditRecords: [],
    paidBreakpointNodeId: null,
    paidBreakpointEpisode: parsePayEpisode(d.payEpisode),
  }
}

function mapDraftToMyAuditRow(d: ApiScriptDraft): MyAuditRow {
  const base = mapDraftToScriptRow(d)
  return {
    id: base.id,
    bookDbId: base.bookDbId,
    scriptName: base.scriptName,
    episodeCount: base.episodeCount,
    sourceBookId: base.sourceBookId,
    scriptType: base.scriptType,
    originalScriptId: base.originalScriptId,
    auditStatus: base.auditStatus as MyAuditStatus,
    scriptwriter: base.scriptwriter,
    auditRecords: [],
    paidBreakpointNodeId: base.paidBreakpointNodeId,
    paidBreakpointEpisode: base.paidBreakpointEpisode,
  }
}

// ─── 枚举选项 ──────────────────────────────────────────────────────────────────

const scriptTypeOptions = [
  { label: "原作", value: "原作" },
  { label: "多版本", value: "多版本" },
]

const auditStatusOptions = [
  { label: "待认领", value: "待认领" },
  { label: "审核中", value: "审核中" },
  { label: "驳回修改", value: "驳回修改" },
  { label: "审核通过", value: "审核通过" },
  { label: "审核不通过", value: "审核不通过" },
]

const defaultFilters = {
  scriptName: "",
  sourceBookId: "",
  scriptType: "",
  originalScriptId: "",
  auditStatus: "待认领",
  scriptwriter: "",
  reviewer: "",
}

// ─── 审核状态色块配置 ─────────────────────────────────────────────────────────

const auditStatusStyle: Record<string, { bg: string; text: string }> = {
  "待认领": { bg: "bg-[#eff6ff]", text: "text-[#2563eb]" },
  "审核中": { bg: "bg-[#fff7ed]", text: "text-[#ea580c]" },
  "驳回修改": { bg: "bg-[#fffbeb]", text: "text-[#d97706]" },
  "审核通过": { bg: "bg-[#ecfdf5]", text: "text-[#059669]" },
  "审核不通过": { bg: "bg-[#fef2f2]", text: "text-[#dc2626]" },
}

// 审批进度节点样式
const approvalActionStyle: Record<string, { dot: string; bg: string; text: string }> = {
  "提交任务": { dot: "border-[#9ca3af] bg-white", bg: "bg-[#f9fafb]", text: "text-[#374151]" },
  "提交审核": { dot: "border-[#9ca3af] bg-white", bg: "bg-[#f9fafb]", text: "text-[#374151]" },
  "领取任务": { dot: "border-[#38c08f] bg-white", bg: "bg-[#f0fdf4]", text: "text-[#15803d]" },
  "审核中": { dot: "border-[#f97316] bg-white", bg: "bg-[#fff7ed]", text: "text-[#ea580c]" },
  "驳回修改": { dot: "border-[#d97706] bg-white", bg: "bg-[#fffbeb]", text: "text-[#d97706]" },
  "审核通过": { dot: "border-[#059669] bg-[#059669]", bg: "bg-[#ecfdf5]", text: "text-[#059669]" },
  "审核不通过": { dot: "border-[#dc2626] bg-[#dc2626]", bg: "bg-[#fef2f2]", text: "text-[#dc2626]" },
}

// ─── Toast (removed, using global toast) ──────────────────────────────────────


// ─── 审批进度抽屉 ──────────────────────────────────────────────────────────────

function ApprovalProgressDrawer({
  row,
  onClose,
}: {
  row: ScriptRow | null
  onClose: () => void
}) {
  if (!row) return null

  return (
    <>
      <div className="fixed inset-0 z-[40] bg-black/20" onClick={onClose} />
      <div className="fixed right-0 top-0 z-[50] flex h-full w-[420px] flex-col bg-white shadow-2xl">
        {/* 顶部 */}
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
        {/* 时间线 */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {row.approvalProgress.length === 0 ? (
            <div className="py-16 text-center text-[13px] text-[#9ca3af]">暂无审批进度</div>
          ) : (
            <div className="relative pl-5">
              {/* 竖线 */}
              <div className="absolute left-[7px] top-3 bottom-3 w-px bg-[#e5e7eb]" />
              <div className="flex flex-col gap-4">
                {row.approvalProgress.map((node, i) => {
                  const style = approvalActionStyle[node.action] ?? {
                    dot: "border-[#9ca3af] bg-white",
                    bg: "bg-[#f9fafb]",
                    text: "text-[#374151]",
                  }
                  return (
                    <div key={i} className="relative">
                      <span
                        className={cn(
                          "absolute -left-[13px] top-[6px] h-2.5 w-2.5 rounded-full border-2",
                          style.dot
                        )}
                      />
                      <div className={cn("rounded-[6px] border border-[#f3f4f6] px-4 py-3", style.bg)}>
                        <div className="flex items-center justify-between">
                          <span className={cn("text-[12.5px] font-medium", style.text)}>{node.action}</span>
                          <span className="text-[11.5px] text-[#9ca3af]">{node.operator}</span>
                        </div>
                        {node.remark && (
                          <p className="mt-1.5 text-[12px] leading-relaxed text-[#6b7280] whitespace-pre-wrap">{node.remark}</p>
                        )}
                        <p className="mt-1.5 text-[11px] text-[#9ca3af]">{node.time}</p>
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

// ─── 只读橙色分集线（复用 script-creation 的逻辑）─────────────────────────────

function ReadonlyOrangeDivider({ nodes, nodeId }: { nodes: EditorNode[]; nodeId: string }) {
  const episodeNum = calcEpisodeIndex(nodes, nodeId)
  const idx = nodes.findIndex((n) => n.id === nodeId)
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

// ─── 剧本详情抽屉（只读，与剧本创作保持一致）───────────────────────────────────

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
      try {
        const [draft, book] = await Promise.all([
          scriptDraftApi.detail(Number(row.id)),
          row.bookDbId ? bookApi.detail(row.bookDbId) : Promise.resolve(null),
        ])
        if (cancelled) return

        const draftContent = draft.content as string | undefined
        const bookContent = book?.content as string | undefined
        const paragraphs = (draftContent && draftContent.trim()
          ? draftContent
          : bookContent || ""
        ).split(/\r?\n/).filter((s: string) => s.trim())

        let dividerPositions: number[] | undefined
        const bpData = draft.payBreakpointData as string | undefined
        if (bpData) {
          try { dividerPositions = JSON.parse(bpData) } catch { /* ignore */ }
        }

        const breakpointLabel = book?.payBreakpoint || ""
        const built = buildInitialNodes(paragraphs, TRIAL_PARAGRAPH_INDEX, breakpointLabel, dividerPositions)
        setNodes(built)
      } catch {
        setNodes([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [row.id, row.bookDbId])

  const totalWords = calcTotalWords(nodes)

  return (
    <>
      <div className="fixed inset-0 bg-black/40" style={{ zIndex: 60 }} onClick={onClose} />
      <div
        className="fixed right-0 top-0 flex h-full w-[1040px] flex-col bg-white"
        style={{ zIndex: 61, boxShadow: "-4px 0 32px rgba(0,0,0,0.15)" }}
      >
        <div className="flex items-center justify-between border-b border-[#e5e7eb] px-6 py-4">
          <h2 className="text-[15px] font-semibold text-[#111827]">剧本详情</h2>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-[4px] text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#374151] transition-colors" aria-label="关闭"><X size={16} /></button>
        </div>
        <div className="border-b border-[#e5e7eb] px-6 py-3.5">
          <div className="flex items-center gap-3">
            <span className="whitespace-nowrap text-[13px] font-medium text-[#374151]">剧本名称</span>
            <span className="text-[13px] text-[#111827]">{row.scriptName}</span>
          </div>
        </div>
        <div className="relative flex-1 overflow-y-auto bg-[#f9fafb] px-8 py-5">
          {loading ? (
            <div className="flex h-full items-center justify-center text-[13px] text-[#9ca3af]">加载中...</div>
          ) : (
            <div className="mx-auto max-w-[860px] rounded-[6px] border border-[#e5e7eb] bg-white px-8 py-6 min-h-full">
              {nodes.map((node) => {
                if (node.type === "paragraph") {
                  return <p key={node.id} className="mb-2 text-[14px] leading-relaxed text-[#374151]" dangerouslySetInnerHTML={{ __html: node.html }} />
                }
                if (node.type === "blue-divider") {
                  return (
                    <div key={node.id} className="my-6 flex select-none items-center gap-3">
                      <div className="h-px flex-1 bg-[#3b82f6]" />
                      <span className="whitespace-nowrap rounded-[4px] border border-[#3b82f6] bg-[#eff6ff] px-3 py-1 text-[12px] font-medium text-[#2563eb]">{node.label}</span>
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

const hallMock: ScriptRow[] = []

const mineMock: MyAuditRow[] = []

// ─── 任务大厅 Tab ──────────────────────────────────────────────────────────────

function TaskHallTab({
  listRefreshKey,
  onMutate,
}: {
  listRefreshKey: number
  onMutate: () => void
}) {
  const { draft: filters, active: applied, update: updateFilter, apply: applyFilters, reset: resetFilters } = useFilters(defaultFilters)
  const { page, pageSize, resetPage, paginationProps: hallPaginationProps } = usePagination(10)
  const [hallData, setHallData] = useState<ScriptRow[]>([])
  const [hallTotal, setHallTotal] = useState(0)
  const [hallLoading, setHallLoading] = useState(false)
  const [openAuditAfterClaimId, setOpenAuditAfterClaimId] = useState<string | null>(null)
  const [progressRow, setProgressRow] = useState<ScriptRow | null>(null)
  const [detailRow, setDetailRow] = useState<ScriptRow | null>(null)
  const [auditRow, setAuditRow] = useState<ScriptRow | null>(null)
  const [publishInfo, setPublishInfo] = useState<PublishInfo | null>(null)

  const fetchHall = useCallback(async () => {
    setHallLoading(true)
    try {
      const params: Record<string, string | number> = {
        page,
        pageSize,
      }
      const sn = applied.scriptName.trim()
      if (sn) params.scriptName = sn
      if (applied.scriptType) params.scriptType = applied.scriptType
      if (applied.auditStatus) params.auditStatus = applied.auditStatus
      const w = applied.scriptwriter.trim()
      if (w) params.writer = w
      const rv = applied.reviewer.trim()
      if (rv) params.reviewer = rv
      const res = await scriptAuditApi.hall(params)
      const list = (res.list ?? []) as ApiScriptDraft[]
      const rows = list.map(mapDraftToScriptRow)
      setHallData(rows)
      setHallTotal(typeof res.total === "number" ? res.total : 0)
    } catch {
      setHallData([])
      setHallTotal(0)
    } finally {
      setHallLoading(false)
    }
  }, [applied, page, pageSize])

  useEffect(() => {
    void fetchHall()
  }, [fetchHall, listRefreshKey])

  useEffect(() => {
    if (!openAuditAfterClaimId || hallLoading) return
    const r = hallData.find((x) => x.id === openAuditAfterClaimId)
    if (r) setAuditRow(r)
    setOpenAuditAfterClaimId(null)
  }, [hallData, hallLoading, openAuditAfterClaimId])

  async function openProgressRow(row: ScriptRow) {
    try {
      const logs = await scriptDraftApi.auditLogs(Number(row.id))
      const arr = Array.isArray(logs) ? logs : []
      setProgressRow({ ...row, approvalProgress: arr.map(mapAuditLogToNode) })
    } catch {
      setProgressRow({ ...row, approvalProgress: [] })
    }
  }

  async function handleClaim(rowId: string) {
    try {
      await scriptAuditApi.claim(Number(rowId))
      toast.success("领取成功，请进行审核")
      setOpenAuditAfterClaimId(rowId)
      onMutate()
    } catch (e) {
      toast.errorFrom(e, "领取失败")
    }
  }

  async function handleSubmitFromHall(
    rowId: string,
    newStatus: MyAuditStatus,
    opinion: string,
    paidBreakpointNodeId: string | null,
    paidBreakpointEpisode: number | null,
  ) {
    const resp = await scriptAuditApi.review(Number(rowId), {
      result: newStatus,
      opinion,
      payEpisode: newStatus === "审核通过" ? String(paidBreakpointEpisode ?? "") : "",
    })
    setAuditRow(null)
    toast.success("剧本审核成功")
    onMutate()
    return resp as { scriptId?: number; displayScriptId?: string } | undefined
  }

  const pageData = hallData

  function handleQuery() { applyFilters(); resetPage() }
  function handleReset() { resetFilters(); resetPage() }

  const TABLE_HEADERS = ["剧本名称", "集数", "原书ID", "类型", "原剧本ID", "审核状态", "编剧", "审核员", "操作"]

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* 筛选区 */}
      <div className="rounded-t-[8px] border border-[#e5e7eb] bg-white px-5 py-4 shrink-0">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap text-[13px] text-[#374151]">剧本名称</span>
            <input
              type="text"
              value={filters.scriptName}
              onChange={(e) => updateFilter("scriptName", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleQuery()}
              placeholder="请输入剧本名称"
              className="h-[30px] w-[160px] rounded-[6px] border border-[#d1d5db] bg-white px-3 text-[13px] placeholder-[#9ca3af] outline-none focus:border-[#38c08f] transition-colors"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap text-[13px] text-[#374151]">原书ID</span>
            <input
              type="text"
              value={filters.sourceBookId}
              onChange={(e) => updateFilter("sourceBookId", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleQuery()}
              placeholder="请输入原书ID"
              className="h-[30px] w-[160px] rounded-[6px] border border-[#d1d5db] bg-white px-3 text-[13px] placeholder-[#9ca3af] outline-none focus:border-[#38c08f] transition-colors"
            />
          </div>
          <SelectFilter
              label="类型"
              value={filters.scriptType}
              onChange={(v) => updateFilter("scriptType", v)}
              options={scriptTypeOptions}
              placeholder="请选择"
              width="w-[140px]"
            />
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap text-[13px] text-[#374151]">原剧本ID</span>
            <input
              type="text"
              value={filters.originalScriptId}
              onChange={(e) => updateFilter("originalScriptId", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleQuery()}
              placeholder="请输入原剧本ID"
              className="h-[30px] w-[160px] rounded-[6px] border border-[#d1d5db] bg-white px-3 text-[13px] placeholder-[#9ca3af] outline-none focus:border-[#38c08f] transition-colors"
            />
          </div>
          <SelectFilter
              label="审核状态"
              value={filters.auditStatus}
              onChange={(v) => updateFilter("auditStatus", v)}
              options={auditStatusOptions}
              placeholder="请选择"
              width="w-[140px]"
            />
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap text-[13px] text-[#374151]">编剧</span>
            <input
              type="text"
              value={filters.scriptwriter}
              onChange={(e) => updateFilter("scriptwriter", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleQuery()}
              placeholder="请输入编剧"
              className="h-[30px] w-[140px] rounded-[6px] border border-[#d1d5db] bg-white px-3 text-[13px] placeholder-[#9ca3af] outline-none focus:border-[#38c08f] transition-colors"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap text-[13px] text-[#374151]">审核员</span>
            <input
              type="text"
              value={filters.reviewer}
              onChange={(e) => updateFilter("reviewer", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleQuery()}
              placeholder="请输入审核员"
              className="h-[30px] w-[140px] rounded-[6px] border border-[#d1d5db] bg-white px-3 text-[13px] placeholder-[#9ca3af] outline-none focus:border-[#38c08f] transition-colors"
            />
          </div>
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

      {/* 列表区 */}
      <div className="flex flex-col flex-1 min-h-0 border-x border-b border-[#e5e7eb] bg-white rounded-b-[8px]">
        <div className="flex-1 overflow-auto min-h-0">
          <table className="w-full min-w-[960px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#f9fafb]">
                {TABLE_HEADERS.map((h) => (
                  <th
                    key={h}
                    className="sticky top-0 z-10 border-b border-[#e5e7eb] bg-[#f9fafb] px-4 py-3 text-left text-[12.5px] font-medium text-[#6b7280] whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hallLoading && pageData.length === 0 ? (
                <tr>
                  <td colSpan={TABLE_HEADERS.length} className="py-16 text-center text-[13px] text-[#9ca3af]">
                    加载中…
                  </td>
                </tr>
              ) : pageData.length === 0 ? (
                <tr>
                  <td colSpan={TABLE_HEADERS.length} className="py-16 text-center text-[13px] text-[#9ca3af]">
                    暂无匹配数据
                  </td>
                </tr>
              ) : (
                pageData.map((row, i) => {
                  const statusStyle = auditStatusStyle[row.auditStatus] ?? { bg: "bg-[#f3f4f6]", text: "text-[#6b7280]" }
                  const isClaimable = row.auditStatus === "待认领"
                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        "transition-colors hover:bg-[#fafafa]",
                        i < pageData.length - 1 && "border-b border-[#f3f4f6]"
                      )}
                    >

                      {/* 剧本名称 — 蓝色超链接，点击打开详情抽屉 */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          onClick={() => setDetailRow(row)}
                          className="text-left text-[13px] font-medium text-[#2563eb] hover:text-[#1d4ed8] hover:underline transition-colors"
                        >
                          {row.scriptName}
                        </button>
                      </td>
                      {/* 集数 */}
                      <td className="px-4 py-3 text-[#4b5563] whitespace-nowrap">{row.episodeCount}</td>
                      {/* 原书ID */}
                      <td className="px-4 py-3 font-mono text-[12px] text-[#6b7280] whitespace-nowrap">
                        {row.sourceBookId}
                      </td>
                      {/* 类型 */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-[4px] px-2 py-0.5 text-[11.5px] font-medium",
                            row.scriptType === "原作"
                              ? "bg-[#eff6ff] text-[#2563eb]"
                              : "bg-[#f5f3ff] text-[#7c3aed]"
                          )}
                        >
                          {row.scriptType}
                        </span>
                      </td>
                      {/* 原剧本ID */}
                      <td className="px-4 py-3 font-mono text-[12px] text-[#6b7280] whitespace-nowrap">
                        {row.originalScriptId || <span className="font-sans text-[#d1d5db]">--</span>}
                      </td>
                      {/* 审核状态 */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-[4px] px-2 py-0.5 text-[11.5px] font-medium",
                            statusStyle.bg,
                            statusStyle.text
                          )}
                        >
                          {row.auditStatus}
                        </span>
                      </td>
                      {/* 编剧 */}
                      <td className="px-4 py-3 text-[#4b5563] whitespace-nowrap">
                        {row.scriptwriter || <span className="text-[#d1d5db]">--</span>}
                      </td>
                      {/* 审核员 */}
                      <td className="px-4 py-3 text-[#4b5563] whitespace-nowrap">
                        {row.reviewer || <span className="text-[#d1d5db]">--</span>}
                      </td>
                      {/* 操作列 */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {isClaimable
                            ? (
                              <button
                                onClick={() => handleClaim(row.id)}
                                className="rounded-[4px] border border-[#38c08f] px-2.5 py-1 text-[12px] font-medium text-[#38c08f] hover:bg-[#f0fdf4] transition-colors whitespace-nowrap"
                              >
                                领取任务
                              </button>
                            )
                            : (
                              <button
                                type="button"
                                onClick={() => void openProgressRow(row)}
                                className="rounded-[4px] border border-[#2563eb] px-2.5 py-1 text-[12px] font-medium text-[#2563eb] hover:bg-[#eff6ff] transition-colors whitespace-nowrap"
                              >
                                审核记录
                              </button>
                            )
                          }
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        <div className="shrink-0">
          <ListPagination
            total={hallTotal}
            {...hallPaginationProps}
          />
        </div>
      </div>

      {/* 审批进度抽屉 */}
      <ApprovalProgressDrawer row={progressRow} onClose={() => setProgressRow(null)} />

      {/* 剧本详情抽屉 */}
      {detailRow && (
        <ScriptDetailDrawer row={detailRow} onClose={() => setDetailRow(null)} />
      )}

      {/* 领取后弹出的审核处理抽屉 */}
      <AuditHandleDrawer
        row={auditRow}
        onClose={() => setAuditRow(null)}
        onSubmit={handleSubmitFromHall}
        onApproved={(r, paidEp, result) => {
          setAuditRow(null)
          if (result?.scriptId) {
            setPublishInfo({
              scriptDbId: result.scriptId,
              displayScriptId: result.displayScriptId ?? "",
              scriptName: r.scriptName,
              episodeCount: r.episodeCount,
              paidEpisode: paidEp,
            })
          }
        }}
      />
      {publishInfo && (
        <PublishTaskDrawer
          scriptId={publishInfo.scriptDbId}
          scriptName={publishInfo.scriptName}
          displayScriptId={publishInfo.displayScriptId}
          episodeCount={publishInfo.episodeCount}
          paidEpisodeLabel={publishInfo.paidEpisode != null ? `第${publishInfo.paidEpisode}集` : "--"}
          zIndex={120}
          onClose={() => setPublishInfo(null)}
          onSuccess={() => { setPublishInfo(null); onMutate() }}
        />
      )}
    </div>
  )
}

// ─── 我的审核筛选配置 ─────────────────────────────────────────────────────────

const myAuditDefaultFilters = {
  scriptName: "",
  sourceBookId: "",
  scriptType: "",
  originalScriptId: "",
  scriptwriter: "",
  auditStatus: "",
}

const myAuditStatusOptions = [
  { label: "审核中", value: "审核中" },
  { label: "驳回修改", value: "驳回修改" },
  { label: "审核通过", value: "审核通过" },
  { label: "审核不通过", value: "审核不通过" },
]

// ─── 编辑器内部组件（复用 book-management 中同款逻辑）─────────────────────────

let _reviewEditorIdCounter = 0
function newReviewId() { return `re${++_reviewEditorIdCounter}` }

const REVIEW_FONT_SIZES = ["12", "14", "16", "18", "20"] as const
const REVIEW_PRESET_COLORS = [
  "#111827", "#374151", "#6b7280", "#9ca3af",
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#3b82f6", "#8b5cf6", "#ec4899", "#ffffff",
]

function ReviewParagraphEditor({ node, onChange }: {
  node: Extract<EditorNode, { type: "paragraph" }>
  onChange: (id: string, html: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const isComposing = useRef(false)
  const lastHtml = useRef(node.html)

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== node.html) {
      ref.current.innerHTML = node.html
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const syncHtml = useCallback(() => {
    if (!ref.current) return
    const html = ref.current.innerHTML
    if (html !== lastHtml.current) {
      lastHtml.current = html
      onChange(node.id, html)
    }
  }, [node.id, onChange])

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onCompositionStart={() => { isComposing.current = true }}
      onCompositionEnd={() => { isComposing.current = false; syncHtml() }}
      onInput={() => { if (!isComposing.current) syncHtml() }}
      onBlur={syncHtml}
      className="min-h-[1.6em] rounded-[2px] py-0.5 text-[13.5px] leading-relaxed text-[#374151] outline-none focus:bg-[#f8fffe] focus:ring-1 focus:ring-[#38c08f]/30"
      style={{ whiteSpace: "pre-wrap" }}
    />
  )
}

function ReviewOrangeDividerNode({ node, nodes, onDelete, isPaidBreakpoint, onTogglePaid }: {
  node: Extract<EditorNode, { type: "orange-divider" }>
  nodes: EditorNode[]
  onDelete: (id: string) => void
  isPaidBreakpoint: boolean
  onTogglePaid: (id: string) => void
}) {
  const [hovered, setHovered] = useState(false)
  const idx = nodes.findIndex((n) => n.id === node.id)
  const episodeNum = calcEpisodeIndex(nodes, node.id)
  const wordCount = calcSegmentWords(nodes, idx)

  const lineColor = isPaidBreakpoint ? "bg-[#8b5cf6]" : "bg-[#f97316]"
  const borderColor = isPaidBreakpoint ? "border-[#8b5cf6]" : "border-[#f97316]"
  const bgColor = isPaidBreakpoint ? "bg-[#f5f3ff]" : "bg-[#fff7ed]"
  const textColor = isPaidBreakpoint ? "text-[#7c3aed]" : "text-[#ea580c]"

  return (
    <div
      className="relative my-1 flex select-none items-center gap-2 py-0.5"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* 左侧分隔线 */}
      <div className={cn("h-px flex-1", lineColor)} />

      {/* 中间标签 + 操作按钮（统一在一个容器，hover 时自然展开） */}
      <div className={cn("flex items-center rounded-[4px] border px-3 py-1 transition-colors", borderColor, bgColor)}>
        {/* 主标签文字 */}
        <span className={cn("whitespace-nowrap text-[12px] font-medium", textColor)}>
          第{episodeNum}集，总计{wordCount}字
        </span>

        {/* 付费卡点状态点：非 hover 时若已设为付费卡点，展示小徽标；不占额外按钮位置 */}
        {isPaidBreakpoint && !hovered && (
          <span className="ml-1.5 inline-flex h-[14px] items-center rounded-[3px] bg-[#8b5cf6] px-1 text-[10px] font-medium leading-none text-white">
            付费
          </span>
        )}

        {/* hover 时才渲染的操作区域，真正不预留位置 */}
        {hovered && (
          <span className="ml-2 flex items-center gap-1.5">
            {/* 付费卡点切换按钮 */}
            <button
              onMouseDown={(e) => { e.preventDefault(); onTogglePaid(node.id) }}
              className={cn(
                "flex items-center gap-1 rounded-[3px] border px-1.5 py-0.5 text-[11px] font-medium transition-colors",
                isPaidBreakpoint
                  ? "border-[#8b5cf6] bg-[#8b5cf6] text-white hover:bg-[#7c3aed]"
                  : "border-[#d8b4fe] bg-white text-[#7c3aed] hover:bg-[#f5f3ff]"
              )}
              title={isPaidBreakpoint ? "取消付费卡点" : "设为付费卡点"}
            >
              {isPaidBreakpoint ? "取消卡点" : "设为卡点"}
            </button>

            {/* 删除按钮：仅当 deletable 为 true 时渲染，不显示禁用占位 */}
            {node.deletable && (
              <button
                onMouseDown={(e) => { e.preventDefault(); onDelete(node.id) }}
                className={cn(
                  "flex h-[20px] w-[20px] items-center justify-center rounded transition-colors",
                  isPaidBreakpoint
                    ? "text-[#7c3aed] hover:bg-[#ede9fe]"
                    : "text-[#ea580c] hover:bg-[#fed7aa]"
                )}
                title="删除此分集线"
              >
                <X size={11} />
              </button>
            )}
          </span>
        )}
      </div>

      {/* 右侧分隔线 */}
      <div className={cn("h-px flex-1", lineColor)} />
    </div>
  )
}

function ReviewInsertDividerBtn({ onInsert, disabled }: { onInsert: () => void; disabled?: boolean }) {
  if (disabled) return <div className="h-2" />
  return (
    <div className="group relative my-0 flex h-5 items-center justify-center">
      <div className="absolute inset-x-0 top-1/2 h-px bg-transparent transition-colors group-hover:bg-[#f3f4f6]" />
      <button
        onMouseDown={(e) => { e.preventDefault(); onInsert() }}
        className="relative z-10 hidden items-center gap-1 rounded-[3px] border border-[#fed7aa] bg-[#fff7ed] px-2 py-0.5 text-[11px] text-[#ea580c] opacity-0 transition-all group-hover:flex group-hover:opacity-100 hover:bg-[#ffedd5]"
      >
        <Plus size={10} />新增分集线
      </button>
    </div>
  )
}

type ReviewPanelKey = "fontSize" | "fontColor" | "bgColor" | null

function ReviewFloatingToolbar({ containerRef }: { containerRef: React.RefObject<HTMLDivElement | null> }) {
  const [pos, setPos] = useState<{ top: number; left: number; above: boolean } | null>(null)
  const [openPanel, setOpenPanel] = useState<ReviewPanelKey>(null)
  const [activeFontSize, setActiveFontSize] = useState("14")
  const toolbarRef = useRef<HTMLDivElement>(null)
  const savedRange = useRef<Range | null>(null)

  function saveSelection() {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      savedRange.current = sel.getRangeAt(0).cloneRange()
    }
  }
  function restoreSelection() {
    if (!savedRange.current) return
    const sel = window.getSelection()
    if (sel) { sel.removeAllRanges(); sel.addRange(savedRange.current) }
  }
  function execCmd(cmd: string, value?: string) {
    restoreSelection(); document.execCommand(cmd, false, value ?? undefined); savedRange.current = null
  }
  function togglePanel(key: ReviewPanelKey) { saveSelection(); setOpenPanel(prev => prev === key ? null : key) }

  useEffect(() => {
    function onSelChange() {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) { setPos(null); setOpenPanel(null); return }
      const range = sel.getRangeAt(0)
      if (!containerRef.current?.contains(range.commonAncestorContainer)) { setPos(null); setOpenPanel(null); return }
      saveSelection(); setOpenPanel(null)
      const rect = range.getBoundingClientRect()
      if (!rect || (rect.width === 0 && rect.height === 0)) return
      const TW = 340, TH = 36, GAP = 8
      let left = rect.left + rect.width / 2 - TW / 2
      if (left < 6) left = 6
      if (left + TW > window.innerWidth - 6) left = window.innerWidth - TW - 6
      const topAbove = rect.top - TH - GAP
      const above = topAbove >= 126
      const top = Math.min(above ? topAbove : rect.bottom + GAP, window.innerHeight - TH - 6)
      setPos({ top: Math.max(top, 6), left, above })
    }
    document.addEventListener("selectionchange", onSelChange)
    return () => document.removeEventListener("selectionchange", onSelChange)
  }, [containerRef])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (toolbarRef.current?.contains(e.target as Node)) return
      if (containerRef.current?.contains(e.target as Node)) return
      setPos(null); setOpenPanel(null)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [containerRef])

  if (!pos) return null
  const panelClass = pos.above ? "absolute bottom-full mb-1 z-[200]" : "absolute top-full mt-1 z-[200]"

  return (
    <>
      <div ref={toolbarRef} className="fixed z-[150] flex items-center gap-0.5 rounded-[6px] border border-[#e5e7eb] bg-white px-2 py-1 shadow-xl"
        style={{ top: pos.top, left: pos.left, pointerEvents: "auto" }} onMouseDown={(e) => e.preventDefault()}>
        <div className="relative">
          <button onMouseDown={(e) => { e.preventDefault(); togglePanel("fontSize") }}
            className={cn("flex h-6 items-center gap-0.5 rounded-[3px] px-1.5 text-[12px] transition-colors hover:bg-[#f3f4f6]",
              openPanel === "fontSize" ? "bg-[#f3f4f6] text-[#38c08f]" : "text-[#374151]")}>
            {activeFontSize}px<ChevronDown size={9} className="text-[#9ca3af]" />
          </button>
          {openPanel === "fontSize" && (
            <div className={cn(panelClass, "left-0 rounded-[6px] border border-[#e5e7eb] bg-white py-1 shadow-lg min-w-[76px]")}>
              {REVIEW_FONT_SIZES.map((s) => (
                <button key={s} onMouseDown={(e) => {
                  e.preventDefault(); setActiveFontSize(s); restoreSelection()
                  const sv = s === "12" ? "1" : s === "14" ? "2" : s === "16" ? "3" : s === "18" ? "4" : "5"
                  document.execCommand("fontSize", false, sv); setOpenPanel(null); savedRange.current = null
                }} className={cn("flex w-full px-3 py-1.5 text-[12px] hover:bg-[#f0fdf4]",
                  activeFontSize === s ? "text-[#38c08f] font-semibold" : "text-[#374151]")}>{s}px</button>
              ))}
            </div>
          )}
        </div>
        <div className="h-4 w-px bg-[#e5e7eb] mx-0.5" />
        <button onMouseDown={(e) => { e.preventDefault(); execCmd("bold") }}
          className="flex h-6 w-6 items-center justify-center rounded-[3px] hover:bg-[#f3f4f6] transition-colors" title="加粗">
          <Bold size={13} className="text-[#374151]" />
        </button>
        <button onMouseDown={(e) => { e.preventDefault(); execCmd("underline") }}
          className="flex h-6 w-6 items-center justify-center rounded-[3px] hover:bg-[#f3f4f6] transition-colors" title="下划线">
          <Underline size={13} className="text-[#374151]" />
        </button>
        <button onMouseDown={(e) => { e.preventDefault(); execCmd("strikeThrough") }}
          className="flex h-6 w-6 items-center justify-center rounded-[3px] hover:bg-[#f3f4f6] transition-colors" title="删除线">
          <Strikethrough size={13} className="text-[#374151]" />
        </button>
        <div className="h-4 w-px bg-[#e5e7eb] mx-0.5" />
        <div className="relative">
          <button onMouseDown={(e) => { e.preventDefault(); togglePanel("fontColor") }}
            className={cn("flex h-6 w-6 flex-col items-center justify-center gap-[1px] rounded-[3px] transition-colors hover:bg-[#f3f4f6]",
              openPanel === "fontColor" && "bg-[#f3f4f6]")} title="字体颜色">
            <span className="text-[11px] font-bold leading-none text-[#374151]">A</span>
            <span className="h-[2.5px] w-3.5 rounded-full bg-[#ef4444]" />
          </button>
        </div>
        <div className="relative">
          <button onMouseDown={(e) => { e.preventDefault(); togglePanel("bgColor") }}
            className={cn("flex h-6 w-6 flex-col items-center justify-center gap-[1px] rounded-[3px] transition-colors hover:bg-[#f3f4f6]",
              openPanel === "bgColor" && "bg-[#f3f4f6]")} title="背景颜色">
            <span className="text-[11px] font-bold leading-none text-[#374151]">A</span>
            <span className="h-[2.5px] w-3.5 rounded-full bg-[#fde047]" />
          </button>
        </div>
      </div>
      {openPanel === "fontColor" && (
        <div className="fixed z-[200] rounded-[6px] border border-[#e5e7eb] bg-white p-2 shadow-xl"
          style={{ top: pos.above ? pos.top - 130 : pos.top + 44, left: Math.min(pos.left + 188, window.innerWidth - 130) }}
          onMouseDown={(e) => e.preventDefault()}>
          <p className="mb-1 text-[10px] font-medium text-[#9ca3af]">字体颜色</p>
          <div className="grid grid-cols-6 gap-1">
            {REVIEW_PRESET_COLORS.map((c) => (
              <button key={c} onMouseDown={(e) => {
                e.preventDefault(); restoreSelection(); document.execCommand("foreColor", false, c); setOpenPanel(null); savedRange.current = null
              }} className="h-5 w-5 rounded-[3px] border border-[#e5e7eb] transition-transform hover:scale-110" style={{ background: c }} />
            ))}
          </div>
        </div>
      )}
      {openPanel === "bgColor" && (
        <div className="fixed z-[200] rounded-[6px] border border-[#e5e7eb] bg-white p-2 shadow-xl"
          style={{ top: pos.above ? pos.top - 130 : pos.top + 44, left: Math.min(pos.left + 216, window.innerWidth - 130) }}
          onMouseDown={(e) => e.preventDefault()}>
          <p className="mb-1 text-[10px] font-medium text-[#9ca3af]">背景颜色</p>
          <div className="grid grid-cols-6 gap-1">
            {REVIEW_PRESET_COLORS.map((c) => (
              <button key={c} onMouseDown={(e) => {
                e.preventDefault(); restoreSelection(); document.execCommand("hiliteColor", false, c); setOpenPanel(null); savedRange.current = null
              }} className="h-5 w-5 rounded-[3px] border border-[#e5e7eb] transition-transform hover:scale-110" style={{ background: c }} />
            ))}
          </div>
        </div>
      )}
    </>
  )
}

// ─── 剧本审核抽屉（左侧可编辑剧本 + 右侧审批表单）────────────────────────────

function buildEditorNodesForReview(episodeCount: number): EditorNode[] {
  const paragraphCount = sharedParagraphs.length
  const gap = Math.max(3, Math.floor(paragraphCount / Math.max(episodeCount, 2)))
  const breakpointLabel = `原书：试读字数704字，占全文6%`
  const result: EditorNode[] = []
  sharedParagraphs.forEach((text, i) => {
    result.push({ type: "paragraph", id: newReviewId(), html: text })
    if (i === TRIAL_PARAGRAPH_INDEX - 1) {
      result.push({ type: "blue-divider", id: newReviewId(), label: breakpointLabel })
    }
    for (let ep = 1; ep < episodeCount; ep++) {
      const bpIdx = Math.min(ep * gap - 1, paragraphCount - 2)
      if (bpIdx === i && bpIdx > 0) {
        result.push({ type: "orange-divider", id: newReviewId(), deletable: true })
      }
    }
  })
  result.push({ type: "orange-divider", id: newReviewId(), deletable: false })
  return result
}

function AuditHandleDrawer({
  row,
  onClose,
  onSubmit,
  onApproved,
}: {
  row: (MyAuditRow | ScriptRow) | null
  onClose: () => void
  onSubmit: (rowId: string, newStatus: MyAuditStatus, opinion: string, paidBreakpointNodeId: string | null, paidBreakpointEpisode: number | null) => Promise<{ scriptId?: number; displayScriptId?: string } | void> | void
  onApproved?: (row: MyAuditRow | ScriptRow, paidEp: number | null, result?: { scriptId?: number; displayScriptId?: string }) => void
}) {
  const [scriptName, setScriptName] = useState("")
  const [nodes, setNodes] = useState<EditorNode[]>([])
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [opinion, setOpinion] = useState("")
  const [opinionError, setOpinionError] = useState("")
  const [paidBreakpointError, setPaidBreakpointError] = useState("")
  const [paidBreakpointNodeId, setPaidBreakpointNodeId] = useState<string | null>(null)
  const editorContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!row) return
    setScriptName(row.scriptName)
    setOpinion("")
    setOpinionError("")
    setPaidBreakpointError("")
    setSaved(false)
    setPaidBreakpointNodeId(row.paidBreakpointNodeId ?? null)

    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const [draft, book] = await Promise.all([
          scriptDraftApi.detail(Number(row.id)),
          row.bookDbId ? bookApi.detail(row.bookDbId) : Promise.resolve(null),
        ])
        if (cancelled) return

        const draftContent = draft.content as string | undefined
        const bookContent = book?.content as string | undefined
        const paragraphs = (draftContent && draftContent.trim()
          ? draftContent
          : bookContent || ""
        ).split(/\r?\n/).filter((s: string) => s.trim())

        let dividerPositions: number[] | undefined
        const bpData = draft.payBreakpointData as string | undefined
        if (bpData) {
          try { dividerPositions = JSON.parse(bpData) } catch { /* ignore */ }
        }

        const breakpointLabel = book?.payBreakpoint || ""
        const built = buildInitialNodes(paragraphs, TRIAL_PARAGRAPH_INDEX, breakpointLabel, dividerPositions)
        setNodes(built)
      } catch {
        setNodes([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [row?.id])

  const updateParagraphHtml = useCallback((id: string, html: string) => {
    setNodes((prev) => prev.map((n) => n.type === "paragraph" && n.id === id ? { ...n, html } : n))
  }, [])

  function insertOrangeDividerAfterIdx(afterIdx: number) {
    setNodes((prev) => {
      if (prev[afterIdx + 1]?.type === "orange-divider") return prev
      const next = [...prev]
      next.splice(afterIdx + 1, 0, { type: "orange-divider", id: newReviewId(), deletable: true })
      return next
    })
  }

  function deleteOrangeDivider(id: string) {
    setNodes((prev) => prev.filter((n) => n.id !== id))
    // 若删除的是付费卡点，同步清除
    if (paidBreakpointNodeId === id) setPaidBreakpointNodeId(null)
  }

  // 切换付费卡点（单选：再次点击同一个则取消），设置后实时清除付费卡点错误
  function togglePaidBreakpoint(nodeId: string) {
    setPaidBreakpointNodeId((prev) => {
      const next = prev === nodeId ? null : nodeId
      if (next) setPaidBreakpointError("")
      return next
    })
  }

  // 计算付费卡点对应集数
  const paidBreakpointEpisode = useMemo(() => {
    if (!paidBreakpointNodeId) return null
    const idx = nodes.findIndex((n) => n.id === paidBreakpointNodeId)
    if (idx === -1) return null
    return calcEpisodeIndex(nodes, paidBreakpointNodeId)
  }, [paidBreakpointNodeId, nodes])

  const totalWords = calcTotalWords(nodes)

  async function persistCurrentEdits() {
    const paragraphs = nodes
      .filter((n): n is Extract<EditorNode, { type: "paragraph" }> => n.type === "paragraph")
    const paragraphContent = paragraphs.map((p) => p.html).join("\n")
    const dividerAfterIndices: number[] = []
    let pIdx = 0
    for (const n of nodes) {
      if (n.type === "paragraph") pIdx++
      else if (n.type === "orange-divider") dividerAfterIndices.push(pIdx - 1)
    }
    const episodeCount = Math.max(1, nodes.filter((n) => n.type === "orange-divider").length)
    await scriptAuditApi.saveDraft(Number(row!.id), {
      scriptName: scriptName.trim(),
      auditOpinion: opinion.trim(),
      content: paragraphContent,
      payBreakpointData: JSON.stringify(dividerAfterIndices),
      episodeCount,
    })
  }

  async function handleAuditAction(action: "审核通过" | "驳回修改" | "审核不通过") {
    if (action === "驳回修改" || action === "审核不通过") {
      if (!opinion.trim()) {
        setOpinionError("请输入审核意见")
        return
      }
      setOpinionError("")
    }
    if (action === "审核通过") {
      if (!paidBreakpointNodeId) {
        setPaidBreakpointError("请先在左侧分集线中设置付费卡点")
        return
      }
      setPaidBreakpointError("")
    }
    const statusMap: Record<string, MyAuditStatus> = {
      "审核通过": "审核通过",
      "驳回修改": "驳回修改",
      "审核不通过": "审核不通过",
    }
    try {
      await persistCurrentEdits()
      const result = await onSubmit(row!.id, statusMap[action], opinion.trim(), paidBreakpointNodeId, paidBreakpointEpisode)
      if (action === "审核通过" && onApproved && row) {
        onApproved(row, paidBreakpointEpisode, result as { scriptId?: number; displayScriptId?: string } | undefined)
      }
    } catch (e) {
      toast.errorFrom(e, "操作失败")
    }
  }

  if (!row) return null

  const statusStyle = auditStatusStyle[row.auditStatus] ?? { bg: "bg-[#f3f4f6]", text: "text-[#6b7280]" }

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/40" onClick={onClose} />
      <div
        className="fixed right-0 top-0 z-[61] flex h-full flex-col bg-white"
        style={{ width: "min(1300px, 92vw)", boxShadow: "-4px 0 32px rgba(0,0,0,0.15)" }}
      >
        {/* 头部 */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#e5e7eb] px-6 py-4">
          <p className="text-[15px] font-semibold text-[#111827]">剧本审核</p>
          <button onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-[4px] text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#374151] transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* 双栏主体 */}
        <div className="flex flex-1 overflow-hidden">
          {/* ── 左侧：可编辑剧本区 ── */}
          <div className="flex flex-1 flex-col overflow-hidden border-r border-[#e5e7eb]">
            {/* 剧本名称输入 */}
            <div className="shrink-0 border-b border-[#e5e7eb] px-6 py-3.5">
              <div className="flex items-center gap-3">
                <label className="whitespace-nowrap text-[13px] font-medium text-[#374151]">剧本名称</label>
                <input
                  type="text"
                  value={scriptName}
                  onChange={(e) => setScriptName(e.target.value)}
                  className="h-[30px] w-[320px] rounded-[6px] border border-[#d1d5db] bg-white px-3 text-[13px] text-[#111827] outline-none focus:border-[#38c08f] transition-colors"
                />
              </div>
            </div>

            {/* 编辑器 */}
            <div className="relative flex-1 overflow-y-auto bg-[#f9fafb] px-8 py-5" ref={editorContainerRef}>
              <ReviewFloatingToolbar containerRef={editorContainerRef} />
              {loading ? (
                <div className="flex h-full items-center justify-center text-[13px] text-[#9ca3af]">加载中...</div>
              ) : (
              <div className="mx-auto max-w-[860px] rounded-[6px] border border-[#e5e7eb] bg-white px-8 py-6 min-h-full">
                {nodes.map((node, idx) => {
                  const prevIsOrange = idx > 0 && nodes[idx - 1].type === "orange-divider"
                  const nextIsOrange = nodes[idx + 1]?.type === "orange-divider"
                  const blueDivGroupHasOrange = (blueIdx: number) => {
                    return (blueIdx > 0 && nodes[blueIdx - 1].type === "orange-divider") || nodes[blueIdx + 1]?.type === "orange-divider"
                  }

                  if (node.type === "paragraph") {
                    return (
                      <div key={node.id}>
                        {idx > 0 && (
                          <ReviewInsertDividerBtn onInsert={() => insertOrangeDividerAfterIdx(idx - 1)} disabled={prevIsOrange} />
                        )}
                        <ReviewParagraphEditor
                          node={node as Extract<EditorNode, { type: "paragraph" }>}
                          onChange={updateParagraphHtml}
                        />
                      </div>
                    )
                  }
                  if (node.type === "blue-divider") {
                    const groupHasOrange = blueDivGroupHasOrange(idx)
                    return (
                      <div key={node.id}>
                        <ReviewInsertDividerBtn onInsert={() => insertOrangeDividerAfterIdx(idx - 1)} disabled={groupHasOrange} />
                        <div className="my-6 flex select-none items-center gap-3 cursor-not-allowed">
                          <div className="h-px flex-1 bg-[#3b82f6]" />
                          <span className="whitespace-nowrap rounded-[4px] border border-[#3b82f6] bg-[#eff6ff] px-3 py-1 text-[12px] font-medium text-[#2563eb]">{node.label}</span>
                          <div className="h-px flex-1 bg-[#3b82f6]" />
                        </div>
                        <ReviewInsertDividerBtn onInsert={() => insertOrangeDividerAfterIdx(idx)} disabled={groupHasOrange} />
                      </div>
                    )
                  }
                  if (node.type === "orange-divider") {
                    return (
                      <div key={node.id}>
                        <ReviewOrangeDividerNode
                          node={node as Extract<EditorNode, { type: "orange-divider" }>}
                          nodes={nodes}
                          onDelete={deleteOrangeDivider}
                          isPaidBreakpoint={paidBreakpointNodeId === node.id}
                          onTogglePaid={togglePaidBreakpoint}
                        />
                      </div>
                    )
                  }
                  return null
                })}
              </div>
              )}
            </div>

            {/* 左侧底部 */}
            <div className="flex h-[72px] shrink-0 items-center justify-between border-t border-[#e5e7eb] bg-white px-6">
              <span className="text-[13px] text-[#6b7280]">
                全文字数：<span className="font-medium text-[#111827]">{totalWords.toLocaleString()} 字</span>
                <span className="mx-2 text-[#d1d5db]">|</span>
                集数：<span className="font-medium text-[#111827]">{Math.max(1, nodes.filter((n) => n.type === "orange-divider").length)} 集</span>
              </span>
              <div className="flex items-center gap-2">
                {saved && <span className="text-[12.5px] text-[#6b7280]">已保存</span>}
                <button
                  type="button"
                  onClick={() => {
                    void (async () => {
                      try {
                        await persistCurrentEdits()
                        setSaved(true)
                        setTimeout(() => setSaved(false), 2000)
                      } catch (e) {
                        toast.errorFrom(e, "保存失败")
                      }
                    })()
                  }}
                  className="rounded-[6px] border border-[#d1d5db] bg-white px-5 py-2 text-[13px] font-medium text-[#374151] hover:border-[#38c08f] hover:text-[#38c08f] transition-colors"
                >
                  保存
                </button>
              </div>
            </div>
          </div>

          {/* ── 右侧：审批区 ── */}
          <div className="flex w-[420px] shrink-0 flex-col bg-[#fafafa]">
            {/* 可滚动内容区 */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
              {/* 信息卡 */}
              <div className="rounded-[8px] border border-[#e5e7eb] bg-white px-4 py-4 space-y-3">
                <p className="text-[12.5px] font-semibold text-[#111827]">基本信息</p>
                <div className="space-y-2.5">
                  <div className="flex items-start gap-2">
                    <span className="w-[72px] shrink-0 text-[12.5px] text-[#6b7280]">当前状态</span>
                    <span className={cn("inline-flex items-center rounded-[4px] px-2 py-0.5 text-[11.5px] font-medium", statusStyle.bg, statusStyle.text)}>
                      {row.auditStatus}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-[72px] shrink-0 text-[12.5px] text-[#6b7280]">集数</span>
                    <span className="text-[13px] text-[#374151]">{row.episodeCount} 集</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-[72px] shrink-0 text-[12.5px] text-[#6b7280]">原书ID</span>
                    <span className="break-all font-mono text-[12px] text-[#6b7280]">{row.sourceBookId}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-[72px] shrink-0 text-[12.5px] text-[#6b7280]">类型</span>
                    <span className={cn(
                      "inline-flex items-center rounded-[4px] px-2 py-0.5 text-[11.5px] font-medium",
                      row.scriptType === "原作" ? "bg-[#eff6ff] text-[#2563eb]" : "bg-[#f5f3ff] text-[#7c3aed]"
                    )}>
                      {row.scriptType}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-[72px] shrink-0 text-[12.5px] text-[#6b7280]">原剧本ID</span>
                    <span className={cn("font-mono text-[12px]", row.originalScriptId ? "text-[#6b7280]" : "text-[#d1d5db]")}>
                      {row.originalScriptId || "--"}
                    </span>
                  </div>
                  {/* 付费卡点字段 */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="w-[72px] shrink-0 text-[12.5px] text-[#6b7280]">付费卡点</span>
                      {paidBreakpointEpisode != null ? (
                        <span className="inline-flex items-center gap-1 rounded-[4px] border border-[#8b5cf6] bg-[#f5f3ff] px-2 py-0.5 text-[11.5px] font-medium text-[#7c3aed]">
                          第 {paidBreakpointEpisode} 集
                        </span>
                      ) : (
                        <span className={cn("text-[12.5px]", paidBreakpointError ? "text-[#dc2626]" : "text-[#d1d5db]")}>--</span>
                      )}
                    </div>
                    {paidBreakpointError && (
                      <p className="pl-[80px] text-[12px] leading-tight text-[#dc2626]">{paidBreakpointError}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* 审核意见 */}
              <div className="mt-4">
                <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">审核意见</label>
                <textarea
                  value={opinion}
                  onChange={(e) => { setOpinion(e.target.value); if (e.target.value.trim()) setOpinionError("") }}
                  placeholder="请输入审核意见（选填）"
                  rows={5}
                  className={cn(
                    "w-full resize-none rounded-[6px] border bg-white px-3 py-2 text-[13px] placeholder-[#9ca3af] outline-none transition-colors",
                    opinionError ? "border-[#dc2626] focus:border-[#dc2626]" : "border-[#d1d5db] focus:border-[#38c08f]"
                  )}
                />
                {opinionError && (
                  <p className="mt-1 text-[12px] text-[#dc2626]">{opinionError}</p>
                )}
              </div>

              {/* 三个审核按钮（改为底部固定区） */}

            </div>

            {/* 底部固定操作栏 */}
            <div className="flex h-[72px] shrink-0 items-center border-t border-[#e5e7eb] bg-white px-5">
              <div className="flex w-full items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => void handleAuditAction("审核不通过")}
                  className="flex flex-1 items-center justify-center rounded-[6px] border border-[#fca5a5] bg-[#fef2f2] py-2.5 text-[13px] font-medium text-[#dc2626] hover:bg-[#fee2e2] transition-colors"
                >
                  审核不通过
                </button>
                <button
                  type="button"
                  onClick={() => void handleAuditAction("驳回修改")}
                  className="flex flex-1 items-center justify-center rounded-[6px] border border-[#fcd34d] bg-[#fffbeb] py-2.5 text-[13px] font-medium text-[#d97706] hover:bg-[#fef3c7] transition-colors"
                >
                  驳回修改
                </button>
                <button
                  type="button"
                  onClick={() => void handleAuditAction("审核通过")}
                  className="flex flex-1 items-center justify-center rounded-[6px] bg-[#38c08f] py-2.5 text-[13px] font-medium text-white hover:bg-[#2da87a] transition-colors"
                >
                  审核通过
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── 我的审核-审核记录抽屉 ─────────────────────────────────────────────────────

function MyAuditRecordDrawer({
  row,
  onClose,
}: {
  row: MyAuditRow | null
  onClose: () => void
}) {
  if (!row) return null

  return (
    <>
      <div className="fixed inset-0 z-[40] bg-black/20" onClick={onClose} />
      <div className="fixed right-0 top-0 z-[50] flex h-full w-[420px] flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#e5e7eb] px-5 py-4">
          <div>
            <p className="text-[14px] font-semibold text-[#111827]">审核记录</p>
          </div>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-[6px] text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#374151] transition-colors">
            <X size={15} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {row.auditRecords.length === 0 ? (
            <div className="py-16 text-center text-[13px] text-[#9ca3af]">暂无审核记录</div>
          ) : (
            <div className="relative pl-5">
              <div className="absolute left-[7px] top-3 bottom-3 w-px bg-[#e5e7eb]" />
              <div className="flex flex-col gap-4">
                {row.auditRecords.map((node, i) => {
                  const style = approvalActionStyle[node.action] ?? { dot: "border-[#9ca3af] bg-white", bg: "bg-[#f9fafb]", text: "text-[#374151]" }
                  return (
                    <div key={i} className="relative">
                      <span className={cn("absolute -left-[13px] top-[6px] h-2.5 w-2.5 rounded-full border-2", style.dot)} />
                      <div className={cn("rounded-[6px] border border-[#f3f4f6] px-4 py-3", style.bg)}>
                        <div className="flex items-center justify-between">
                          <span className={cn("text-[12.5px] font-medium", style.text)}>{node.action}</span>
                          <span className="text-[11.5px] text-[#9ca3af]">{node.operator}</span>
                        </div>
                        {node.remark && <p className="mt-1.5 text-[12px] leading-relaxed text-[#6b7280] whitespace-pre-wrap">{node.remark}</p>}
                        <p className="mt-1.5 text-[11px] text-[#9ca3af]">{node.time}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
        <div className="border-t border-[#e5e7eb] px-5 py-3">
          <button onClick={onClose} className="w-full rounded-[6px] border border-[#d1d5db] py-1.5 text-[13px] text-[#374151] hover:bg-[#f5f6f7] transition-colors">
            关闭
          </button>
        </div>
      </div>
    </>
  )
}

// ─── 我的审核 Tab ────────────────────────────────────────────────────────────

function MyReviewTab({
  listRefreshKey,
  onMutate,
}: {
  listRefreshKey: number
  onMutate: () => void
}) {
  const { draft: filters, active: applied, update: updateFilter, apply: applyFilters, reset: resetFilters } = useFilters(myAuditDefaultFilters)
  const { page, pageSize, resetPage, paginationProps: minePaginationProps } = usePagination(10)
  const [mineData, setMineData] = useState<MyAuditRow[]>([])
  const [mineTotal, setMineTotal] = useState(0)
  const [mineLoading, setMineLoading] = useState(false)
  const [detailRow, setDetailRow] = useState<MyAuditRow | null>(null)
  const [auditRow, setAuditRow] = useState<MyAuditRow | null>(null)
  const [recordRow, setRecordRow] = useState<(MyAuditRow & { auditRecords: ApprovalNode[] }) | null>(null)
  const [publishInfo, setPublishInfo] = useState<PublishInfo | null>(null)

  const fetchMine = useCallback(async () => {
    setMineLoading(true)
    try {
      const params: Record<string, string | number> = {
        page,
        pageSize,
      }
      const sn = applied.scriptName.trim()
      if (sn) params.scriptName = sn
      if (applied.auditStatus) params.auditStatus = applied.auditStatus
      const res = await scriptAuditApi.mine(params)
      const list = (res.list ?? []) as ApiScriptDraft[]
      const rows = list.map(mapDraftToMyAuditRow)
      setMineData(rows)
      setMineTotal(typeof res.total === "number" ? res.total : 0)
    } catch {
      setMineData([])
      setMineTotal(0)
    } finally {
      setMineLoading(false)
    }
  }, [applied, page, pageSize])

  useEffect(() => {
    void fetchMine()
  }, [fetchMine, listRefreshKey])

  function handleQuery() { applyFilters(); resetPage() }
  function handleReset() { resetFilters(); resetPage() }

  async function handleSubmitAudit(rowId: string, newStatus: MyAuditStatus, opinion: string, paidBreakpointNodeId: string | null, paidBreakpointEpisode: number | null) {
    const resp = await scriptAuditApi.review(Number(rowId), {
      result: newStatus,
      opinion,
      payEpisode: newStatus === "审核通过" ? String(paidBreakpointEpisode ?? "") : "",
    })
    setAuditRow(null)
    toast.success("剧本审核成功")
    onMutate()
    return resp as { scriptId?: number; displayScriptId?: string } | undefined
  }

  async function openRecordRow(row: MyAuditRow) {
    try {
      const logs = await scriptDraftApi.auditLogs(Number(row.id))
      const arr = Array.isArray(logs) ? logs : []
      setRecordRow({ ...row, auditRecords: arr.map(mapAuditLogToNode) })
    } catch {
      setRecordRow({ ...row, auditRecords: [] })
    }
  }

  const pageData = mineData

  const TABLE_HEADERS_MY = ["剧本名称", "集数", "原书ID", "类型", "原剧本ID", "审核状态", "编剧", "操作"]

  // 将 MyAuditRow 适配为 ScriptRow 供剧本详情抽屉使用
  const toScriptRow = (r: MyAuditRow): ScriptRow => ({
    id: r.id,
    bookDbId: r.bookDbId,
    scriptName: r.scriptName,
    episodeCount: r.episodeCount,
    sourceBookId: r.sourceBookId,
    scriptType: r.scriptType,
    originalScriptId: r.originalScriptId,
    auditStatus: r.auditStatus as ScriptRow["auditStatus"],
    scriptwriter: r.scriptwriter,
    reviewer: "",
    approvalProgress: r.auditRecords,
    auditRecords: r.auditRecords,
    paidBreakpointNodeId: r.paidBreakpointNodeId,
    paidBreakpointEpisode: r.paidBreakpointEpisode,
  })

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* 筛选区 */}
      <div className="rounded-t-[8px] border border-[#e5e7eb] bg-white px-5 py-4 shrink-0">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap text-[13px] text-[#374151]">剧本名称</span>
            <input
              type="text"
              value={filters.scriptName}
              onChange={(e) => updateFilter("scriptName", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleQuery()}
              placeholder="请输入剧本名称"
              className="h-[30px] w-[160px] rounded-[6px] border border-[#d1d5db] bg-white px-3 text-[13px] placeholder-[#9ca3af] outline-none focus:border-[#38c08f] transition-colors"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap text-[13px] text-[#374151]">原书ID</span>
            <input
              type="text"
              value={filters.sourceBookId}
              onChange={(e) => updateFilter("sourceBookId", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleQuery()}
              placeholder="请输入原书ID"
              className="h-[30px] w-[160px] rounded-[6px] border border-[#d1d5db] bg-white px-3 text-[13px] placeholder-[#9ca3af] outline-none focus:border-[#38c08f] transition-colors"
            />
          </div>
          <SelectFilter
              label="类型"
              value={filters.scriptType}
              onChange={(v) => updateFilter("scriptType", v)}
              options={scriptTypeOptions}
              placeholder="请选择"
              width="w-[140px]"
            />
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap text-[13px] text-[#374151]">原剧本ID</span>
            <input
              type="text"
              value={filters.originalScriptId}
              onChange={(e) => updateFilter("originalScriptId", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleQuery()}
              placeholder="请输入原剧本ID"
              className="h-[30px] w-[160px] rounded-[6px] border border-[#d1d5db] bg-white px-3 text-[13px] placeholder-[#9ca3af] outline-none focus:border-[#38c08f] transition-colors"
            />
          </div>
          <SelectFilter
              label="审核状态"
              value={filters.auditStatus}
              onChange={(v) => updateFilter("auditStatus", v)}
              options={myAuditStatusOptions}
              placeholder="请选择"
              width="w-[140px]"
            />
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap text-[13px] text-[#374151]">编剧</span>
            <input
              type="text"
              value={filters.scriptwriter}
              onChange={(e) => updateFilter("scriptwriter", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleQuery()}
              placeholder="请输入编剧"
              className="h-[30px] w-[140px] rounded-[6px] border border-[#d1d5db] bg-white px-3 text-[13px] placeholder-[#9ca3af] outline-none focus:border-[#38c08f] transition-colors"
            />
          </div>
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

      {/* 列表区 */}
      <div className="flex flex-col flex-1 min-h-0 border-x border-b border-[#e5e7eb] bg-white rounded-b-[8px]">
        <div className="flex-1 overflow-auto min-h-0">
          <table className="w-full min-w-[1020px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#f9fafb]">
                {TABLE_HEADERS_MY.map((h) => (
                  <th key={h} className="sticky top-0 z-10 border-b border-[#e5e7eb] bg-[#f9fafb] px-4 py-3 text-left text-[12.5px] font-medium text-[#6b7280] whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mineLoading && pageData.length === 0 ? (
                <tr>
                  <td colSpan={TABLE_HEADERS_MY.length} className="py-16 text-center text-[13px] text-[#9ca3af]">
                    加载中…
                  </td>
                </tr>
              ) : pageData.length === 0 ? (
                <tr>
                  <td colSpan={TABLE_HEADERS_MY.length} className="py-16 text-center text-[13px] text-[#9ca3af]">
                    暂无匹配数据
                  </td>
                </tr>
              ) : (
                pageData.map((row, i) => {
                  const statusStyle = auditStatusStyle[row.auditStatus] ?? { bg: "bg-[#f3f4f6]", text: "text-[#6b7280]" }
                  const canAudit = row.auditStatus === "审核中"
                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        "transition-colors hover:bg-[#fafafa]",
                        i < pageData.length - 1 && "border-b border-[#f3f4f6]"
                      )}
                    >
                      {/* 剧本名称 */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          onClick={() => setDetailRow(row)}
                          className="text-left text-[13px] font-medium text-[#2563eb] hover:text-[#1d4ed8] hover:underline transition-colors"
                        >
                          {row.scriptName}
                        </button>
                      </td>
                      {/* 集数 */}
                      <td className="px-4 py-3 text-[#4b5563] whitespace-nowrap">{row.episodeCount}</td>
                      {/* 原书ID */}
                      <td className="px-4 py-3 font-mono text-[12px] text-[#6b7280] whitespace-nowrap">
                        {row.sourceBookId}
                      </td>
                      {/* 类型 */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={cn(
                          "inline-flex items-center rounded-[4px] px-2 py-0.5 text-[11.5px] font-medium",
                          row.scriptType === "原作" ? "bg-[#eff6ff] text-[#2563eb]" : "bg-[#f5f3ff] text-[#7c3aed]"
                        )}>
                          {row.scriptType}
                        </span>
                      </td>
                      {/* 原剧本ID */}
                      <td className="px-4 py-3 font-mono text-[12px] text-[#6b7280] whitespace-nowrap">
                        {row.originalScriptId || <span className="font-sans text-[#d1d5db]">--</span>}
                      </td>
                      {/* 审核状态 */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={cn(
                          "inline-flex items-center rounded-[4px] px-2 py-0.5 text-[11.5px] font-medium",
                          statusStyle.bg, statusStyle.text
                        )}>
                          {row.auditStatus}
                        </span>
                      </td>
                      {/* 编剧 */}
                      <td className="px-4 py-3 text-[#4b5563] whitespace-nowrap">{row.scriptwriter}</td>
                      {/* 操作列 */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {canAudit && (
                            <button
                              onClick={() => setAuditRow(row)}
                              className="rounded-[4px] border border-[#38c08f] px-2.5 py-1 text-[12px] font-medium text-[#38c08f] hover:bg-[#f0fdf4] transition-colors whitespace-nowrap"
                            >
                              审核
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void openRecordRow(row)}
                            className="rounded-[4px] border border-[#2563eb] px-2.5 py-1 text-[12px] font-medium text-[#2563eb] hover:bg-[#eff6ff] transition-colors whitespace-nowrap"
                          >
                            审核记录
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        <div className="shrink-0">
          <ListPagination
            total={mineTotal}
            {...minePaginationProps}
          />
        </div>
      </div>
      {/* 剧本详情抽屉（复用任务大厅 ScriptDetailDrawer） */}
      {detailRow && (
        <ScriptDetailDrawer row={toScriptRow(detailRow)} onClose={() => setDetailRow(null)} />
      )}

      {/* 剧本审核抽屉 */}
      <AuditHandleDrawer
        row={auditRow}
        onClose={() => setAuditRow(null)}
        onSubmit={handleSubmitAudit}
        onApproved={(r, paidEp, result) => {
          setAuditRow(null)
          if (result?.scriptId) {
            setPublishInfo({
              scriptDbId: result.scriptId,
              displayScriptId: result.displayScriptId ?? "",
              scriptName: r.scriptName,
              episodeCount: r.episodeCount,
              paidEpisode: paidEp,
            })
          }
        }}
      />
      {publishInfo && (
        <PublishTaskDrawer
          scriptId={publishInfo.scriptDbId}
          scriptName={publishInfo.scriptName}
          displayScriptId={publishInfo.displayScriptId}
          episodeCount={publishInfo.episodeCount}
          paidEpisodeLabel={publishInfo.paidEpisode != null ? `第${publishInfo.paidEpisode}集` : "--"}
          zIndex={120}
          onClose={() => setPublishInfo(null)}
          onSuccess={() => { setPublishInfo(null); onMutate() }}
        />
      )}

      <MyAuditRecordDrawer
        row={recordRow}
        onClose={() => setRecordRow(null)}
      />
    </div>
  )
}

// ─── 主组件 ────────────────────────────────────────────────────────────────────

export default function ScriptReview() {
  const [activeTab, setActiveTab] = useState<"taskHall" | "myReview">("taskHall")
  const [listRefreshKey, setListRefreshKey] = useState(0)

  const bumpLists = useCallback(() => {
    setListRefreshKey((k) => k + 1)
  }, [])

  return (
    <div className="flex flex-col flex-1 min-h-0">

      {/* Tab 切换 */}
      <div className="mb-0 flex shrink-0">
        <div className="flex overflow-hidden rounded-t-[8px] border border-b-0 border-[#e5e7eb] bg-white">
          {(
            [
              { key: "taskHall" as const, label: "任务大厅" },
              { key: "myReview" as const, label: "我的审核" },
            ] as const
          ).map((tab, idx) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "relative px-6 py-2.5 text-[13.5px] font-medium transition-colors",
                idx > 0 && "border-l border-[#e5e7eb]",
                activeTab === tab.key
                  ? "bg-white text-[#38c08f]"
                  : "bg-[#f9fafb] text-[#6b7280] hover:text-[#374151]"
              )}
            >
              {tab.label}
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-0 h-[2px] w-full rounded-t-full bg-[#38c08f]" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab 内容 */}
      <div className="flex flex-col flex-1 min-h-0">
        {activeTab === "taskHall"
          ? <TaskHallTab listRefreshKey={listRefreshKey} onMutate={bumpLists} />
          : <MyReviewTab listRefreshKey={listRefreshKey} onMutate={bumpLists} />
        }
      </div>
    </div>
  )
}
