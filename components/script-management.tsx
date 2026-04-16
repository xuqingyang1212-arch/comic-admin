"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { ChevronDown, ChevronLeft, ChevronRight, Calendar, X, Search, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import { scriptApi, bookApi, scriptDraftApi } from "@/lib/api"
import { toast } from "@/lib/toast"
import { ListPagination, type PageSizeOption } from "@/components/list-pagination"
import {
  sharedParagraphs,
  TRIAL_PARAGRAPH_INDEX,
  EditorNode,
  calcTotalWords,
  calcEpisodeIndex,
  calcSegmentWords,
  buildInitialNodes,
  newId,
  OrangeDividerNode,
  InsertDividerBtn,
  ParagraphEditor,
  FloatingToolbar,
  ScriptEditorDrawer,
  type BookDetail,
  type ScriptDraftPersistBody,
} from "@/components/book-management"
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

const scriptMock: ScriptRow[] = []

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

function formatApiDateTime(s: string | undefined): string {
  if (!s) return ""
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

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

const WEEK_LABELS = ["日", "一", "二", "三", "四", "五", "六"]
const MONTHS_CN = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"]

function getDaysInMonth(year: number, month: number) { return new Date(year, month + 1, 0).getDate() }
function getFirstDayOfWeek(year: number, month: number) { return new Date(year, month, 1).getDay() }
function padDate(n: number) { return String(n).padStart(2, "0") }
function toDateStr(year: number, month: number, day: number) { return `${year}-${padDate(month + 1)}-${padDate(day)}` }

// ─── MonthPanel ───────────────────────────────────────────────────────────────

interface MonthPanelProps {
  year: number; month: number; hoverDate: string; startDate: string; endDate: string
  onDayClick: (d: string) => void; onDayHover: (d: string) => void
}

function MonthPanel({ year, month, hoverDate, startDate, endDate, onDayClick, onDayHover }: MonthPanelProps) {
  const days = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfWeek(year, month)
  const cells: (number | null)[] = Array(firstDay).fill(null).concat(Array.from({ length: days }, (_, i) => i + 1))
  while (cells.length % 7 !== 0) cells.push(null)
  return (
    <div className="w-[216px]">
      <div className="mb-2 flex items-center justify-center">
        <span className="text-[13px] font-medium text-[#111827]">{year}年 {MONTHS_CN[month]}</span>
      </div>
      <div className="grid grid-cols-7">
        {WEEK_LABELS.map((w) => (
          <div key={w} className="flex h-7 items-center justify-center text-[11px] text-[#9ca3af]">{w}</div>
        ))}
        {cells.map((day, idx) => {
          if (!day) return <div key={idx} className="h-7" />
          const d = toDateStr(year, month, day)
          const isStart = d === startDate
          const isEnd = d === endDate
          const rangeEnd = endDate || (startDate && hoverDate > startDate ? hoverDate : "")
          const inRange = !!(startDate && rangeEnd && d > startDate && d < rangeEnd && !isStart && !isEnd)
          return (
            <div key={idx}
              className={cn(
                "flex h-7 cursor-pointer items-center justify-center text-[12.5px] rounded-[3px] transition-colors",
                isStart || isEnd
                  ? "bg-[#38c08f] text-white font-semibold"
                  : inRange
                    ? "bg-[#d1f5e9] text-[#059669]"
                    : "text-[#374151] hover:bg-[#f0fdf4] hover:text-[#38c08f]"
              )}
              onClick={() => onDayClick(d)}
              onMouseEnter={() => onDayHover(d)}
            >
              {day}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── DateRangePicker ──────────────────────────────────────────────────────────

function DateRangePicker({
  value,
  onChange,
}: {
  value: [string, string] | []
  onChange: (v: [string, string] | []) => void
}) {
  const today = new Date()
  const [open, setOpen] = useState(false)
  const [leftYear, setLeftYear] = useState(today.getFullYear())
  const [leftMonth, setLeftMonth] = useState(today.getMonth() === 0 ? 0 : today.getMonth() - 1)
  const [hoverDate, setHoverDate] = useState("")
  const ref = useRef<HTMLDivElement>(null)
  const rightYear = leftMonth === 11 ? leftYear + 1 : leftYear
  const rightMonth = leftMonth === 11 ? 0 : leftMonth + 1
  const startDate = (value as string[])[0] ?? ""
  const endDate = (value as string[])[1] ?? ""

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  function handleDayClick(d: string) {
    if (!startDate || (startDate && endDate)) {
      onChange([d, ""] as unknown as [string, string])
    } else {
      onChange(d < startDate ? [d, startDate] : [startDate, d])
      setOpen(false)
    }
  }

  function prevMonth() {
    if (leftMonth === 0) { setLeftYear(y => y - 1); setLeftMonth(11) } else setLeftMonth(m => m - 1)
  }
  function nextMonth() {
    if (leftMonth === 11) { setLeftYear(y => y + 1); setLeftMonth(0) } else setLeftMonth(m => m + 1)
  }

  const displayText = startDate && endDate
    ? `${startDate} 至 ${endDate}`
    : startDate ? `${startDate} 至 ...` : ""

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          "flex h-[30px] w-[236px] items-center gap-2 rounded-[6px] border border-[#d1d5db] bg-white px-3 text-[13px] transition-colors",
          open ? "border-[#38c08f]" : "hover:border-[#38c08f]",
          displayText ? "text-[#374151]" : "text-[#9ca3af]"
        )}
      >
        <Calendar size={13} className="shrink-0 text-[#9ca3af]" />
        <span className="flex-1 truncate text-left">{displayText || "请选择日期范围"}</span>
        {displayText ? (
          <X
            size={12}
            className="shrink-0 text-[#9ca3af] hover:text-[#374151]"
            onClick={(e) => { e.stopPropagation(); onChange([]); setOpen(false) }}
          />
        ) : (
          <ChevronDown size={12} className="shrink-0 text-[#9ca3af]" />
        )}
      </button>
      {open && (
        <div className="absolute left-0 top-[36px] z-50 flex gap-4 rounded-[8px] border border-[#e5e7eb] bg-white px-5 py-4 shadow-lg">
          <div className="flex flex-col">
            <div className="mb-2 flex items-center justify-between">
              <button onClick={prevMonth} className="flex h-6 w-6 items-center justify-center rounded hover:bg-[#f3f4f6] text-[#6b7280]">
                <ChevronLeft size={14} />
              </button>
              <span />
            </div>
            <MonthPanel year={leftYear} month={leftMonth} hoverDate={hoverDate} startDate={startDate} endDate={endDate} onDayClick={handleDayClick} onDayHover={setHoverDate} />
          </div>
          <div className="w-px bg-[#f3f4f6]" />
          <div className="flex flex-col">
            <div className="mb-2 flex items-center justify-end">
              <span />
              <button onClick={nextMonth} className="flex h-6 w-6 items-center justify-center rounded hover:bg-[#f3f4f6] text-[#6b7280]">
                <ChevronRight size={14} />
              </button>
            </div>
            <MonthPanel year={rightYear} month={rightMonth} hoverDate={hoverDate} startDate={startDate} endDate={endDate} onDayClick={handleDayClick} onDayHover={setHoverDate} />
          </div>
        </div>
      )}
    </div>
  )
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

// ─── FilterInput ──────────────────────────────────────────────────────────────

function FilterInput({ label, placeholder, value, onChange, width = "w-[160px]" }: {
  label: string; placeholder: string; value: string; onChange: (v: string) => void; width?: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="whitespace-nowrap text-[13px] text-[#374151]">{label}</span>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn("h-[30px] rounded-[6px] border border-[#d1d5db] bg-white px-3 text-[13px] text-[#374151] placeholder-[#9ca3af] outline-none focus:border-[#38c08f] transition-colors", width)}
      />
    </div>
  )
}

// ─── Drawer: 发布制作任务 ─────────────────────────────────────────────────────

const artStyleOptions = ["解说漫", "动画漫", "沙雕漫", "仿真人剧"]
const visualEffectOptions = ["2D", "3D", "仿真人"]
const aspectRatioOptions = ["横屏 16:9", "竖屏 9:16"]

function RadioGroup({
  label,
  options,
  value,
  onChange,
  required,
  error,
}: {
  label: string
  options: string[]
  value: string
  onChange: (v: string) => void
  required?: boolean
  error?: boolean
}) {
  return (
    <div>
      <p className="mb-2 text-[13px] font-medium text-[#374151]">
        {label}
        {required && <span className="ml-0.5 text-[#f04438]">*</span>}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = value === opt
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={cn(
                "h-[30px] rounded-[4px] border px-3.5 text-[12.5px] transition-colors",
                active
                  ? "border-[#38c08f] bg-[#f0fdf4] font-medium text-[#38c08f]"
                  : error
                    ? "border-[#fca5a5] bg-white text-[#374151] hover:border-[#38c08f]"
                    : "border-[#d1d5db] bg-white text-[#374151] hover:border-[#38c08f] hover:text-[#38c08f]"
              )}
            >
              {opt}
            </button>
          )
        })}
      </div>
      {error && <p className="mt-1 text-[11.5px] text-[#f04438]">请选择{label}</p>}
    </div>
  )
}

