import type { SelectOption } from "@/components/shared/select-filter"

export const ART_STYLES = ["解说漫", "动画漫", "沙雕漫", "仿真人剧"] as const
export const VISUAL_EFFECTS = ["2D", "3D", "仿真人"] as const
export const ASPECT_RATIOS = ["横屏 16:9", "竖屏 9:16"] as const

export type ArtStyle = (typeof ART_STYLES)[number]
export type VisualEffect = (typeof VISUAL_EFFECTS)[number]
export type AspectRatio = (typeof ASPECT_RATIOS)[number]

function toSelectOptions(arr: readonly string[]): SelectOption[] {
  return arr.map((v) => ({ label: v, value: v }))
}

export const ART_STYLE_OPTIONS: SelectOption[] = toSelectOptions(ART_STYLES)
export const VISUAL_EFFECT_OPTIONS: SelectOption[] = toSelectOptions(VISUAL_EFFECTS)
export const ASPECT_RATIO_OPTIONS: SelectOption[] = toSelectOptions(ASPECT_RATIOS)

export const TASK_TYPE_OPTIONS: SelectOption[] = [
  { label: "制作", value: "制作" },
  { label: "修改", value: "修改" },
]

export const TASK_HALL_PROGRESS_BY_TYPE: Record<string, SelectOption[]> = {
  "制作": [
    { label: "待认领", value: "待认领" },
    { label: "全集制作中", value: "全集制作中" },
    { label: "全集审核中", value: "全集审核中" },
    { label: "分集制作中", value: "分集制作中" },
    { label: "分集审核中", value: "分集审核中" },
    { label: "二审审核中", value: "二审审核中" },
    { label: "已完成", value: "已完成" },
    { label: "已取消", value: "已取消" },
  ],
  "修改": [
    { label: "返修版制作中", value: "返修版制作中" },
    { label: "返修版审核中", value: "返修版审核中" },
    { label: "已完成", value: "已完成" },
    { label: "已取消", value: "已取消" },
  ],
}

export const MY_TASK_PROGRESS_BY_TYPE: Record<string, SelectOption[]> = {
  "制作": [
    { label: "全集制作中", value: "全集制作中" },
    { label: "全集审核中", value: "全集审核中" },
    { label: "分集制作中", value: "分集制作中" },
    { label: "分集审核中", value: "分集审核中" },
    { label: "二审审核中", value: "二审审核中" },
    { label: "已完成", value: "已完成" },
    { label: "已取消", value: "已取消" },
  ],
  "修改": [
    { label: "返修版制作中", value: "返修版制作中" },
    { label: "返修版审核中", value: "返修版审核中" },
    { label: "已完成", value: "已完成" },
    { label: "已取消", value: "已取消" },
  ],
}

export const MAX_OPINION_IMAGES = 15

// ─── Shared Status Style Maps ────────────────────────────────────────────────

export type StatusStyle = { bg: string; text: string }

export const REVIEW_STATUS_STYLES: Record<string, StatusStyle> = {
  "审核中": { bg: "bg-[#fff7ed]", text: "text-[#ea580c]" },
  "驳回修改": { bg: "bg-[#fffbeb]", text: "text-[#d97706]" },
  "审核通过": { bg: "bg-[#ecfdf5]", text: "text-[#059669]" },
  "已取消": { bg: "bg-[#f3f4f6]", text: "text-[#6b7280]" },
}

export const REVIEW_TASK_TYPE_STYLES: Record<string, StatusStyle> = {
  "全集审核": { bg: "bg-[#eff6ff]", text: "text-[#2563eb]" },
  "分集审核": { bg: "bg-[#f5f3ff]", text: "text-[#7c3aed]" },
  "二审审核": { bg: "bg-[#fef3c7]", text: "text-[#d97706]" },
  "返修版审核": { bg: "bg-[#fff0f6]", text: "text-[#db2777]" },
}

export const TASK_PROGRESS_STYLES: Record<string, StatusStyle> = {
  "待认领": { bg: "bg-[#f3f4f6]", text: "text-[#6b7280]" },
  "全集制作中": { bg: "bg-[#eff6ff]", text: "text-[#2563eb]" },
  "全集审核中": { bg: "bg-[#fff7ed]", text: "text-[#ea580c]" },
  "分集制作中": { bg: "bg-[#eff6ff]", text: "text-[#2563eb]" },
  "分集审核中": { bg: "bg-[#fff7ed]", text: "text-[#ea580c]" },
  "二审审核中": { bg: "bg-[#fef3c7]", text: "text-[#d97706]" },
  "已完成": { bg: "bg-[#ecfdf5]", text: "text-[#059669]" },
  "已取消": { bg: "bg-[#f3f4f6]", text: "text-[#6b7280]" },
  "返修版制作中": { bg: "bg-[#eff6ff]", text: "text-[#2563eb]" },
  "返修版审核中": { bg: "bg-[#fff7ed]", text: "text-[#ea580c]" },
}

export const DEFAULT_STATUS_STYLE: StatusStyle = { bg: "bg-[#f3f4f6]", text: "text-[#6b7280]" }
