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
    { label: "初版制作中", value: "初版制作中" },
    { label: "初版审核中", value: "初版审核中" },
    { label: "终版制作中", value: "终版制作中" },
    { label: "终版审核中", value: "终版审核中" },
    { label: "已完成", value: "已完成" },
    { label: "已取消", value: "已取消" },
  ],
  "修改": [
    { label: "修改版制作中", value: "修改版制作中" },
    { label: "修改版审核中", value: "修改版审核中" },
    { label: "已完成", value: "已完成" },
    { label: "已取消", value: "已取消" },
  ],
}

export const MY_TASK_PROGRESS_BY_TYPE: Record<string, SelectOption[]> = {
  "制作": [
    { label: "初版制作中", value: "初版制作中" },
    { label: "初版审核中", value: "初版审核中" },
    { label: "终版制作中", value: "终版制作中" },
    { label: "终版审核中", value: "终版审核中" },
    { label: "已完成", value: "已完成" },
    { label: "已取消", value: "已取消" },
  ],
  "修改": [
    { label: "修改版制作中", value: "修改版制作中" },
    { label: "修改版审核中", value: "修改版审核中" },
    { label: "已完成", value: "已完成" },
    { label: "已取消", value: "已取消" },
  ],
}

export const MAX_OPINION_IMAGES = 15
