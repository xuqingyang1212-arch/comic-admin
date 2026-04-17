"use client"
// 书籍管理页面 - Book Management v3
import { useState, useRef, useEffect, useCallback } from "react"
import { ChevronDown, X, Search, RotateCcw, Plus, Bold, Underline, Strikethrough } from "lucide-react"
import { cn } from "@/lib/utils"
import { DateRangePicker } from "@/components/shared"
import { ListPagination, type PageSizeOption } from "@/components/list-pagination"
import { bookApi, scriptDraftApi } from "@/lib/api"
import { toast } from "@/lib/toast"
import { usePerm } from "@/components/admin-layout"

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

// ─── Mock Table Data (cleared) ───────────────────────────────────────────────

const bookTableMock: BookRow[] = []

// ─── Shared Paragraphs ────────────────────────────────────────────────────────

const sharedParagraphs: string[] = []

// 试读截止段落索引（前N段为免费试读）
const TRIAL_PARAGRAPH_INDEX = 28

export interface BookDetail {
  bookId: string
  bookName: string
  totalWordCount: number
  trialWordCount: number
  breakpointLabel: string
  contentParagraphs: string[]
  dividerPositions?: number[]
}

const BREAKPOINT_PCT_MAP: Record<string, number> = {}

function buildDetail(row: BookRow): BookDetail {
  const paragraphs = sharedParagraphs
  const pct = BREAKPOINT_PCT_MAP[row.bookId]
  const trialWordCount = pct
    ? Math.round(row.wordCount * pct / 100)
    : 704
  const ratio = pct ?? Math.round((trialWordCount / row.wordCount) * 100)
  return {
    bookId: row.bookId,
    bookName: row.bookName,
    totalWordCount: row.wordCount,
    trialWordCount,
    breakpointLabel: `原书：试读字数${trialWordCount}字，占全文${ratio}%`,
    contentParagraphs: paragraphs,
  }
}

const bookDetailMockMap: Record<string, BookDetail> = Object.fromEntries(
  bookTableMock.map((row) => [row.bookId, buildDetail(row)])
)

// ─── Filter Default ───────────────────────────────────────────────────────────

const defaultFilters: FilterForm = {
  bookId: "",
  bookName: "",
  contentType: "",
  listingDateRange: [],
  hasScript: "否",
}