function PublishTaskDrawer({ row, onClose }: { row: ScriptRow; onClose: () => void }) {
  const [artStyle, setArtStyle] = useState("")
  const [visualEffect, setVisualEffect] = useState("")
  const [aspectRatio, setAspectRatio] = useState("")
  const [remark, setRemark] = useState("")
  const [errors, setErrors] = useState({ artStyle: false, visualEffect: false, aspectRatio: false })
  const [submitting, setSubmitting] = useState(false)

  async function handleConfirm() {
    const e = {
      artStyle: !artStyle,
      visualEffect: !visualEffect,
      aspectRatio: !aspectRatio,
    }
    if (e.artStyle || e.visualEffect || e.aspectRatio) { setErrors(e); return }
    setSubmitting(true)
    try {
      await scriptApi.publishTask(row.id, {
        artStyle,
        visualEffect,
        aspectRatio,
        productionRemark: remark.trim(),
      })
      onClose()
      toast.success(`已发布制作任务：${artStyle} / ${visualEffect} / ${aspectRatio}`)
    } catch (err) {
      toast.error(err instanceof Error ? `发布失败：${err.message}` : "发布失败")
    } finally {
      setSubmitting(false)
    }
  }

  const infoFields = [
    { label: "剧本名称", value: row.scriptName, mono: false },
    { label: "剧本ID", value: row.scriptId, mono: true },
    { label: "集数", value: String(row.episodeCount) + " 集", mono: false },
    { label: "付费卡点", value: row.paidEpisode || "--", mono: false },
  ]

  return (
    <>
      <div className="fixed inset-0 bg-black/35" style={{ zIndex: 100 }} onClick={onClose} />
      <div
        className="fixed right-0 top-0 flex h-full w-[640px] flex-col bg-white"
        style={{ zIndex: 101, boxShadow: "-4px 0 24px rgba(0,0,0,0.12)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e5e7eb] px-6 py-4">
          <span className="text-[15px] font-semibold text-[#111827]">发布制作任务</span>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-[4px] text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#374151] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* 剧本信息卡 */}
          <div className="mb-5 rounded-[8px] border border-[#e5e7eb] bg-[#f9fafb] px-4 py-4">
            <p className="mb-3 text-[11.5px] font-semibold uppercase tracking-wide text-[#9ca3af]">剧本信息</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {infoFields.map(({ label, value, mono }) => (
                <div key={label}>
                  <p className="text-[11.5px] text-[#9ca3af]">{label}</p>
                  <p className={cn("mt-0.5 break-all text-[12.5px]", mono ? "font-mono text-[#4b5563]" : "text-[#111827]")}>
                    {label === "类型" ? (
                      <span className={cn(
                        "inline-flex items-center rounded-[4px] border px-2 py-0.5 text-[11.5px] font-medium",
                        value === "原作"
                          ? "border-[#bfdbfe] bg-[#eff6ff] text-[#2563eb]"
                          : "border-[#ddd6fe] bg-[#f5f3ff] text-[#7c3aed]"
                      )}>
                        {value}
                      </span>
                    ) : label === "付费卡点" && value !== "--" ? (
                      <span className="inline-flex items-center rounded-[4px] border border-[#fde68a] bg-[#fef9ee] px-2 py-0.5 text-[11.5px] text-[#b45309]">
                        {value}
                      </span>
                    ) : value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* 制作类型配置 */}
          <div className="rounded-[8px] border border-[#e5e7eb] bg-white px-4 py-4">
            <p className="mb-4 text-[11.5px] font-semibold uppercase tracking-wide text-[#9ca3af]">制作类型配置</p>
            <div className="flex flex-col gap-5">
              <RadioGroup
                label="画风类型"
                options={artStyleOptions}
                value={artStyle}
                onChange={(v) => { setArtStyle(v); setErrors((p) => ({ ...p, artStyle: false })) }}
                required
                error={errors.artStyle}
              />
              <div className="h-px bg-[#f3f4f6]" />
              <RadioGroup
                label="视觉效果"
                options={visualEffectOptions}
                value={visualEffect}
                onChange={(v) => { setVisualEffect(v); setErrors((p) => ({ ...p, visualEffect: false })) }}
                required
                error={errors.visualEffect}
              />
              <div className="h-px bg-[#f3f4f6]" />
              <RadioGroup
                label="画面比例"
                options={aspectRatioOptions}
                value={aspectRatio}
                onChange={(v) => { setAspectRatio(v); setErrors((p) => ({ ...p, aspectRatio: false })) }}
                required
                error={errors.aspectRatio}
              />
              <div className="h-px bg-[#f3f4f6]" />
              <div>
                <p className="mb-2 text-[13px] font-medium text-[#374151]">制作备注</p>
                <textarea
                  rows={3}
                  placeholder="请输入制作备注（选填）"
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  className="w-full resize-none rounded-[6px] border border-[#d1d5db] px-3 py-2 text-[13px] text-[#374151] outline-none focus:border-[#38c08f] transition-colors"
                />
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#e5e7eb] px-6 py-4">
          <span className="text-[12.5px] text-[#9ca3af]">请确认配置后再发布</span>
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="rounded-[6px] border border-[#d1d5db] bg-white px-5 py-1.5 text-[13px] text-[#374151] hover:bg-[#f9fafb] transition-colors"
            >
              取消
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleConfirm()}
              className="rounded-[6px] bg-[#38c08f] px-5 py-1.5 text-[13px] font-medium text-white hover:bg-[#2da87a] transition-colors disabled:opacity-60"
            >
              确认发布
            </button>
          </div>
        </div>
      </div>
    </>
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
  const [filters, setFilters] = useState<FilterForm>({ ...defaultFilters })
  const [appliedFilters, setAppliedFilters] = useState<FilterForm>({ ...defaultFilters })
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState<PageSizeOption>(10)
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

  function setField<K extends keyof FilterForm>(key: K, value: FilterForm[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  function handleQuery() {
    setAppliedFilters({ ...filters })
    setCurrentPage(1)
  }

  function handleReset() {
    setFilters({ ...defaultFilters })
    setAppliedFilters({ ...defaultFilters })
    setCurrentPage(1)
  }

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
      toast.error(e instanceof Error ? e.message : "打开剧本二创失败")
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
          <table className="w-full border-collapse text-[13px]">
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
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={(p) => setCurrentPage(p)}
          onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1) }}
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
          row={publishRow}
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
