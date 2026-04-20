"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { ChevronDown, X, Search, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import { scriptApi, bookApi, scriptDraftApi } from "@/lib/api"
import { toast } from "@/lib/toast"
import { ListPagination } from "@/components/list-pagination"
import { useFilters } from "@/hooks/use-filters"
import { usePagination } from "@/hooks/use-pagination"
import { FilterInput, DateRangePicker, PublishTaskDrawer } from "@/components/shared"
import { formatDateTime } from "@/lib/format"
import {
  sharedParagraphs,
  TRIAL_PARAGRAPH_INDEX,
  newId,
  calcTotalWords,
  calcEpisodeIndex,
  calcSegmentWords,
  buildInitialNodes,
  type EditorNode,
  type BookDetail,
  type ScriptDraftPersistBody,
} from "@/lib/script-editor"
import {
  OrangeDividerNode,
  InsertDividerBtn,
  ParagraphEditor,
  FloatingToolbar,
  ScriptEditorDrawer,
} from "@/components/script-editor"
import { usePerm } from "@/components/admin-layout"

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScriptRow {
  id: number
  scriptId: string
  scriptName: string
  episodeCount: number
  paidEpisode: string        // e.g. "第5集" or "" (means not set)
  sourceBookId: string
  bookDbId: number
  scriptType: "原作" | "多版本"
  originalScriptId: string  // empty string when type === "原作"
  writer: string
  reviewer: string           // empty string means no reviewer yet
  createdAt: string
}

interface FilterForm {
  scriptId: string
  scriptName: string
  sourceBookId: string
  scriptType: string
  originalScriptId: string
  writer: string
  reviewer: string
  createdAtRange: [string, string] | []
}

// ─── Options ──────────────────────────────────────────────────────────────────

const scriptTypeOptions = [
  { label: "原作", value: "原作" },
  { label: "多版本", value: "多版本" },
]

// ─── Defaults ─────────────────────────────────────────────────────────────────