const emptyFilters: FilterForm = {
  bookId: "",
  bookName: "",
  contentType: "",
  listingDateRange: [],
  hasScript: "",
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

// ─── Script Editor Drawer ────────────────────────────────────────────────────

// 编辑器节点类型：段落 | 蓝色原书卡点（固定）| 橙色分集线（可删）
export type EditorNode =
  | { type: "paragraph"; id: string; html: string }
  | { type: "blue-divider"; id: string; label: string }
  | { type: "orange-divider"; id: string; deletable: boolean }

let _idCounter = 0
export function newId() { return `n${++_idCounter}` }

const FONT_SIZES = ["12", "14", "16", "18", "20"] as const
const PRESET_COLORS = [
  "#111827", "#374151", "#6b7280", "#9ca3af",
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#3b82f6", "#8b5cf6", "#ec4899", "#ffffff",
]

// 统计从上一条 orange-divider（或开头）到 upToIdx（不含）之间所有段落字数
function calcSegmentWords(nodes: EditorNode[], upToIdx: number): number {
  let start = 0
  for (let i = upToIdx - 1; i >= 0; i--) {
    if (nodes[i].type === "orange-divider") { start = i + 1; break }
  }
  let count = 0
  for (let i = start; i < upToIdx; i++) {
    const n = nodes[i]
    if (n.type === "paragraph") {
      count += (n.html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ")).replace(/\s/g, "").length
    }
  }
  return count
}

function calcTotalWords(nodes: EditorNode[]): number {
  return nodes.reduce((s, n) => {
    if (n.type !== "paragraph") return s
    return s + (n.html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ")).replace(/\s/g, "").length
  }, 0)
}

function calcEpisodeIndex(nodes: EditorNode[], nodeId: string): number {
  let count = 0
  for (const n of nodes) {
    if (n.type === "orange-divider") { count++; if (n.id === nodeId) return count }
  }
  return count
}

function buildInitialNodes(paragraphs: string[], trialIdx: number, trialLabel: string, dividerPositions?: number[]): EditorNode[] {
  const nodes: EditorNode[] = []
  const dividerSet = new Set(dividerPositions ?? [])
  paragraphs.forEach((text, i) => {
    nodes.push({ type: "paragraph", id: newId(), html: text })
    if (i === trialIdx - 1 && trialLabel) {
      nodes.push({ type: "blue-divider", id: newId(), label: trialLabel })
    }
    if (dividerSet.has(i)) {
      nodes.push({ type: "orange-divider", id: newId(), deletable: true })
    }
  })
  if (!dividerPositions || dividerPositions.length === 0) {
    nodes.push({ type: "orange-divider", id: newId(), deletable: false })
  }
  return nodes
}

// 橙色分集线
export function OrangeDividerNode({
  node, nodes, onDelete,
}: {
  node: Extract<EditorNode, { type: "orange-divider" }>
  nodes: EditorNode[]
  onDelete: (id: string) => void
}) {
  const [hovered, setHovered] = useState(false)
  const idx = nodes.findIndex((n) => n.id === node.id)
  const episodeNum = calcEpisodeIndex(nodes, node.id)
  const wordCount = calcSegmentWords(nodes, idx)
  return (
    <div
      className="my-1 flex select-none items-center gap-2 py-0.5"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="h-px flex-1 bg-[#f97316]" />
      <div className="flex items-center gap-0 rounded-[4px] border border-[#f97316] bg-[#fff7ed] px-3 py-1">
        <span className="text-[12px] font-medium text-[#ea580c]">
          第{episodeNum}集，总计{wordCount}字
        </span>
        {node.deletable && (
          <span
            className={cn(
              "overflow-hidden transition-all duration-150",
              hovered ? "ml-1.5 max-w-[20px] opacity-100" : "ml-0 max-w-0 opacity-0"
            )}
          >
            <button
              onMouseDown={(e) => { e.preventDefault(); onDelete(node.id) }}
              className="flex h-4 w-4 items-center justify-center rounded text-[#ea580c] hover:bg-[#fed7aa]"
              title="删除此分集线"
            >
              <X size={11} />
            </button>
          </span>
        )}
      </div>
      <div className="h-px flex-1 bg-[#f97316]" />
    </div>
  )
}

// 段落间插入分集线按钮（disabled 时不显示插入入口）
export function InsertDividerBtn({ onInsert, disabled }: { onInsert: () => void; disabled?: boolean }) {
  if (disabled) return <div className="h-2" />
  return (
    <div className="group relative my-0 flex h-5 items-center justify-center">
      <div className="absolute inset-x-0 top-1/2 h-px bg-transparent transition-colors group-hover:bg-[#f3f4f6]" />
      <button
        onMouseDown={(e) => { e.preventDefault(); onInsert() }}
        className="relative z-10 hidden items-center gap-1 rounded-[3px] border border-[#fed7aa] bg-[#fff7ed] px-2 py-0.5 text-[11px] text-[#ea580c] opacity-0 transition-all group-hover:flex group-hover:opacity-100 hover:bg-[#ffedd5]">
        <Plus size={10} />新增分集线
      </button>
    </div>
  )
}

// ─── 单段落可编辑区（IME-safe + contentEditable）────────────────────────────

export function ParagraphEditor({
  node,
  onChange,
}: {
  node: Extract<EditorNode, { type: "paragraph" }>
  onChange: (id: string, html: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const isComposing = useRef(false)
  const lastHtml = useRef(node.html)

  // 仅在首次挂载时设置初始内容，之后由用户控制
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
      data-node-id={node.id}
      onCompositionStart={() => { isComposing.current = true }}
      onCompositionEnd={() => {
        isComposing.current = false
        syncHtml()
      }}
      onInput={() => {
        if (!isComposing.current) syncHtml()
      }}
      onBlur={syncHtml}
      className="min-h-[1.6em] rounded-[2px] py-0.5 text-[13.5px] leading-relaxed text-[#374151] outline-none focus:bg-[#f8fffe] focus:ring-1 focus:ring-[#38c08f]/30"
      style={{ whiteSpace: "pre-wrap" }}
    />
  )
}

// ─── 浮动工具栏 ──────────────────────────────────────────────────────────────

interface FloatingToolbarPos { top: number; left: number; above: boolean }
type PanelKey = "fontSize" | "fontColor" | "bgColor" | null

export function FloatingToolbar({ containerRef }: { containerRef: React.RefObject<HTMLDivElement | null> }) {
  const [pos, setPos] = useState<FloatingToolbarPos | null>(null)
  const [openPanel, setOpenPanel] = useState<PanelKey>(null)
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
    restoreSelection()
    document.execCommand(cmd, false, value ?? undefined)
    savedRange.current = null
  }

  function togglePanel(key: PanelKey) {
    saveSelection()
    setOpenPanel(prev => prev === key ? null : key)
  }

  useEffect(() => {
    function onSelectionChange() {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setPos(null)
        setOpenPanel(null)
        return
      }
      const range = sel.getRangeAt(0)
      if (!containerRef.current?.contains(range.commonAncestorContainer)) {
        setPos(null)
        setOpenPanel(null)
        return
      }
      saveSelection()
      setOpenPanel(null)

      const rect = range.getBoundingClientRect()
      if (!rect || (rect.width === 0 && rect.height === 0)) return

      const TOOLBAR_W = 340
      const TOOLBAR_H = 36
      const PANEL_H = 120 // 二级面板最大高度预留
      const GAP = 8
      const VP_W = window.innerWidth
      const VP_H = window.innerHeight

      // 工具栏水平居中于选区，左右边界修正
      let left = rect.left + rect.width / 2 - TOOLBAR_W / 2
      if (left < 6) left = 6
      if (left + TOOLBAR_W > VP_W - 6) left = VP_W - TOOLBAR_W - 6

      // 优先显示在选区上方；若上方空间不足，则显示在下方
      const topAbove = rect.top - TOOLBAR_H - GAP
      const topBelow = rect.bottom + GAP
      const above = topAbove >= PANEL_H + 6  // 上方要留足二级面板空间
      const top = above ? topAbove : topBelow

      // 防止底部超出视口
      const finalTop = Math.min(top, VP_H - TOOLBAR_H - 6)

      setPos({ top: Math.max(finalTop, 6), left, above })
    }

    document.addEventListener("selectionchange", onSelectionChange)
    return () => document.removeEventListener("selectionchange", onSelectionChange)
  }, [containerRef])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (toolbarRef.current?.contains(e.target as Node)) return
      if (containerRef.current?.contains(e.target as Node)) return
      setPos(null)
      setOpenPanel(null)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [containerRef])

  if (!pos) return null

  // 二级面板：above=true 时向上展开，否则向下
  const panelClass = pos.above
    ? "absolute bottom-full mb-1 z-[200]"
    : "absolute top-full mt-1 z-[200]"

  return (
    <>
      <div
        ref={toolbarRef}
        className="fixed z-[150] flex items-center gap-0.5 rounded-[6px] border border-[#e5e7eb] bg-white px-2 py-1 shadow-xl"
        style={{ top: pos.top, left: pos.left, pointerEvents: "auto" }}
        onMouseDown={(e) => e.preventDefault()}
      >
        {/* 字号 */}
        <div className="relative">
          <button
            onMouseDown={(e) => { e.preventDefault(); togglePanel("fontSize") }}
            className={cn("flex h-6 items-center gap-0.5 rounded-[3px] px-1.5 text-[12px] transition-colors hover:bg-[#f3f4f6]",
              openPanel === "fontSize" ? "bg-[#f3f4f6] text-[#38c08f]" : "text-[#374151]")}
          >
            {activeFontSize}px
            <ChevronDown size={9} className="text-[#9ca3af]" />
          </button>
          {openPanel === "fontSize" && (
            <div className={cn(panelClass, "left-0 rounded-[6px] border border-[#e5e7eb] bg-white py-1 shadow-lg min-w-[76px]")}>
              {FONT_SIZES.map((s) => (
                <button key={s}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    setActiveFontSize(s)
                    restoreSelection()
                    const sizeVal = s === "12" ? "1" : s === "14" ? "2" : s === "16" ? "3" : s === "18" ? "4" : "5"
                    document.execCommand("fontSize", false, sizeVal)
                    setOpenPanel(null)
                    savedRange.current = null
                  }}
                  className={cn("flex w-full px-3 py-1.5 text-[12px] hover:bg-[#f0fdf4]",
                    activeFontSize === s ? "text-[#38c08f] font-semibold" : "text-[#374151]")}>
                  {s}px
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-[#e5e7eb] mx-0.5" />

        {/* 加粗 */}
        <button onMouseDown={(e) => { e.preventDefault(); execCmd("bold") }}
          className="flex h-6 w-6 items-center justify-center rounded-[3px] hover:bg-[#f3f4f6] transition-colors" title="加粗">
          <Bold size={13} className="text-[#374151]" />
        </button>

        {/* 下划线 */}
        <button onMouseDown={(e) => { e.preventDefault(); execCmd("underline") }}
          className="flex h-6 w-6 items-center justify-center rounded-[3px] hover:bg-[#f3f4f6] transition-colors" title="下划线">
          <Underline size={13} className="text-[#374151]" />
        </button>

        {/* 删除线 */}
        <button onMouseDown={(e) => { e.preventDefault(); execCmd("strikeThrough") }}
          className="flex h-6 w-6 items-center justify-center rounded-[3px] hover:bg-[#f3f4f6] transition-colors" title="删除线">
          <Strikethrough size={13} className="text-[#374151]" />
        </button>

        <div className="h-4 w-px bg-[#e5e7eb] mx-0.5" />

        {/* 字体颜色 */}
        <div className="relative">
          <button
            onMouseDown={(e) => { e.preventDefault(); togglePanel("fontColor") }}
            className={cn("flex h-6 w-6 flex-col items-center justify-center gap-[1px] rounded-[3px] transition-colors hover:bg-[#f3f4f6]",
              openPanel === "fontColor" && "bg-[#f3f4f6]")}
            title="字体颜色"
          >
            <span className="text-[11px] font-bold leading-none text-[#374151]">A</span>
            <span className="h-[2.5px] w-3.5 rounded-full bg-[#ef4444]" />
          </button>
        </div>

        {/* 背景色 */}
        <div className="relative">
          <button
            onMouseDown={(e) => { e.preventDefault(); togglePanel("bgColor") }}
            className={cn("flex h-6 w-6 flex-col items-center justify-center gap-[1px] rounded-[3px] transition-colors hover:bg-[#f3f4f6]",
              openPanel === "bgColor" && "bg-[#f3f4f6]")}
            title="背景颜色"
          >
            <span className="text-[11px] font-bold leading-none text-[#374151]">A</span>
            <span className="h-[2.5px] w-3.5 rounded-full bg-[#fde047]" />
          </button>
        </div>
      </div>

      {/* 字体颜色面板 —— fixed 独立渲染，不堆叠 */}
      {openPanel === "fontColor" && (
        <div
          className="fixed z-[200] rounded-[6px] border border-[#e5e7eb] bg-white p-2 shadow-xl"
          style={{
            top: pos.above ? pos.top - 10 - 120 : pos.top + 44,
            left: Math.min(pos.left + 188, window.innerWidth - 130),
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <p className="mb-1 text-[10px] font-medium text-[#9ca3af]">字体颜色</p>
          <div className="grid grid-cols-6 gap-1">
            {PRESET_COLORS.map((c) => (
              <button key={c}
                onMouseDown={(e) => {
                  e.preventDefault()
                  restoreSelection()
                  document.execCommand("foreColor", false, c)
                  setOpenPanel(null)
                  savedRange.current = null
                }}
                className="h-5 w-5 rounded-[3px] border border-[#e5e7eb] transition-transform hover:scale-110"
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
      )}

      {/* 背景颜色面板 —— fixed 独立渲染，不堆叠 */}
      {openPanel === "bgColor" && (
        <div
          className="fixed z-[200] rounded-[6px] border border-[#e5e7eb] bg-white p-2 shadow-xl"
          style={{
            top: pos.above ? pos.top - 10 - 120 : pos.top + 44,
            left: Math.min(pos.left + 216, window.innerWidth - 130),
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <p className="mb-1 text-[10px] font-medium text-[#9ca3af]">背景颜色</p>
          <div className="grid grid-cols-6 gap-1">
            {PRESET_COLORS.map((c) => (
              <button key={c}
                onMouseDown={(e) => {
                  e.preventDefault()
                  restoreSelection()
                  document.execCommand("hiliteColor", false, c)
                  setOpenPanel(null)
                  savedRange.current = null
                }}
                className="h-5 w-5 rounded-[3px] border border-[#e5e7eb] transition-transform hover:scale-110"
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
      )}
    </>
  )
}

export { bookDetailMockMap, sharedParagraphs, TRIAL_PARAGRAPH_INDEX, calcSegmentWords, calcTotalWords, calcEpisodeIndex, buildInitialNodes }

// ─── ScriptEditorDrawer ──────────────────────────────────────────────────────

export type ScriptDraftPersistBody = {
  scriptName: string
  content: string
  bookId: number
  scriptType: string
  originalScriptId?: number | null
  episodeCount: number
  payEpisode?: string
  payBreakpointData?: string
}

export function ScriptEditorDrawer({
  bookName: initialBookName,
  detail,
  onClose,
  persistBookId,
  persistScriptType,
  persistOriginalScriptId,
  onPersistSave,
  onPersistSubmit,
}: {
  bookName: string
  detail: BookDetail
  onClose: () => void
  persistBookId?: number
  persistScriptType?: string
  persistOriginalScriptId?: number | null
  onPersistSave?: (body: ScriptDraftPersistBody) => Promise<void>
  onPersistSubmit?: () => Promise<void>
}) {
  const [scriptName, setScriptName] = useState(initialBookName)
  const [nodes, setNodes] = useState<EditorNode[]>(() =>
    buildInitialNodes(detail.contentParagraphs, TRIAL_PARAGRAPH_INDEX, detail.breakpointLabel, detail.dividerPositions)
  )
  const [submitted, setSubmitted] = useState(false)
  const [saved, setSaved] = useState(false)
  // 用于浮动工具栏定位的容器 ref
  const editorContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: KeyboardEvent) { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [onClose])

  const updateParagraphHtml = useCallback((id: string, html: string) => {
    setNodes((prev) => prev.map((n) => n.type === "paragraph" && n.id === id ? { ...n, html } : n))
  }, [])

  function insertOrangeDividerAfterIdx(afterIdx: number) {
    setNodes((prev) => {
      // 防止同一位置重复插入：检查 afterIdx+1 是否已经是 orange-divider
      if (prev[afterIdx + 1]?.type === "orange-divider") return prev
      const next = [...prev]
      next.splice(afterIdx + 1, 0, { type: "orange-divider", id: newId(), deletable: true })
      return next
    })
  }

  function deleteOrangeDivider(id: string) {
    setNodes((prev) => prev.filter((n) => n.id !== id))
  }

  const totalWords = calcTotalWords(nodes)

  function buildPersistBody(): ScriptDraftPersistBody {
    const paragraphs = nodes.filter(
      (n): n is Extract<EditorNode, { type: "paragraph" }> => n.type === "paragraph"
    )
    const content = paragraphs.map((p) => p.html).join("\n")
    const episodeCount = Math.max(1, nodes.filter((n) => n.type === "orange-divider").length)

    const dividerAfterIndices: number[] = []
    let pIdx = 0
    for (const n of nodes) {
      if (n.type === "paragraph") pIdx++
      else if (n.type === "orange-divider") dividerAfterIndices.push(pIdx - 1)
    }

    return {
      scriptName,
      content,
      bookId: persistBookId!,
      scriptType: persistScriptType!,
      originalScriptId: persistOriginalScriptId ?? undefined,
      episodeCount,
      payEpisode: "",
      payBreakpointData: JSON.stringify(dividerAfterIndices),
    }
  }

  async function handleSaveClick() {
    if (onPersistSave && persistBookId != null && persistScriptType) {
      try {
        await onPersistSave(buildPersistBody())
        toast.success("保存成功")
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "保存失败")
      }
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  async function handleSubmitClick() {
    if (onPersistSubmit && onPersistSave && persistBookId != null && persistScriptType) {
      try {
        await onPersistSave(buildPersistBody())
        await onPersistSubmit()
        toast.success("提交成功")
        setSubmitted(true)
        setTimeout(() => {
          setSubmitted(false)
          onClose()
        }, 1200)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "提交失败")
      }
    } else if (onPersistSubmit) {
      try {
        await onPersistSubmit()
        toast.success("提交成功")
        setSubmitted(true)
        setTimeout(() => {
          setSubmitted(false)
          onClose()
        }, 1200)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "提交失败")
      }
    } else {
      setSubmitted(true)
      setTimeout(() => {
        setSubmitted(false)
        onClose()
      }, 1200)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40" style={{ zIndex: 60 }} onClick={onClose} />
      <div className="fixed right-0 top-0 flex h-full w-[1040px] flex-col bg-white"
        style={{ zIndex: 61, boxShadow: "-4px 0 32px rgba(0,0,0,0.15)" }}>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e5e7eb] px-6 py-4">
          <h2 className="text-[15px] font-semibold text-[#111827]">创作剧本</h2>
          <button onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-[4px] text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#374151] transition-colors"
            aria-label="关闭">
            <X size={16} />
          </button>
        </div>

        {/* 剧本名称 */}
        <div className="border-b border-[#e5e7eb] px-6 py-3.5">
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

        {/* 编辑器内容区（含浮动工具栏定位容器） */}
        <div className="relative flex-1 overflow-y-auto bg-[#f9fafb] px-8 py-5" ref={editorContainerRef}>
          {/* 浮动工具栏 —— 绝对定位在 editorContainerRef 内部 */}
          <FloatingToolbar containerRef={editorContainerRef} />

          <div className="mx-auto max-w-[860px] rounded-[6px] border border-[#e5e7eb] bg-white px-8 py-6 min-h-full">
            {nodes.map((node, idx) => {
              // 普通位置：前一个节点是否已是 orange-divider
              const prevNodeIsOrange = idx > 0 && nodes[idx - 1].type === "orange-divider"
              // 后一个节点是否已是 orange-divider
              const nextNodeIsOrange = nodes[idx + 1]?.type === "orange-divider"

              // ── blue-divider 特殊判断：前后视为同一组 ──
              const blueDividerGroupHasOrange = (blueIdx: number): boolean => {
                const prevIsOrange = blueIdx > 0 && nodes[blueIdx - 1].type === "orange-divider"
                const nextIsOrange = nodes[blueIdx + 1]?.type === "orange-divider"
                return prevIsOrange || nextIsOrange
              }

              if (node.type === "paragraph") {
                return (
                  <div key={node.id}>
                    {idx > 0 && (
                      <InsertDividerBtn
                        onInsert={() => insertOrangeDividerAfterIdx(idx - 1)}
                        disabled={prevNodeIsOrange}
                      />
                    )}
                    <ParagraphEditor
                      node={node as Extract<EditorNode, { type: "paragraph" }>}
                      onChange={updateParagraphHtml}
                    />
                  </div>
                )
              }

              if (node.type === "blue-divider") {
                const groupHasOrange = blueDividerGroupHasOrange(idx)
                return (
                  <div key={node.id}>
                    {/* 蓝色分界线前插入入口：组内已有 orange-divider 则禁用 */}
                    <InsertDividerBtn
                      onInsert={() => insertOrangeDividerAfterIdx(idx - 1)}
                      disabled={groupHasOrange}
                    />
                    <div className="my-6 flex select-none items-center gap-3 cursor-not-allowed">
                      <div className="h-px flex-1 bg-[#3b82f6]" />
                      <span className="whitespace-nowrap rounded-[4px] border border-[#3b82f6] bg-[#eff6ff] px-3 py-1 text-[12px] font-medium text-[#2563eb]">
                        {node.label}
                      </span>
                      <div className="h-px flex-1 bg-[#3b82f6]" />
                    </div>
                    {/* 蓝色分界线后插入入口：组内已有 orange-divider 则禁用 */}
                    <InsertDividerBtn
                      onInsert={() => insertOrangeDividerAfterIdx(idx)}
                      disabled={groupHasOrange}
                    />
                  </div>
                )
              }

              if (node.type === "orange-divider") {
                return (
                  <div key={node.id}>
                    <OrangeDividerNode
                      node={node as Extract<EditorNode, { type: "orange-divider" }>}
                      nodes={nodes}
                      onDelete={deleteOrangeDivider}
                    />
                  </div>
                )
              }

              return null
            })}
          </div>
        </div>

        {/* 底部操作栏 */}
        <div className="flex items-center justify-between border-t border-[#e5e7eb] bg-white px-6 py-3.5">
          <span className="text-[13px] text-[#6b7280]">
            全文字数：<span className="font-medium text-[#111827]">{totalWords.toLocaleString()} 字</span>
            <span className="mx-2 text-[#d1d5db]">|</span>
            集数：<span className="font-medium text-[#111827]">{Math.max(1, nodes.filter((n) => n.type === "orange-divider").length)} 集</span>
          </span>
          <div className="flex items-center gap-2">
            {saved && <span className="text-[12.5px] text-[#6b7280]">已保存</span>}
            {submitted && <span className="text-[12.5px] text-[#38c08f]">已提交</span>}
            <button
              onClick={() => void handleSaveClick()}
              className="rounded-[6px] border border-[#d1d5db] bg-white px-5 py-1.5 text-[13px] font-medium text-[#374151] hover:border-[#38c08f] hover:text-[#38c08f] transition-colors">
              保存
            </button>
            <button
              onClick={() => void handleSubmitClick()}
              className="rounded-[6px] bg-[#38c08f] px-6 py-1.5 text-[13px] font-medium text-white hover:bg-[#2da87a] transition-colors">
              提交
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

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

const PAGE_SIZE = 10

export default function BookManagement() {
  const canScript = usePerm("resource.book.script")
  const canDetail = usePerm("resource.book.detail")
  const [filter, setFilter] = useState<FilterForm>(defaultFilters)
  const [activeFilter, setActiveFilter] = useState<FilterForm>(defaultFilters)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<PageSizeOption>(10)
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

  function handleQuery() { setActiveFilter({ ...filter }); setPage(1) }
  function handleReset() { setFilter(emptyFilters); setActiveFilter(emptyFilters); setPage(1) }

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
      toast.error(e instanceof Error ? e.message : "打开剧本编辑器失败")
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
                onChange={(e) => setFilter(f => ({ ...f, bookId: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && handleQuery()}
                className="h-[30px] w-[148px] rounded-[6px] border border-[#d1d5db] bg-white px-3 text-[13px] text-[#374151] placeholder-[#9ca3af] outline-none focus:border-[#38c08f] transition-colors" />
            </div>
            <div className="flex items-center gap-2">
              <span className="whitespace-nowrap text-[13px] text-[#374151]">书籍名称</span>
              <input type="text" placeholder="请输入书籍名称" value={filter.bookName}
                onChange={(e) => setFilter(f => ({ ...f, bookName: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && handleQuery()}
                className="h-[30px] w-[148px] rounded-[6px] border border-[#d1d5db] bg-white px-3 text-[13px] text-[#374151] placeholder-[#9ca3af] outline-none focus:border-[#38c08f] transition-colors" />
            </div>
            <BookContentTypeSelect value={filter.contentType} onChange={(v) => setFilter(f => ({ ...f, contentType: v }))} />
            <HasScriptSelect value={filter.hasScript} onChange={(v) => setFilter(f => ({ ...f, hasScript: v }))} />
            <div className="flex items-center gap-2">
              <span className="whitespace-nowrap text-[13px] text-[#374151]">上架时间</span>
              <DateRangePicker value={filter.listingDateRange} onChange={(v) => setFilter(f => ({ ...f, listingDateRange: v }))} />
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
                    <td className="px-4 py-3 font-mono text-[12px] text-[#6b7280]">{row.bookId}</td>
                    <td className="px-4 py-3">
                      {canDetail ? (
                        <button onClick={() => openDetailDrawer(row)}
                          className="font-medium text-[#2563eb] hover:text-[#1d4ed8] hover:underline transition-colors text-left">
                          {row.bookName}
                        </button>
                      ) : (
                        <span className="font-medium text-[#111827] whitespace-nowrap">{row.bookName}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center rounded-[4px] px-2 py-0.5 text-[11.5px] font-medium",
                        row.contentType === "原作"
                          ? "bg-[#f0f9ff] border border-[#7dd3fc] text-[#0284c7]"
                          : "bg-[#fdf4ff] border border-[#e9d5ff] text-[#9333ea]")}>
                        {row.contentType}
                      </span>
                    </td>
                    <td className="px-4 py-3"><CategoryTag value={row.category} /></td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-nowrap gap-1">
                        {row.tags.map((tag) => <BookTag key={tag} value={tag} />)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#374151]">{row.wordCount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-center text-[#374151]">
                      {row.relatedScriptCount === 0
                        ? <span className="text-[#9ca3af]">0</span>
                        : <span className="font-medium text-[#38c08f]">{row.relatedScriptCount}</span>}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#6b7280] whitespace-nowrap">{row.listingTime}</td>
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
            currentPage={page}
            pageSize={pageSize}
            onPageChange={(p) => setPage(p)}
            onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
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
