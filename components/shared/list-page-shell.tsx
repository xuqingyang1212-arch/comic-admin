"use client"

import { Search, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import { ListPagination, type PageSizeOption } from "@/components/list-pagination"

export interface ListPageShellProps {
  /** Filter inputs (rendered inside the filter bar) */
  filters?: React.ReactNode
  /** Extra toolbar between filter bar and table (e.g. "新增" button) */
  toolbar?: React.ReactNode
  /** Pagination props */
  pagination?: {
    total: number
    currentPage: number
    pageSize: PageSizeOption
    onPageChange: (p: number) => void
    onPageSizeChange: (s: PageSizeOption) => void
  }
  /** Called when "查询" is clicked */
  onQuery?: () => void
  /** Called when "重置" is clicked */
  onReset?: () => void
  /** Minimum table width for horizontal scroll */
  tableMinWidth?: string
  /** Whether the card has rounded top corners (false when used under a tab bar) */
  roundedTop?: boolean
  /** Loading state text shown in empty table */
  loading?: boolean
  children: React.ReactNode
}

export function ListPageShell({
  filters,
  toolbar,
  pagination,
  onQuery,
  onReset,
  tableMinWidth,
  roundedTop = true,
  loading,
  children,
}: ListPageShellProps) {
  return (
    <div className={cn(
      "flex flex-1 flex-col min-h-0 border border-[#e5e7eb] bg-white",
      roundedTop ? "rounded-[8px]" : "rounded-b-[8px] border-t-0"
    )}>
      {/* Filter area */}
      {(filters || onQuery) && (
        <div className="shrink-0 border-b border-[#e5e7eb] px-5 py-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
            {filters}
            {(onQuery || onReset) && (
              <div className="ml-auto flex items-center gap-2">
                {onQuery && (
                  <button
                    onClick={onQuery}
                    className="flex h-[30px] items-center gap-1.5 rounded-[6px] bg-[#38c08f] px-4 text-[13px] font-medium text-white hover:bg-[#2da87a] transition-colors"
                  >
                    <Search size={13} />查询
                  </button>
                )}
                {onReset && (
                  <button
                    onClick={onReset}
                    className="flex h-[30px] items-center gap-1.5 rounded-[6px] border border-[#d1d5db] bg-white px-4 text-[13px] text-[#374151] hover:bg-[#f5f6f7] transition-colors"
                  >
                    <RotateCcw size={13} />重置
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toolbar */}
      {toolbar && (
        <div className="shrink-0 px-5 pt-3 flex items-center justify-between">
          {toolbar}
        </div>
      )}

      {/* Scrollable table area */}
      <div className="flex-1 overflow-auto min-h-0">
        {children}
      </div>

      {/* Pagination */}
      {pagination && (
        <div className="shrink-0">
          <ListPagination
            total={pagination.total}
            currentPage={pagination.currentPage}
            pageSize={pagination.pageSize}
            onPageChange={pagination.onPageChange}
            onPageSizeChange={pagination.onPageSizeChange}
          />
        </div>
      )}
    </div>
  )
}
