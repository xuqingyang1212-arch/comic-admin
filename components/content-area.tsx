"use client"

import { ChevronRight, Home } from "lucide-react"
import { cn } from "@/lib/utils"
import dynamic from "next/dynamic"

function PageSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-3 rounded-[8px] border border-[#e5e7eb] bg-white p-5 animate-pulse">
      <div className="h-[44px] rounded-[6px] bg-[#f3f4f6]" />
      <div className="flex-1 rounded-[6px] bg-[#f9fafb]" />
    </div>
  )
}

const BookManagement = dynamic(() => import("@/components/book-management"), { ssr: false, loading: () => <PageSkeleton /> })
const ScriptCreation = dynamic(() => import("@/components/script-creation"), { ssr: false, loading: () => <PageSkeleton /> })
const ScriptReview = dynamic(() => import("@/components/script-review"), { ssr: false, loading: () => <PageSkeleton /> })
const ScriptManagement = dynamic(() => import("@/components/script-management"), { ssr: false, loading: () => <PageSkeleton /> })
const TaskHall = dynamic(() => import("@/components/task-hall"), { ssr: false, loading: () => <PageSkeleton /> })
const MyTask = dynamic(() => import("@/components/my-task"), { ssr: false, loading: () => <PageSkeleton /> })
const DraftReview = dynamic(() => import("@/components/draft-review"), { ssr: false, loading: () => <PageSkeleton /> })
const ComicManagement = dynamic(() => import("@/components/comic-management"), { ssr: false, loading: () => <PageSkeleton /> })
const DownloadCenter = dynamic(() => import("@/components/download-center"), { ssr: false, loading: () => <PageSkeleton /> })
const UserManagement = dynamic(() => import("@/components/user-management"), { ssr: false, loading: () => <PageSkeleton /> })
const RoleManagement = dynamic(() => import("@/components/role-management"), { ssr: false, loading: () => <PageSkeleton /> })

interface ContentAreaProps {
  breadcrumb: { parent?: string; current: string }
  selectedKey: string
}

