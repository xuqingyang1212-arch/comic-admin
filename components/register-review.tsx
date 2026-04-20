"use client"

import { useState, useCallback, useEffect } from "react"
import { Search, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import { ListPagination } from "@/components/list-pagination"
import { FilterInput, SelectFilter, StatusBadge } from "@/components/shared"
import { registerReviewApi, roleApi } from "@/lib/api"
import { formatDateTime } from "@/lib/format"
import { usePerm } from "@/components/admin-layout"
import { useFilters } from "@/hooks/use-filters"
import { usePagination } from "@/hooks/use-pagination"
import { toast } from "@/lib/toast"

// ─────────────── Types ───────────────

interface ReviewRow {
  id: number
  name: string
  email: string
  roleId: number
  roleName: string
  reviewStatus: string
  createdAt: string
}

interface FilterForm {
  name: string
  email: string
  roleId: string
  reviewStatus: string
}

const DEFAULT_FILTERS: FilterForm = { name: "", email: "", roleId: "", reviewStatus: "" }

const REVIEW_STATUS_OPTIONS = [
  { value: "审核中", label: "审核中" },
  { value: "审核通过", label: "审核通过" },
  { value: "审核不通过", label: "审核不通过" },
]

const STATUS_MAP: Record<string, { bg: string; text: string }> = {
  "审核中":   { bg: "bg-[#eff6ff]", text: "text-[#2563eb]" },
  "审核通过": { bg: "bg-[#ecfdf5]", text: "text-[#059669]" },
  "审核不通过": { bg: "bg-[#fef2f2]", text: "text-[#dc2626]" },
}

// ─────────────── Main Component ───────────────

export default function RegisterReview() {
  const [data, setData] = useState<ReviewRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [roleOptions, setRoleOptions] = useState<{ value: string; label: string }[]>([])
  const { draft, active, update, apply, reset } = useFilters(DEFAULT_FILTERS)
  const { page, pageSize, resetPage, paginationProps } = usePagination()
  const [listTick, setListTick] = useState(0)

  const canReview = usePerm("system.registerReview.review")

  useEffect(() => {
    roleApi.list({ page: 1, pageSize: 100 })
      .then((res) => {
        const list = (res.list ?? []).map((r: any) => ({
          value: String(r.id),
          label: String(r.name),
        }))
        setRoleOptions(list)
      })
      .catch(() => setRoleOptions([]))
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, pageSize }
      if (active.name.trim()) params.name = active.name.trim()
      if (active.email.trim()) params.email = active.email.trim()
      if (active.roleId) params.roleId = active.roleId
      if (active.reviewStatus) params.reviewStatus = active.reviewStatus
      const res = await registerReviewApi.list(params)
      setData(res.list ?? [])
      setTotal(res.total ?? 0)
    } catch {
      setData([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, active, listTick])

  useEffect(() => { void fetchData() }, [fetchData])

  function handleQuery() { apply(); resetPage(); setListTick((t) => t + 1) }
  function handleReset() { reset(); resetPage(); setListTick((t) => t + 1) }

  async function handleReview(id: number, action: "approve" | "reject") {
    try {
      await registerReviewApi.review(id, action)
      toast.success(action === "approve" ? "已通过" : "已拒绝")
      await fetchData()
    } catch (e: any) {
      toast.errorFrom(e, "操作失败")
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-3 min-h-0">
      {/* 筛选区 */}
      <div className="shrink-0 rounded-[8px] border border-[#e5e7eb] bg-white px-5 py-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <FilterInput label="用户名" placeholder="请输入用户名" value={draft.name}
            onChange={(v) => update("name", v)} onKeyDown={(e: React.KeyboardEvent) => e.key === "Enter" && handleQuery()} />
          <FilterInput label="邮箱" placeholder="请输入邮箱" value={draft.email}
            onChange={(v) => update("email", v)} onKeyDown={(e: React.KeyboardEvent) => e.key === "Enter" && handleQuery()} />
          <SelectFilter label="角色" placeholder="全部角色" value={draft.roleId}
            onChange={(v) => update("roleId", v)} options={roleOptions} />
          <SelectFilter label="审核状态" placeholder="全部状态" value={draft.reviewStatus}
            onChange={(v) => update("reviewStatus", v)} options={REVIEW_STATUS_OPTIONS} />
          <div className="ml-auto flex items-center gap-2">
            <button onClick={handleQuery}
              className="flex h-[30px] items-center gap-1.5 rounded-[6px] bg-[#38c08f] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#2da87a]">
              <Search size={13} />查询
            </button>
            <button onClick={handleReset}
              className="flex h-[30px] items-center gap-1.5 rounded-[6px] border border-[#d1d5db] bg-white px-4 text-[13px] text-[#374151] transition-colors hover:bg-[#f5f6f7]">
              <RotateCcw size={12} />重置
            </button>
          </div>
        </div>
      </div>

      {/* 列表区 */}
      <div className="flex flex-1 flex-col min-h-0 rounded-[8px] border border-[#e5e7eb] bg-white">
        <div className="flex-1 overflow-auto min-h-0">
          <table className="w-full min-w-[700px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#f9fafb]">
                {[
                  { label: "用户名", w: "" },
                  { label: "角色",   w: "" },
                  { label: "邮箱",   w: "" },
                  { label: "注册时间", w: "w-[160px]" },
                  { label: "审核状态", w: "w-[110px]" },
                  { label: "操作",   w: "w-[160px]" },
                ].map(({ label, w }) => (
                  <th key={label}
                    className={cn("sticky top-0 z-10 border-b border-[#e5e7eb] bg-[#f9fafb] px-4 py-3 text-left text-[12.5px] font-medium text-[#6b7280] whitespace-nowrap", w)}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-[13px] text-[#9ca3af]">
                    {loading ? "加载中…" : "暂无数据"}
                  </td>
                </tr>
              ) : data.map((row, i) => (
                <tr key={row.id}
                  className={cn("transition-colors hover:bg-[#f9fafb]", i < data.length - 1 && "border-b border-[#f3f4f6]")}>
                  <td className="px-4 py-3 text-[12.5px] font-medium text-[#111827] whitespace-nowrap">{row.name}</td>
                  <td className="px-4 py-3 text-[12.5px] text-[#4b5563] whitespace-nowrap">
                    {row.roleName || <span className="text-[#9ca3af]">—</span>}
                  </td>
                  <td className="px-4 py-3 text-[12.5px] text-[#4b5563] whitespace-nowrap">{row.email}</td>
                  <td className="px-4 py-3 text-[12.5px] text-[#6b7280] whitespace-nowrap">{formatDateTime(row.createdAt)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge status={row.reviewStatus} config={STATUS_MAP} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {canReview && row.reviewStatus === "审核中" && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleReview(row.id, "approve")}
                          className="flex h-[26px] items-center rounded-[4px] border border-[#38c08f] bg-white px-2.5 text-[12px] text-[#38c08f] transition-colors hover:bg-[#f0fdf4]"
                        >
                          通过
                        </button>
                        <button
                          onClick={() => handleReview(row.id, "reject")}
                          className="flex h-[26px] items-center rounded-[4px] border border-[#f04438] bg-white px-2.5 text-[12px] text-[#f04438] transition-colors hover:bg-[#fef2f2]"
                        >
                          不通过
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="shrink-0">
          <ListPagination total={total} {...paginationProps} />
        </div>
      </div>
    </div>
  )
}
