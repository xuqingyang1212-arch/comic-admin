"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { ChevronDown, ChevronLeft, ChevronRight, Calendar, X, Search, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import { downloadApi } from "@/lib/api"
import { toast } from "@/lib/toast"
import { ListPagination, type PageSizeOption } from "@/components/list-pagination"

// ─────────────── Types ───────────────
type DownloadContent = "有字幕视频" | "无字幕视频" | "提审材料"
type DownloadStatus = "进行中" | "已完成" | "已失效" | "失败"

interface FilterForm {
  comicName: string
  downloadContent: string
  createdAtRange: [string, string] | []
  status: string
}

interface DownloadTask {
  id: string
  comicName: string
  downloadContent: DownloadContent
  createdAt: string
  status: DownloadStatus
}

const defaultFilters: FilterForm = {
  comicName: "",
  downloadContent: "",
  createdAtRange: [],
  status: "",
}

const downloadContentOptions: { label: string; value: string }[] = [
  { label: "【有字幕】视频", value: "有字幕视频" },
  { label: "【无字幕】视频", value: "无字幕视频" },
  { label: "提审材料",       value: "提审材料"   },
]

const statusOptions: { label: string; value: string }[] = [
  { label: "进行中", value: "进行中" },
  { label: "已完成", value: "已完成" },
  { label: "已失效", value: "已失效" },
  { label: "失败",   value: "失败"   },
]