const defaultFilters: FilterForm = {
  scriptId: "",
  scriptName: "",
  sourceBookId: "",
  scriptType: "",
  originalScriptId: "",
  writer: "",
  reviewer: "",
  createdAtRange: [],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatApiDateTime = formatDateTime

function mapScriptFromApi(raw: Record<string, unknown>): ScriptRow {
  const book = raw.book as { bookId?: string | number } | undefined
  const bookId = book?.bookId ?? raw.bookId
  const originalScript = raw.originalScript as { scriptId?: string } | undefined
  const origBizId = originalScript?.scriptId
  const paid = (raw.payEpisode ?? raw.paidEpisode) as string | undefined
  const writer = raw.writer as { name?: string } | undefined
  const reviewer = raw.reviewer as { name?: string } | undefined
  return {
    id: Number(raw.id),
    scriptId: String(raw.scriptId ?? ""),
    scriptName: String(raw.scriptName ?? ""),
    episodeCount: Number(raw.episodeCount ?? 0),
    paidEpisode: paid ? String(paid) : "",
    sourceBookId: bookId != null && bookId !== "" ? String(bookId) : "",
    bookDbId: Number(raw.bookId ?? 0),
    scriptType: raw.scriptType === "多版本" ? "多版本" : "原作",
    originalScriptId: origBizId ? String(origBizId) : "",
    writer: writer?.name ?? "",
    reviewer: reviewer?.name ?? "",
    createdAt: formatApiDateTime(String(raw.createdAt ?? "")),
  }
}

// ─── ScriptTypeSelector (task-hall style, no radio dots) ─────────────────────

function ScriptTypeSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])
  const selected = scriptTypeOptions.find((o) => o.value === value)
  return (
    <div className="flex items-center gap-2">
      <span className="whitespace-nowrap text-[13px] text-[#374151]">类型</span>
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className={cn(
            "flex h-[30px] w-[110px] items-center gap-1.5 rounded-[6px] border border-[#d1d5db] bg-white px-3 text-[13px] transition-colors",
            open ? "border-[#38c08f]" : "hover:border-[#38c08f]",
            selected ? "text-[#374151]" : "text-[#9ca3af]"
          )}
        >
          <span className="flex-1 text-left truncate">{selected ? selected.label : "请选择"}</span>
          {value ? (
            <X size={11} className="shrink-0 text-[#9ca3af] hover:text-[#374151]" onClick={(e) => { e.stopPropagation(); onChange(""); setOpen(false) }} />
          ) : (
            <ChevronDown size={12} className="shrink-0 text-[#9ca3af]" />
          )}
        </button>
        {open && (
          <div className="absolute left-0 top-[34px] z-50 min-w-full rounded-[6px] border border-[#e5e7eb] bg-white py-1 shadow-lg">
            {scriptTypeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false) }}
                className={cn("flex w-full items-center px-3 py-2 text-[13px] transition-colors hover:bg-[#f0fdf4] whitespace-nowrap", value === opt.value ? "text-[#38c08f] font-medium" : "text-[#374151]")}
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

// SecondCreationDrawer removed — remake now uses ScriptEditorDrawer (same flow as book creation)

// ─── ScriptDetailDrawer ───────────────────────────────────────────────────────
// 只读剧本详情抽屉：不含蓝色原书卡点，只含橙色分集线 + 付费卡点标识

function buildDetailNodes(episodeCount: number): EditorNode[] {
  const paragraphCount = sharedParagraphs.length
  // 计算分集点插入位置（在哪几个段落后面插橙色分界线）
  const gap = Math.max(3, Math.floor(paragraphCount / Math.max(episodeCount, 2)))
  const breakpointIndices = new Set<number>()
  for (let ep = 1; ep < episodeCount; ep++) {
    const idx = Math.min(ep * gap - 1, paragraphCount - 2)
    if (idx > 0) breakpointIndices.add(idx)
  }

  const result: EditorNode[] = []
  let idCounter = 0
  const nextId = () => `rd-${idCounter++}`

  sharedParagraphs.forEach((text, i) => {
    result.push({ type: "paragraph", id: nextId(), html: text })
    // 跳过蓝色原书卡点（TRIAL_PARAGRAPH_INDEX），只渲染橙色分集线
    if (breakpointIndices.has(i)) {
      result.push({ type: "orange-divider", id: nextId(), deletable: false })
    }
  })
  // 末尾加最后一集分界线
  result.push({ type: "orange-divider", id: nextId(), deletable: false })
  return result
}

function ReadonlyOrangeDivider({
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
      <div className={cn("h-px flex-1", isPaidEpisode ? "bg-[#f97316]" : "bg-[#f97316]")} />
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-[4px] border px-3 py-1",
          isPaidEpisode
            ? "border-[#f97316] bg-[#fff7ed]"
            : "border-[#f97316] bg-[#fff7ed]"
        )}
      >
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

function ScriptDetailDrawer({
  row,
  onClose,
}: {
  row: ScriptRow
  onClose: () => void
}) {
  const [nodes, setNodes] = useState<EditorNode[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  const paidEpisodeNum = row.paidEpisode
    ? parseInt(row.paidEpisode.replace(/[^0-9]/g, ""), 10)
    : null

  useEffect(() => {
    let cancelled = false
    async function load() {
      setDetailLoading(true)
      try {
        const [script, book] = await Promise.all([
          scriptApi.detail(row.id),
          row.bookDbId ? bookApi.detail(row.bookDbId).catch(() => null) : Promise.resolve(null),
        ])
        if (cancelled) return

        const content: string = script.content ?? ""
        const paragraphs = content.split("\n").filter((s: string) => s.trim())
        if (paragraphs.length === 0) { setNodes([]); return }

        let dividerPositions: number[] = []
        try {
          const raw = script.payBreakpointData
          if (raw) dividerPositions = JSON.parse(raw)
        } catch { /* ignore */ }

        const trialIdx = book?.payBreakpoint
          ? Math.round(paragraphs.length * (parseInt(book.payBreakpoint.replace(/[^0-9]/g, ""), 10) || 30) / 100)
          : -1
        const trialLabel = book?.payBreakpoint ?? ""

        let idCounter = 0
        const nextId = () => `sd-${idCounter++}`
        const dividerSet = new Set(dividerPositions)
        const built: EditorNode[] = []
        paragraphs.forEach((text: string, i: number) => {
          built.push({ type: "paragraph", id: nextId(), html: text })
          if (i === trialIdx - 1 && trialLabel) {
            built.push({ type: "blue-divider", id: nextId(), label: trialLabel })
          }
          if (dividerSet.has(i)) {
            built.push({ type: "orange-divider", id: nextId(), deletable: false })
          }
        })
        setNodes(built)
      } catch { /* ignore */ }
      finally { if (!cancelled) setDetailLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [row.id, row.bookDbId])

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

  // 计算每个 orange-divider 对应的集数 → 判断是否为付费卡点
  function isPaidDivider(nodeId: string): boolean {
    if (paidEpisodeNum === null) return false
    const ep = calcEpisodeIndex(nodes, nodeId)
    return ep === paidEpisodeNum
  }

  return (
    <>
      {/* 遮罩 */}
      <div
        className="fixed inset-0 bg-black/40"
        style={{ zIndex: 120 }}
        onClick={onClose}
      />
      {/* 抽屉主体 */}
      <div
        className="fixed right-0 top-0 flex h-full w-[800px] flex-col bg-white"
        style={{ zIndex: 121, boxShadow: "-4px 0 32px rgba(0,0,0,0.15)" }}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-[#e5e7eb] px-6 py-4">
          <div className="flex items-center gap-3">
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

        <div className="flex flex-1 overflow-hidden">
          <div className="relative flex flex-1 flex-col overflow-hidden">
            <div ref={scrollRef} className="flex-1 overflow-y-auto bg-[#f9fafb] px-8 py-5">
              {detailLoading ? (
                <div className="flex h-full items-center justify-center text-[13px] text-[#9ca3af]">加载中...</div>
              ) : (
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
                        <ReadonlyOrangeDivider
                          nodes={nodes}
                          nodeId={node.id}
                          isPaidEpisode={paid}
                        />
                      </div>
                    )
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
                  return null
                })}
              </div>
              )}
            </div>

            {/* 悬浮"查看卡点"按钮 */}
            {paidEpisodeNum !== null && (
              <div className="pointer-events-none absolute right-6 top-1/2 -translate-y-1/2">
                <button
                  onClick={scrollToBreakpoint}
                  className="pointer-events-auto flex items-center justify-center rounded-full border border-[#f97316] bg-white px-4 py-2 text-[12.5px] font-medium text-[#ea580c] shadow-md hover:bg-[#fff7ed] transition-colors"
                  style={{ writingMode: "vertical-rl", textOrientation: "mixed", letterSpacing: "0.05em" }}
                >
                  查看卡点
                </button>
              </div>
            )}

            {/* 底部字数 */}
            <div className="flex items-center border-t border-[#e5e7eb] bg-white px-6 py-3">
              <span className="text-[13px] text-[#6b7280]">
                全文字数：<span className="font-medium text-[#111827]">{totalWords.toLocaleString()} 字</span>
                <span className="mx-2 text-[#d1d5db]">|</span>
                集数：<span className="font-medium text-[#111827]">{Math.max(1, nodes.filter((n) => n.type === "orange-divider").length)} 集</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ScriptManagement() {
  const { draft: filters, active: appliedFilters, update: setField, apply: applyFilters, reset: resetFilters } = useFilters(defaultFilters)
  const { page: currentPage, pageSize, resetPage, paginationProps } = usePagination(10)
  const [data, setData] = useState<ScriptRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  // Drawer state
  const [publishRow, setPublishRow] = useState<ScriptRow | null>(null)
  const [remakeDrawer, setRemakeDrawer] = useState<{
    bookName: string
    detail: BookDetail
    draftId: number | null
    bookDbId: number
    originalScriptId: number
  } | null>(null)
  const remakeDraftIdRef = useRef<number | null>(null)
  const [detailRow, setDetailRow] = useState<ScriptRow | null>(null)

  const canDetail = usePerm("resource.script.detail")
  const canPublish = usePerm("resource.script.publish")
  const canRemake = usePerm("resource.script.remake")

  const fetchScripts = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = {
        page: currentPage,
        pageSize,
      }
      const f = appliedFilters
      const scriptId = f.scriptId.trim()
      if (scriptId) params.scriptId = scriptId
      const scriptName = f.scriptName.trim()
      if (scriptName) params.scriptName = scriptName
      if (f.scriptType) params.scriptType = f.scriptType
      const writer = f.writer.trim()
      if (writer) params.writer = writer
      const reviewer = f.reviewer.trim()
      if (reviewer) params.reviewer = reviewer
      if (f.createdAtRange.length === 2) {
        const [start, end] = f.createdAtRange as [string, string]
        if (start) params.startDate = start
        if (end) params.endDate = end
      }
      const res = await scriptApi.list(params)
      const list = Array.isArray(res.list) ? res.list : []
      const mapped = list.map((item) => mapScriptFromApi(item as Record<string, unknown>))
      setData(mapped)
      setTotal(Number(res.total) || 0)
    } catch {
      setData([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [appliedFilters, currentPage, pageSize])

  useEffect(() => {
    void fetchScripts()
  }, [fetchScripts])

  function handleQuery() { applyFilters(); resetPage() }
  function handleReset() { resetFilters(); resetPage() }

  async function openRemakeDrawer(row: ScriptRow) {
    try {
      const [script, book] = await Promise.all([
        scriptApi.detail(row.id),
        row.bookDbId ? bookApi.detail(row.bookDbId).catch(() => null) : Promise.resolve(null),
      ])

      const content: string = script.content ?? ""
      const paragraphs = content.split("\n").filter((s: string) => s.trim())

      let dividerPositions: number[] = []
      try {
        const raw = script.payBreakpointData
        if (raw) dividerPositions = JSON.parse(raw)
      } catch { /* ignore */ }

      const detailObj: BookDetail = {
        bookId: book?.bookId ?? row.sourceBookId ?? "",
        bookName: book?.bookName ?? row.scriptName,
        totalWordCount: book?.wordCount ?? 0,
        trialWordCount: 0,
        breakpointLabel: book?.payBreakpoint ?? "",
        contentParagraphs: paragraphs.length > 0 ? paragraphs : [],
        dividerPositions,
      }

      remakeDraftIdRef.current = null
      setRemakeDrawer({
        bookName: row.scriptName,
        detail: detailObj,
        draftId: null,
        bookDbId: row.bookDbId,
        originalScriptId: row.id,
      })
    } catch (e) {
      toast.errorFrom(e, "打开剧本二创失败")
    }
  }

  // Table column definitions
  const columns = [
    { label: "剧本ID", w: "", align: "" },
    { label: "剧本名称", w: "", align: "" },
    { label: "集数", w: "", align: "text-center" },
    { label: "付费卡点", w: "", align: "" },
    { label: "书籍ID", w: "", align: "" },
    { label: "类型", w: "", align: "" },
    { label: "原剧本ID", w: "", align: "" },
    { label: "编剧", w: "", align: "" },
    { label: "审核员", w: "", align: "" },
    { label: "创建时间", w: "", align: "" },
    { label: "操作", w: "w-px", align: "" },
  ]

  return (
    <>
      <div className="flex flex-col gap-0 rounded-lg bg-white border border-[#e5e7eb] flex-1 min-h-0">

        {/* Filter Area */}
        <div className="border-b border-[#e5e7eb] px-5 py-4">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <FilterInput label="剧本ID" placeholder="请输入剧本ID" value={filters.scriptId} onChange={(v) => setField("scriptId", v)} width="w-[160px]" />
            <FilterInput label="剧本名称" placeholder="请输入剧本名称" value={filters.scriptName} onChange={(v) => setField("scriptName", v)} width="w-[140px]" />
            <FilterInput label="原书ID" placeholder="请输入原书ID" value={filters.sourceBookId} onChange={(v) => setField("sourceBookId", v)} width="w-[160px]" />
            <ScriptTypeSelector value={filters.scriptType} onChange={(v) => setField("scriptType", v)} />
            <FilterInput label="原剧本ID" placeholder="请输入原剧本ID" value={filters.originalScriptId} onChange={(v) => setField("originalScriptId", v)} width="w-[160px]" />
            <FilterInput label="编剧" placeholder="请输入编剧" value={filters.writer} onChange={(v) => setField("writer", v)} width="w-[120px]" />
            <FilterInput label="审核员" placeholder="请输入审核员" value={filters.reviewer} onChange={(v) => setField("reviewer", v)} width="w-[120px]" />
            <div className="flex items-center gap-2">
              <span className="whitespace-nowrap text-[13px] text-[#374151]">创建时间</span>
              <DateRangePicker value={filters.createdAtRange} onChange={(v) => setField("createdAtRange", v)} />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={handleQuery} className="flex h-[30px] items-center gap-1.5 rounded-[6px] bg-[#38c08f] px-4 text-[13px] font-medium text-white hover:bg-[#2da87a] transition-colors">
                <Search size={13} />
                查询
              </button>
              <button onClick={handleReset} className="flex h-[30px] items-center gap-1.5 rounded-[6px] border border-[#d1d5db] bg-white px-4 text-[13px] text-[#374151] hover:bg-[#f5f6f7] transition-colors">
                <RotateCcw size={13} />
                重置
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-x-auto">
          <table className="w-full min-w-[1200px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#f9fafb]">
                {columns.map(({ label, w, align }) => (
                  <th key={label} className={cn("sticky top-0 z-10 border-b border-[#e5e7eb] bg-[#f9fafb] px-4 py-3 text-left text-[12.5px] font-medium text-[#6b7280] whitespace-nowrap", w, align)}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="py-12 text-center text-[13px] text-[#9ca3af]">
                    {loading ? "加载中…" : "暂无数据"}
                  </td>
                </tr>
              ) : (
                data.map((row, i) => (
                  <tr
                    key={row.id}
                    className={cn("transition-colors hover:bg-[#f9fafb]", i < data.length - 1 && "border-b border-[#f3f4f6]")}
                  >
                    <td className="px-4 py-3 font-mono text-[12px] text-[#4b5563] whitespace-nowrap">{row.scriptId}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {canDetail ? (
                        <button
                          type="button"
                          onClick={() => setDetailRow(row)}
                          className="text-left text-[13px] font-medium text-[#2563eb] hover:text-[#1d4ed8] hover:underline transition-colors"
                        >
                          {row.scriptName}
                        </button>
                      ) : (
                        <span className="text-[13px] font-medium text-[#111827]">{row.scriptName}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-[#374151] whitespace-nowrap">{row.episodeCount}</td>
                    <td className="px-4 py-3 text-[#374151] whitespace-nowrap">
                      {row.paidEpisode ? (
                        <span className="inline-flex items-center rounded-[4px] bg-[#fef9ee] px-2 py-0.5 text-[11.5px] text-[#b45309] border border-[#fde68a]">
                          {row.paidEpisode}
                        </span>
                      ) : (
                        <span className="text-[#d1d5db]">--</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] text-[#4b5563] whitespace-nowrap">{row.sourceBookId}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={cn(
                        "inline-flex items-center rounded-[4px] px-2 py-0.5 text-[11.5px] font-medium border",
                        row.scriptType === "原作"
                          ? "bg-[#eff6ff] text-[#2563eb] border-[#bfdbfe]"
                          : "bg-[#f5f3ff] text-[#7c3aed] border-[#ddd6fe]"
                      )}>
                        {row.scriptType}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] text-[#4b5563] whitespace-nowrap">
                      {row.originalScriptId || <span className="text-[#d1d5db]">--</span>}
                    </td>
                    <td className="px-4 py-3 text-[#4b5563] whitespace-nowrap">{row.writer}</td>
                    <td className="px-4 py-3 text-[#4b5563] whitespace-nowrap">
                      {row.reviewer || <span className="text-[#d1d5db]">--</span>}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#6b7280] whitespace-nowrap">{row.createdAt}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {canPublish && (
                          <button
                            type="button"
                            onClick={() => setPublishRow(row)}
                            className="rounded-[4px] border border-[#38c08f] px-2.5 py-1 text-[12px] font-medium text-[#38c08f] hover:bg-[#f0fdf4] transition-colors whitespace-nowrap"
                          >
                            发布制作任务
                          </button>
                        )}
                        {canRemake && (
                          <button
                            type="button"
                            onClick={() => openRemakeDrawer(row)}
                            className="rounded-[4px] border border-[#38c08f] px-2.5 py-1 text-[12px] font-medium text-[#38c08f] hover:bg-[#f0fdf4] transition-colors whitespace-nowrap"
                          >
                            剧本二创
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

      {/* Drawers */}
      {detailRow && (
        <ScriptDetailDrawer
          row={detailRow}
          onClose={() => setDetailRow(null)}
        />
      )}
      {publishRow && (
        <PublishTaskDrawer
          scriptId={publishRow.id}
          scriptName={publishRow.scriptName}
          displayScriptId={publishRow.scriptId}
          episodeCount={publishRow.episodeCount}
          paidEpisodeLabel={publishRow.paidEpisode || "--"}
          onClose={() => setPublishRow(null)}
        />
      )}
      {remakeDrawer && (
        <ScriptEditorDrawer
          bookName={remakeDrawer.bookName}
          detail={remakeDrawer.detail}
          onClose={() => { remakeDraftIdRef.current = null; setRemakeDrawer(null); fetchScripts() }}
          persistBookId={remakeDrawer.bookDbId}
          persistScriptType="多版本"
          persistOriginalScriptId={remakeDrawer.originalScriptId}
          onPersistSave={async (body) => {
            if (remakeDrawer.draftId != null || remakeDraftIdRef.current != null) {
              const id = remakeDrawer.draftId ?? remakeDraftIdRef.current!
              await scriptDraftApi.update(id, body)
            } else {
              const draft = await scriptDraftApi.create(body)
              remakeDraftIdRef.current = draft.id
              setRemakeDrawer((prev) => prev ? { ...prev, draftId: draft.id } : prev)
            }
          }}
          onPersistSubmit={async () => {
            const id = remakeDrawer.draftId ?? remakeDraftIdRef.current
            if (id != null) {
              await scriptDraftApi.submit(id)
            }
          }}
        />
      )}

    </>
  )
}
