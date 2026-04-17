export type ArtStyle = "解说漫" | "动画漫" | "沙雕漫" | "仿真人剧"
export type VisualEffect = "静态" | "动态"
export type AspectRatio = "16:9" | "9:16"

export type AuditStatus = "待审核" | "已通过" | "已拒绝"
export type ScriptStatus = "草稿" | "待审核" | "已通过" | "已拒绝"
export type TaskStatus = "待领取" | "制作中" | "待审核" | "已完成" | "已取消"

export interface SelectOption {
  label: string
  value: string
}