function formatTaskCreatedAt(raw: string): string {
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

// ─────────────── Status Badge ───────────────
const statusConfig: Record<string, { bg: string; text: string }> = {
  "进行中": { bg: "bg-[#eff6ff]", text: "text-[#2563eb]" },
  "已完成": { bg: "bg-[#ecfdf5]", text: "text-[#059669]" },
  "已失效": { bg: "bg-[#f3f4f6]", text: "text-[#6b7280]" },
  "失败":   { bg: "bg-[#fef2f2]", text: "text-[#dc2626]" },
}

function StatusBadge({ status }: { status: string }) {
  const c = statusConfig[status] ?? { bg: "bg-[#f3f4f6]", text: "text-[#6b7280]" }
  return (
    <span className={cn("inline-flex items-center rounded-[4px] px-2 py-0.5 text-[11.5px] font-medium", c.bg, c.text)}>
      {status}
    </span>
  )
}

// ─────────────── FilterInput ───────────────
function FilterInput({
  label, placeholder, value, onChange, width = "w-[148px]",
}: {
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
        className={cn(
          "h-[30px] rounded-[6px] border border-[#d1d5db] bg-white px-3 text-[13px] text-[#374151]",
          "placeholder-[#9ca3af] outline-none transition-colors focus:border-[#38c08f]",
          width
        )}
      />
    </div>
  )
}

// ─────────────── SelectFilter ───────────────
function SelectFilter({
  label, value, onChange, options, width = "w-[120px]",
}: {
  label: string; value: string; onChange: (v: string) => void
  options: { label: string; value: string }[]; width?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  return (
    <div className="flex items-center gap-2">
      <span className="whitespace-nowrap text-[13px] text-[#374151]">{label}</span>
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "flex h-[30px] items-center gap-1.5 rounded-[6px] border border-[#d1d5db] bg-white px-3 text-[13px] transition-colors",
            open ? "border-[#38c08f]" : "hover:border-[#38c08f]",
            selected ? "text-[#374151]" : "text-[#9ca3af]",
            width
          )}
        >
          <span className="flex-1 truncate text-left">{selected ? selected.label : "请选择"}</span>
          {value ? (
            <X
              size={11}
              className="shrink-0 text-[#9ca3af] hover:text-[#374151]"
              onClick={(e) => { e.stopPropagation(); onChange(""); setOpen(false) }}
            />
          ) : (
            <ChevronDown size={12} className="shrink-0 text-[#9ca3af]" />
          )}
        </button>
        {open && (
          <div className="absolute left-0 top-[34px] z-50 min-w-full rounded-[6px] border border-[#e5e7eb] bg-white py-1 shadow-lg">
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false) }}
                className={cn(
                  "flex w-full items-center px-3 py-2 text-[13px] transition-colors hover:bg-[#f0fdf4] whitespace-nowrap",
                  value === opt.value ? "text-[#38c08f] font-medium" : "text-[#374151]"
                )}
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

// ─────────────── DateRangePicker ───────────────
const WEEK_LABELS = ["日", "一", "二", "三", "四", "五", "六"]
const MONTHS_CN   = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"]

function getDaysInMonth(year: number, month: number) { return new Date(year, month + 1, 0).getDate() }
function getFirstDayOfWeek(year: number, month: number) { return new Date(year, month, 1).getDay() }
function padDate(n: number) { return String(n).padStart(2, "0") }
function toDateStr(year: number, month: number, day: number) {
  return `${year}-${padDate(month + 1)}-${padDate(day)}`
}

interface MonthPanelProps {
  year: number; month: number; hoverDate: string; startDate: string; endDate: string
  onDayClick: (d: string) => void; onDayHover: (d: string) => void
}

function MonthPanel({ year, month, hoverDate, startDate, endDate, onDayClick, onDayHover }: MonthPanelProps) {
  const days = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfWeek(year, month)
  const cells: (number | null)[] = Array(firstDay).fill(null).concat(
    Array.from({ length: days }, (_, i) => i + 1)
  )
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
          if (!day) return <div key={`e-${idx}`} className="h-7" />
          const d = toDateStr(year, month, day)
          const isStart = d === startDate
          const isEnd   = d === endDate
          const rangeEnd = endDate || (startDate && hoverDate > startDate ? hoverDate : "")
          const inRange  = !!(startDate && rangeEnd && d > startDate && d < rangeEnd)
          return (
            <div
              key={d}
              className={cn(
                "flex h-7 cursor-pointer items-center justify-center rounded-[3px] text-[12.5px] transition-colors",
                isStart || isEnd
                  ? "bg-[#38c08f] font-semibold text-white"
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

function DateRangePicker({
  value = [],
  onChange,
}: {
  value?: [string, string] | []
  onChange: (v: [string, string] | []) => void
}) {
  const today = new Date()
  const [open, setOpen]           = useState(false)
  const [leftYear, setLeftYear]   = useState(today.getFullYear())
  const [leftMonth, setLeftMonth] = useState(today.getMonth() === 0 ? 0 : today.getMonth() - 1)
  const [hoverDate, setHoverDate] = useState("")
  const ref = useRef<HTMLDivElement>(null)

  const rightYear  = leftMonth === 11 ? leftYear + 1 : leftYear
  const rightMonth = leftMonth === 11 ? 0 : leftMonth + 1
  const safeVal    = Array.isArray(value) ? value : []
  const startDate  = safeVal[0] ?? ""
  const endDate    = safeVal[1] ?? ""

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
    if (leftMonth === 0) { setLeftYear((y) => y - 1); setLeftMonth(11) }
    else setLeftMonth((m) => m - 1)
  }
  function nextMonth() {
    if (leftMonth === 11) { setLeftYear((y) => y + 1); setLeftMonth(0) }
    else setLeftMonth((m) => m + 1)
  }

  const displayText = startDate && endDate
    ? `${startDate} 至 ${endDate}`
    : startDate ? `${startDate} 至 ...` : ""

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
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
              <button
                onClick={prevMonth}
                className="flex h-6 w-6 items-center justify-center rounded text-[#6b7280] hover:bg-[#f3f4f6]"
              >
                <ChevronLeft size={14} />
              </button>
              <span />
            </div>
            <MonthPanel
              year={leftYear} month={leftMonth}
              hoverDate={hoverDate} startDate={startDate} endDate={endDate}
              onDayClick={handleDayClick} onDayHover={setHoverDate}
            />
          </div>
          <div className="w-px bg-[#f3f4f6]" />
          <div className="flex flex-col">
            <div className="mb-2 flex items-center justify-end">
              <span />
              <button
                onClick={nextMonth}
                className="flex h-6 w-6 items-center justify-center rounded text-[#6b7280] hover:bg-[#f3f4f6]"
              >
                <ChevronRight size={14} />
              </button>
            </div>
            <MonthPanel
              year={rightYear} month={rightMonth}
              hoverDate={hoverDate} startDate={startDate} endDate={endDate}
              onDayClick={handleDayClick} onDayHover={setHoverDate}
            />
          </div>
        </div>
      )}
    </div>
  )
}

const downloadMock: DownloadTask[] = []

// ─────────────── Main Component ───────────────
export default function DownloadCenter() {
  const [draftFilters, setDraftFilters]   = useState<FilterForm>(defaultFilters)
  const [activeFilters, setActiveFilters] = useState<FilterForm>(defaultFilters)
  const [currentPage, setCurrentPage]     = useState(1)
  const [pageSize, setPageSize]           = useState<PageSizeOption>(10)
  const [data, setData]                   = useState<DownloadTask[]>([])
  const [total, setTotal]                 = useState(0)
  const [loading, setLoading]             = useState(false)

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    try {
      const f = activeFilters
      const params: Record<string, string | number> = {
        page: currentPage,
        pageSize,
      }
      const name = f.comicName.trim()
      if (name) params.comicName = name
      if (f.downloadContent) params.downloadContent = f.downloadContent
      if (f.status) params.status = f.status
      if (f.createdAtRange[0]) params.startDate = f.createdAtRange[0]
      if (f.createdAtRange[1]) params.endDate = f.createdAtRange[1]

      const res = await downloadApi.list(params)
      const list = (res.list ?? []).map((row: {
        id: number
        comicName: string
        downloadContent: string
        createdAt: string
        status: string
      }) => ({
        id: String(row.id),
        comicName: row.comicName,
        downloadContent: row.downloadContent as DownloadContent,
        createdAt: formatTaskCreatedAt(row.createdAt),
        status: row.status as DownloadStatus,
      }))
      setData(list)
      setTotal(res.total ?? 0)
    } catch {
      setData([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [activeFilters, currentPage, pageSize])

  useEffect(() => {
    void fetchTasks()
  }, [fetchTasks])

  function updateDraft<K extends keyof FilterForm>(key: K, val: FilterForm[K]) {
    setDraftFilters((prev) => ({ ...prev, [key]: val }))
  }

  function handleQuery() {
    setActiveFilters({ ...draftFilters, comicName: draftFilters.comicName.trim() })
    setCurrentPage(1)
  }

  function handleReset() {
    setDraftFilters(defaultFilters)
    setActiveFilters(defaultFilters)
    setCurrentPage(1)
  }

  async function handleRetry(id: string) {
    try {
      await downloadApi.retry(Number(id))
      await fetchTasks()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "重试失败")
    }
  }

  async function handleDownload(row: DownloadTask) {
    try {
      const { url } = await downloadApi.getUrl(Number(row.id))
      window.open(url, "_blank", "noopener,noreferrer")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "获取下载链接失败")
    }
  }

  return (
    <div className="flex flex-1 flex-col min-h-0 rounded-lg border border-[#e5e7eb] bg-white">

      {/* ── 筛选区 ── */}
      <div className="shrink-0 border-b border-[#e5e7eb] px-5 py-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">

          {/* 剧集名称 */}
          <FilterInput
            label="剧集名称"
            placeholder="请输入剧集名称"
            value={draftFilters.comicName}
            onChange={(v) => updateDraft("comicName", v)}
            width="w-[148px]"
          />

          {/* 下载内容 */}
          <SelectFilter
            label="下载内容"
            value={draftFilters.downloadContent}
            onChange={(v) => updateDraft("downloadContent", v)}
            options={downloadContentOptions}
            width="w-[148px]"
          />

          {/* 创建时间 */}
          <div className="flex items-center gap-1.5">
            <span className="shrink-0 text-[12.5px] text-[#374151]">创建时间</span>
            <DateRangePicker
              value={draftFilters.createdAtRange}
              onChange={(v) => updateDraft("createdAtRange", v)}
            />
          </div>

          {/* 状态 */}
          <SelectFilter
            label="状态"
            value={draftFilters.status}
            onChange={(v) => updateDraft("status", v)}
            options={statusOptions}
            width="w-[120px]"
          />

          {/* 查询 / 重置 */}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={handleQuery}
              className="flex h-[30px] items-center gap-1.5 rounded-[6px] bg-[#38c08f] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#2da87a]"
            >
              <Search size={13} />
              查询
            </button>
            <button
              onClick={handleReset}
              className="flex h-[30px] items-center gap-1.5 rounded-[6px] border border-[#d1d5db] bg-white px-4 text-[13px] text-[#374151] transition-colors hover:border-[#9ca3af]"
            >
              <RotateCcw size={12} />
              重置
            </button>
          </div>
        </div>
      </div>

      {/* ── 列表区 ── */}
      <div className="flex flex-1 flex-col min-h-0">
        <div className="flex-1 overflow-auto min-h-0">
          <table className="w-full min-w-[700px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#f9fafb]">
                {([
                  { label: "剧集名称", w: "w-[220px]" },
                  { label: "下载内容", w: "w-[160px]" },
                  { label: "创建时间", w: "w-[180px]" },
                  { label: "状态",     w: "w-[100px]" },
                  { label: "操作",     w: "w-[100px]" },
                ] as const).map(({ label, w }) => (
                  <th
                    key={label}
                    className={cn(
                      "sticky top-0 z-10 border-b border-[#e5e7eb] bg-[#f9fafb] px-4 py-3",
                      "text-left text-[12.5px] font-medium text-[#6b7280] whitespace-nowrap",
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
                  <td colSpan={5} className="py-16 text-center text-[13px] text-[#9ca3af]">
                    {loading ? "加载中…" : "暂无数据"}
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
                    <td className="px-4 py-3 text-[12.5px] font-medium text-[#111827] whitespace-nowrap">
                      {row.comicName}
                    </td>
                    <td className="px-4 py-3 text-[12.5px] text-[#374151] whitespace-nowrap">
                      {row.downloadContent === "有字幕视频" && "【有字幕】视频"}
                      {row.downloadContent === "无字幕视频" && "【无字幕】视频"}
                      {row.downloadContent === "提审材料"   && "提审材料"}
                    </td>
                    <td className="px-4 py-3 text-[12.5px] text-[#6b7280] whitespace-nowrap">
                      {row.createdAt}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {row.status === "已完成" && (
                          <button
                            onClick={() => handleDownload(row)}
                            className="flex h-[26px] items-center rounded-[4px] border border-[#d1fae5] bg-[#ecfdf5] px-2.5 text-[12px] font-medium text-[#059669] transition-colors hover:border-[#6ee7b7] hover:bg-[#d1fae5]"
                          >
                            下载
                          </button>
                        )}
                        {row.status === "失败" && (
                          <button
                            onClick={() => handleRetry(row.id)}
                            className="flex h-[26px] items-center rounded-[4px] border border-[#fee2e2] bg-[#fef2f2] px-2.5 text-[12px] font-medium text-[#dc2626] transition-colors hover:border-[#fca5a5] hover:bg-[#fee2e2]"
                          >
                            重试
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

        {/* ── 分页区 ── */}
        <div className="shrink-0">
          <ListPagination
            total={total}
            currentPage={currentPage}
            pageSize={pageSize}
            onPageChange={(p) => setCurrentPage(p)}
            onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1) }}
          />
        </div>
      </div>
    </div>
  )
}
