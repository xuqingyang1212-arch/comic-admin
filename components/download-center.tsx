"use client"

import { useState, useEffect, useCallback } from "react"
import { Search, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import { downloadApi } from "@/lib/api"
import { toast } from "@/lib/toast"
import { ListPagination, type PageSizeOption } from "@/components/list-pagination"
import { FilterInput, SelectFilter, DateRangePicker, StatusBadge } from "@/components/shared"

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
