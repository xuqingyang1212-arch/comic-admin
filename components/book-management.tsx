"use client"
// 书籍管理页面 - Book Management v3
import { useState, useRef, useEffect, useCallback } from "react"
import { ChevronDown, X, Search, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import { DateRangePicker } from "@/components/shared"
import { ListPagination } from "@/components/list-pagination"
import { bookApi, scriptDraftApi } from "@/lib/api"
import { toast } from "@/lib/toast"
import { formatDateTime } from "@/lib/format"
import { usePerm } from "@/components/admin-layout"
import { type BookDetail, TRIAL_PARAGRAPH_INDEX } from "@/lib/script-editor"
import { ScriptEditorDrawer } from "@/components/script-editor"
import { useFilters } from "@/hooks/use-filters"
import { usePagination } from "@/hooks/use-pagination"

// ─── Types ────────────────────────────────────────────────────────────────────

interface BookRow {
  id: number
  bookId: string
  bookName: string
  contentType: "原作" | "多版本"
  category: string
  tags: string[]
  wordCount: number
  relatedScriptCount: number
  listingTime: string
}

interface FilterForm {
  bookId: string
  bookName: string
  contentType: string
  listingDateRange: [string, string] | []
  hasScript: string
}

// ─── Filter Default ───────────────────────────────────────────────────────────

const defaultFilters: FilterForm = {
  bookId: "",
  bookName: "",
  contentType: "",
  listingDateRange: [],
  hasScript: "否",
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function countChars(text: string): number {
  return text.replace(/\s/g, "").length
}

// ─── Category / Book Tags ─────────────────────────────────────────────────────

function CategoryTag({ value }: { value: string }) {
  return (
    <span className="inline-flex items-center rounded-[4px] border border-[#bfdbfe] bg-[#eff6ff] px-2 py-0.5 text-[11.5px] font-medium text-[#2563eb] whitespace-nowrap">
      {value}
    </span>
  )
}

function BookTag({ value }: { value: string }) {
  return (
    <span className="inline-flex items-center rounded-[4px] border border-[#6ee7b7] bg-[#ecfdf5] px-1.5 py-0.5 text-[11px] font-medium text-[#059669] whitespace-nowrap">
      {value}
    </span>
  )
}

// ─── Content Type Selector (filter, task-hall style) ─────────────────────────

function BookContentTypeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function handler(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])
  const options = [{ label: "原作", value: "原作" }, { label: "多版本", value: "多版本" }]
  const selected = options.find((o) => o.value === value)
  return (
    <div className="flex items-center gap-2">
      <span className="whitespace-nowrap text-[13px] text-[#374151]">内容类型</span>
      <div className="relative" ref={ref}>
        <button type="button" onClick={() => setOpen(o => !o)}
          className={cn("flex h-[30px] w-[110px] items-center gap-1.5 rounded-[6px] border border-[#d1d5db] bg-white px-3 text-[13px] transition-colors",
            open ? "border-[#38c08f]" : "hover:border-[#38c08f]",
            selected ? "text-[#374151]" : "text-[#9ca3af]")}>
          <span className="flex-1 text-left truncate">{selected ? selected.label : "请选择"}</span>
          {value ? (
            <X size={11} className="shrink-0 text-[#9ca3af] hover:text-[#374151]"
              onClick={(e) => { e.stopPropagation(); onChange(""); setOpen(false) }} />
          ) : <ChevronDown size={12} className="shrink-0 text-[#9ca3af]" />}
        </button>
        {open && (
          <div className="absolute left-0 top-[34px] z-50 min-w-full rounded-[6px] border border-[#e5e7eb] bg-white py-1 shadow-lg">
            {options.map((opt) => (
              <button key={opt.value} onClick={() => { onChange(opt.value); setOpen(false) }}
                className={cn("flex w-full items-center px-3 py-2 text-[13px] transition-colors hover:bg-[#f0fdf4] whitespace-nowrap",
                  value === opt.value ? "text-[#38c08f] font-medium" : "text-[#374151]")}>
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Book Detail Drawer ───────────────────────────────────────────────────────

function BookDetailDrawer({
  detail,
  onClose,
  onOpenScript,
}: {
  detail: BookDetail
  onClose: () => void
  onOpenScript: (bookName: string) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const breakpointRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: KeyboardEvent) { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [onClose])

  const scrollToBreakpoint = useCallback(() => {
    if (breakpointRef.current && scrollRef.current) {
      const containerTop = scrollRef.current.getBoundingClientRect().top
      const bpTop = breakpointRef.current.getBoundingClientRect().top
      scrollRef.current.scrollBy({ top: bpTop - containerTop - 80, behavior: "smooth" })
    }
  }, [])

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 flex h-full w-[780px] flex-col bg-white"
        style={{ boxShadow: "-4px 0 24px rgba(0,0,0,0.12)" }}>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e5e7eb] px-6 py-4">
          <h2 className="text-[15px] font-semibold text-[#111827]">
            书籍详情 - 《{detail.bookName}》
          </h2>
          <button onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-[4px] text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#374151] transition-colors"
            aria-label="关闭">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="relative flex flex-1 flex-col overflow-hidden">
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-5">
            <div className="rounded-[6px] border border-[#e5e7eb] bg-[#fafafa] px-6 py-5">
              {detail.contentParagraphs.slice(0, TRIAL_PARAGRAPH_INDEX).map((para, idx) => (
                <p key={idx} className={cn("text-[13.5px] leading-relaxed text-[#374151]", idx > 0 && "mt-3")}>{para}</p>
              ))}
              <div ref={breakpointRef} className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-[#3b82f6]" />
                <span className="whitespace-nowrap rounded-[4px] border border-[#3b82f6] bg-[#eff6ff] px-3 py-1 text-[12px] font-medium text-[#2563eb]">
                  {detail.breakpointLabel}
                </span>
                <div className="h-px flex-1 bg-[#3b82f6]" />
              </div>
              {detail.contentParagraphs.slice(TRIAL_PARAGRAPH_INDEX).map((para, idx) => (
                <p key={`paid-${idx}`} className={cn("text-[13.5px] leading-relaxed text-[#374151]", idx > 0 && "mt-3")}>{para}</p>
              ))}
            </div>
          </div>

          {/* 悬浮"查看卡点"按钮 */}
          <div className="pointer-events-none absolute right-6 top-1/2 -translate-y-1/2">
            <button onClick={scrollToBreakpoint}
              className="pointer-events-auto flex items-center justify-center rounded-full border border-[#3b82f6] bg-white px-4 py-2 text-[12.5px] font-medium text-[#2563eb] shadow-md hover:bg-[#eff6ff] transition-colors"
              style={{ writingMode: "vertical-rl", textOrientation: "mixed", letterSpacing: "0.05em" }}>
              查看卡点
            </button>
          </div>

          {/* 底部信息栏 */}
          <div className="flex items-center border-t border-[#e5e7eb] bg-white px-6 py-3.5">
            <span className="text-[13px] text-[#6b7280]">
              书籍总字数：<span className="font-medium text-[#111827]">{detail.totalWordCount.toLocaleString()} 字</span>
            </span>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── HasScriptSelect ─────────────────────────────────────────────────────────





function HasScriptSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function handler(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])
  const options = [{ label: "是", value: "是" }, { label: "否", value: "否" }]
  const selected = options.find((o) => o.value === value)
  return (
    <div className="flex items-center gap-2">
      <span className="whitespace-nowrap text-[13px] text-[#374151]">是否关联剧本</span>
      <div className="relative" ref={ref}>
        <button type="button" onClick={() => setOpen(o => !o)}
          className={cn("flex h-[30px] w-[110px] items-center gap-1.5 rounded-[6px] border border-[#d1d5db] bg-white px-3 text-[13px] transition-colors",
            open ? "border-[#38c08f]" : "hover:border-[#38c08f]",
            selected ? "text-[#374151]" : "text-[#9ca3af]")}>
          <span className="flex-1 text-left truncate">{selected ? selected.label : "请选择"}</span>
          {value ? (
            <X size={11} className="shrink-0 text-[#9ca3af] hover:text-[#374151]"
              onClick={(e) => { e.stopPropagation(); onChange(""); setOpen(false) }} />
          ) : <ChevronDown size={12} className="shrink-0 text-[#9ca3af]" />}
        </button>
        {open && (
          <div className="absolute left-0 top-[34px] z-50 min-w-full rounded-[6px] border border-[#e5e7eb] bg-white py-1 shadow-lg">
            {options.map((opt) => (
              <button key={opt.value} onClick={() => { onChange(opt.value); setOpen(false) }}
                className={cn("flex w-full items-center px-3 py-2 text-[13px] transition-colors hover:bg-[#f0fdf4] whitespace-nowrap",
                  value === opt.value ? "text-[#38c08f] font-medium" : "text-[#374151]")}>
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function BookManagement() {
  const canScript = usePerm("resource.book.script")
  const canDetail = usePerm("resource.book.detail")
  const { draft: filter, active: activeFilter, update: setFilterField, apply: applyFilters, reset: resetFilters } = useFilters(defaultFilters)
  const { page, pageSize, resetPage, paginationProps } = usePagination(10)
  const [drawerDetail, setDrawerDetail] = useState<BookDetail | null>(null)
  const [scriptDrawer, setScriptDrawer] = useState<{ bookName: string; detail: BookDetail; draftId: number | null; bookDbId: number; contentType: string } | null>(null)
  const scriptDraftIdRef = useRef<number | null>(null)
  const [data, setData] = useState<BookRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const fetchBooks = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, pageSize }
      if (activeFilter.bookId) params.bookId = activeFilter.bookId.trim()
      if (activeFilter.bookName) params.bookName = activeFilter.bookName.trim()
      if (activeFilter.contentType) params.contentType = activeFilter.contentType
      if (activeFilter.hasScript) params.hasScript = activeFilter.hasScript
      if (activeFilter.listingDateRange.length === 2) {
        params.startDate = activeFilter.listingDateRange[0]
        params.endDate = activeFilter.listingDateRange[1]
      }
      const res = await bookApi.list(params)
      const list = res.list || []
      setData(list)
      setTotal(res.total || 0)
    } catch {
      setData([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [activeFilter, page, pageSize])

  useEffect(() => { fetchBooks() }, [fetchBooks])

  const paginated = data

  function handleQuery() { applyFilters(); resetPage() }
  function handleReset() { resetFilters(); resetPage() }

  async function openDetailDrawer(row: BookRow) {
    try {
      const book = await bookApi.detail(row.id)
      const paragraphs = (book.content || "").split(/\r?\n/).filter((s: string) => s.trim())
      const detailObj: BookDetail = {
        bookId: book.bookId ?? row.bookId,
        bookName: book.bookName ?? row.bookName,
        totalWordCount: book.wordCount ?? row.wordCount,
        trialWordCount: Math.round((book.wordCount ?? row.wordCount) * 0.05),
        breakpointLabel: book.payBreakpoint || "",
        contentParagraphs: paragraphs,
      }
      setDrawerDetail(detailObj)
    } catch {
      setDrawerDetail(null)
    }
  }

  async function openScriptDrawer(row: BookRow) {
    try {
      const book = await bookApi.detail(row.id)
      const paragraphs = (book.content || "").split(/\r?\n/).filter((s: string) => s.trim())
      const detailObj: BookDetail = {
        bookId: book.bookId ?? row.bookId,
        bookName: book.bookName ?? row.bookName,
        totalWordCount: book.wordCount ?? row.wordCount,
        trialWordCount: Math.round((book.wordCount ?? row.wordCount) * 0.05),
        breakpointLabel: book.payBreakpoint || "",
        contentParagraphs: paragraphs,
      }
      scriptDraftIdRef.current = null
      setScriptDrawer({ bookName: row.bookName, detail: detailObj, draftId: null, bookDbId: row.id, contentType: row.contentType })
    } catch (e) {
      toast.errorFrom(e, "打开剧本编辑器失败")
    }
  }

  return (
    <>
      <div className="flex flex-col gap-0 rounded-lg border border-[#e5e7eb] bg-white flex-1 min-h-0">

        {/* ── Filter Bar ── */}
        <div className="border-b border-[#e5e7eb] px-5 py-4">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <div className="flex items-center gap-2">
              <span className="whitespace-nowrap text-[13px] text-[#374151]">书籍ID</span>
              <input type="text" placeholder="请输入书籍ID" value={filter.bookId}
                onChange={(e) => setFilterField("bookId", e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleQuery()}
                className="h-[30px] w-[148px] rounded-[6px] border border-[#d1d5db] bg-white px-3 text-[13px] text-[#374151] placeholder-[#9ca3af] outline-none focus:border-[#38c08f] transition-colors" />
            </div>
            <div className="flex items-center gap-2">
              <span className="whitespace-nowrap text-[13px] text-[#374151]">书籍名称</span>
              <input type="text" placeholder="请输入书籍名称" value={filter.bookName}
                onChange={(e) => setFilterField("bookName", e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleQuery()}
                className="h-[30px] w-[148px] rounded-[6px] border border-[#d1d5db] bg-white px-3 text-[13px] text-[#374151] placeholder-[#9ca3af] outline-none focus:border-[#38c08f] transition-colors" />
            </div>
            <BookContentTypeSelect value={filter.contentType} onChange={(v) => setFilterField("contentType", v)} />
            <HasScriptSelect value={filter.hasScript} onChange={(v) => setFilterField("hasScript", v)} />
            <div className="flex items-center gap-2">
              <span className="whitespace-nowrap text-[13px] text-[#374151]">上架时间</span>
              <DateRangePicker value={filter.listingDateRange} onChange={(v) => setFilterField("listingDateRange", v)} />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={handleQuery}
                className="flex h-[30px] items-center gap-1.5 rounded-[6px] bg-[#38c08f] px-4 text-[13px] font-medium text-white hover:bg-[#2da87a] transition-colors">
                <Search size={13} />查询
              </button>
              <button onClick={handleReset}
                className="flex h-[30px] items-center gap-1.5 rounded-[6px] border border-[#d1d5db] bg-white px-4 text-[13px] text-[#374151] hover:bg-[#f5f6f7] transition-colors">
                <RotateCcw size={12} />重置
              </button>
            </div>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="flex-1 overflow-auto min-h-0">
          <table className="w-full min-w-[1080px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#f9fafb]">
                {[
                  { label: "书籍ID", w: "w-[120px]" },
                  { label: "书籍名称", w: "w-[240px]" },
                  { label: "内容类型", w: "w-[90px]" },
                  { label: "分类", w: "w-[72px]" },
                  { label: "标签", w: "" },
                  { label: "字数", w: "w-[80px]" },
                  { label: "关联剧本数", w: "w-[88px]" },
                  { label: "上架时间", w: "w-[148px]" },
                  { label: "操作", w: "w-[140px]" },
                ].map((col) => (
                  <th key={col.label}
                    className={cn("sticky top-0 z-10 border-b border-[#e5e7eb] bg-[#f9fafb] px-4 py-3 text-left text-[12.5px] font-medium text-[#6b7280] whitespace-nowrap", col.w)}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-[13px] text-[#9ca3af]">暂无数据</td>
                </tr>
              ) : (
                paginated.map((row, i) => (
                  <tr key={row.id}
                    className={cn("transition-colors hover:bg-[#fafafa]",
                      i < paginated.length - 1 && "border-b border-[#f3f4f6]")}>
                    <td className="px-4 py-3 font-mono text-[12px] text-[#6b7280] whitespace-nowrap">{row.bookId}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {canDetail ? (
                        <button onClick={() => openDetailDrawer(row)}
                          className="font-medium text-[#2563eb] hover:text-[#1d4ed8] hover:underline transition-colors text-left">
                          {row.bookName}
                        </button>
                      ) : (
                        <span className="font-medium text-[#111827]">{row.bookName}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={cn("inline-flex items-center rounded-[4px] px-2 py-0.5 text-[11.5px] font-medium",
                        row.contentType === "原作"
                          ? "bg-[#f0f9ff] border border-[#7dd3fc] text-[#0284c7]"
                          : "bg-[#fdf4ff] border border-[#e9d5ff] text-[#9333ea]")}>
                        {row.contentType}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap"><CategoryTag value={row.category} /></td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-nowrap gap-1">
                        {row.tags.map((tag) => <BookTag key={tag} value={tag} />)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#374151] whitespace-nowrap">{row.wordCount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-center text-[#374151] whitespace-nowrap">
                      {row.relatedScriptCount === 0
                        ? <span className="text-[#9ca3af]">0</span>
                        : <span className="font-medium text-[#38c08f]">{row.relatedScriptCount}</span>}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#6b7280] whitespace-nowrap">{formatDateTime(row.listingTime)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {canScript && (
                        <button
                          onClick={() => openScriptDrawer(row)}
                          className="rounded-[4px] border border-[#38c08f] px-2.5 py-1 text-[12px] font-medium text-[#38c08f] hover:bg-[#f0fdf4] transition-colors whitespace-nowrap">
                          创作剧本
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="shrink-0">
          <ListPagination
            total={total}
            {...paginationProps}
          />
        </div>
      </div>

      {/* ── Book Detail Drawer ── */}
      {drawerDetail && !scriptDrawer && (
        <BookDetailDrawer
          detail={drawerDetail}
          onClose={() => setDrawerDetail(null)}
          onOpenScript={(name) => {
            const row = data.find((r) => r.bookName === name)
            if (row) {
              setDrawerDetail(null)
              openScriptDrawer(row)
            }
          }}
        />
      )}

      {/* ── Script Editor Drawer ── */}
      {scriptDrawer && (
        <ScriptEditorDrawer
          bookName={scriptDrawer.bookName}
          detail={scriptDrawer.detail}
          onClose={() => { scriptDraftIdRef.current = null; setScriptDrawer(null); fetchBooks() }}
          persistBookId={scriptDrawer.bookDbId}
          persistScriptType="原作"
          onPersistSave={async (body) => {
            if (scriptDrawer.draftId != null || scriptDraftIdRef.current != null) {
              const id = scriptDrawer.draftId ?? scriptDraftIdRef.current!
              await scriptDraftApi.update(id, body)
            } else {
              const draft = await scriptDraftApi.create(body)
              scriptDraftIdRef.current = draft.id
              setScriptDrawer((prev) => prev ? { ...prev, draftId: draft.id } : prev)
            }
          }}
          onPersistSubmit={async () => {
            const id = scriptDrawer.draftId ?? scriptDraftIdRef.current
            if (id != null) {
              await scriptDraftApi.submit(id)
            }
          }}
        />
      )}
    </>
  )
}