export default function ContentArea({ breadcrumb, selectedKey }: ContentAreaProps) {
  return (
    <main className="flex flex-1 flex-col overflow-hidden p-5">
      {/* Breadcrumb */}
      <div className="mb-4 flex shrink-0 items-center gap-1.5 text-[12.5px] text-[#9ca3af]">
        <Home size={12} className="text-[#9ca3af]" />
        <ChevronRight size={11} />
        {breadcrumb.parent && (
          <>
            <span>{breadcrumb.parent}</span>
            <ChevronRight size={11} />
          </>
        )}
        <span className="text-[#374151] font-medium">{breadcrumb.current}</span>
      </div>


      {/* Main content card */}
      <div className="flex flex-1 flex-col min-h-0">
        {selectedKey === "book" ? (
          <BookManagement />
        ) : selectedKey === "script" ? (
          <ScriptManagement />
        ) : selectedKey === "scriptCreate" ? (
          <ScriptCreation />
        ) : selectedKey === "scriptReview" ? (
          <ScriptReview />
        ) : selectedKey === "taskHall" ? (
          <TaskHall />
        ) : selectedKey === "myTask" ? (
          <MyTask />
        ) : selectedKey === "draftReview" ? (
          <DraftReview />
        ) : selectedKey === "comic" ? (
          <ComicManagement />
        ) : selectedKey === "downloadCenter" ? (
          <DownloadCenter />
        ) : selectedKey === "userMgr" ? (
          <UserManagement />
        ) : selectedKey === "roleMgr" ? (
          <RoleManagement />
        ) : (
      <div className="flex flex-col gap-3 rounded-lg bg-white border border-[#e5e7eb]">
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-[#e5e7eb] px-5 py-4">
          <FilterInput label="名称" placeholder="请输入" />
          <FilterInput label="状态" placeholder="请选择" isSelect />
          <FilterInput label="创建人" placeholder="请输入" />
          <div className="ml-auto flex items-center gap-2">
            <button className="flex items-center gap-1.5 rounded-[6px] bg-[#38c08f] px-4 py-1.5 text-[13px] font-medium text-white hover:bg-[#2da87a] transition-colors">
              查询
            </button>
            <button className="flex items-center gap-1.5 rounded-[6px] border border-[#d1d5db] bg-white px-4 py-1.5 text-[13px] text-[#374151] hover:bg-[#f5f6f7] transition-colors">
              重置
            </button>
          </div>
        </div>

        {/* Table toolbar */}
        <div className="flex items-center justify-between px-5 pt-1">
          <button className="rounded-[6px] bg-[#38c08f] px-3.5 py-1.5 text-[12.5px] font-medium text-white hover:bg-[#2da87a] transition-colors">
            + 新增
          </button>
          <button className="flex items-center gap-1.5 rounded-[6px] border border-[#d1d5db] bg-white px-3.5 py-1.5 text-[12.5px] text-[#374151] hover:bg-[#f5f6f7] transition-colors">
            导出
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto px-5 pb-5">
          <table className="w-full min-w-[700px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#f9fafb]">
                <th className="border-b border-[#e5e7eb] px-4 py-3 text-left text-[12.5px] font-medium text-[#6b7280]">
                  名称
                </th>
                <th className="border-b border-[#e5e7eb] px-4 py-3 text-left text-[12.5px] font-medium text-[#6b7280]">
                  类型
                </th>
                <th className="border-b border-[#e5e7eb] px-4 py-3 text-left text-[12.5px] font-medium text-[#6b7280]">
                  状态
                </th>
                <th className="border-b border-[#e5e7eb] px-4 py-3 text-left text-[12.5px] font-medium text-[#6b7280]">
                  创建人
                </th>
                <th className="border-b border-[#e5e7eb] px-4 py-3 text-left text-[12.5px] font-medium text-[#6b7280]">
                  创建时间
                </th>
                <th className="border-b border-[#e5e7eb] px-4 py-3 text-left text-[12.5px] font-medium text-[#6b7280]">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {([] as any[]).map((row, i) => (
                <tr
                  key={`ca-row-${row.id}`}
                  className={cn(
                    "transition-colors hover:bg-[#f9fafb]",
                    i < 0 && "border-b border-[#f3f4f6]"
                  )}
                >
                  <td className="px-4 py-3 text-[#111827]">{row.name}</td>
                  <td className="px-4 py-3 text-[#4b5563]">{row.type}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3 text-[#4b5563]">{row.creator}</td>
                  <td className="px-4 py-3 text-[#6b7280]">{row.createdAt}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button className="text-[#38c08f] hover:text-[#2da87a] transition-colors">
                        编辑
                      </button>
                      <button className="text-[#9ca3af] hover:text-[#6b7280] transition-colors">
                        查看
                      </button>
                      <button className="text-[#f04438] hover:text-[#d03025] transition-colors">
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-[#e5e7eb] px-5 py-3">
          <span className="text-[12.5px] text-[#6b7280]">
            共 0 条记录
          </span>
          <div className="flex items-center gap-1.5">
            <button className="flex h-7 w-7 items-center justify-center rounded-[4px] border border-[#d1d5db] bg-white text-[12px] text-[#374151] hover:border-[#38c08f] hover:text-[#38c08f] transition-colors disabled:opacity-40">
              ‹
            </button>
            <button className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-[#38c08f] text-[12px] font-medium text-white">
              1
            </button>
            <button className="flex h-7 w-7 items-center justify-center rounded-[4px] border border-[#d1d5db] bg-white text-[12px] text-[#374151] hover:border-[#38c08f] hover:text-[#38c08f] transition-colors">
              2
            </button>
            <button className="flex h-7 w-7 items-center justify-center rounded-[4px] border border-[#d1d5db] bg-white text-[12px] text-[#374151] hover:border-[#38c08f] hover:text-[#38c08f] transition-colors">
              ›
            </button>
            <span className="ml-2 flex items-center gap-1 text-[12.5px] text-[#6b7280]">
              50条/页
            </span>
          </div>
        </div>
      </div>
        )}
      </div>
    </main>
  )
}

function FilterInput({
  label,
  placeholder,
  isSelect,
}: {
  label: string
  placeholder: string
  isSelect?: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="whitespace-nowrap text-[13px] text-[#374151]">{label}</span>
      <div className="relative">
        <input
          type="text"
          placeholder={placeholder}
          className="h-[30px] w-[160px] rounded-[6px] border border-[#d1d5db] bg-white px-3 text-[13px] text-[#374151] placeholder-[#9ca3af] outline-none focus:border-[#38c08f] transition-colors"
          readOnly={isSelect}
        />
        {isSelect && (
          <ChevronRight
            size={12}
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 text-[#9ca3af]"
          />
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; bg: string; text: string }> = {
    active: { label: "已上线", bg: "bg-[#ecfdf5]", text: "text-[#059669]" },
    pending: { label: "待审核", bg: "bg-[#fffbeb]", text: "text-[#d97706]" },
    draft: { label: "草稿", bg: "bg-[#f3f4f6]", text: "text-[#6b7280]" },
    rejected: { label: "已拒绝", bg: "bg-[#fef2f2]", text: "text-[#dc2626]" },
  }
  const c = config[status] ?? config.draft
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[4px] px-2 py-0.5 text-[11.5px] font-medium",
        c.bg,
        c.text
      )}
    >
      {c.label}
    </span>
  )
}
