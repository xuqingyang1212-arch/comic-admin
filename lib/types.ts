// 跨组件通用的后端数据形状。
// 这里只收录会被 3+ 个组件共同消费的类型；
// 业务详情 / 弹窗私有的表单模型继续留在各自组件内。

// ─── Pagination ─────────────────────────────────────────────────────────────

export { type PageSizeOption } from "@/components/list-pagination"

/** 列表接口统一返回形状：/api/v1/xxx 都是 { total, list }。 */
export interface PageData<T = unknown> {
  total: number
  list: T[]
}

// ─── User / Role ────────────────────────────────────────────────────────────

export interface User {
  id: number
  name: string
  email: string
  status: "启用" | "禁用"
  reviewerId?: number | null
  reviewer?: User | null
  roles?: Role[] | null
  createdAt?: string
  updatedAt?: string
}

export interface Role {
  id: number
  name: string
  remark?: string
  permissions?: Array<{ permissionKey: string }>
  createdAt?: string
  updatedAt?: string
}

// ─── Book / Script ──────────────────────────────────────────────────────────

export interface Book {
  id: number
  bookId: string
  bookName: string
}

export type ScriptType = "原作改编" | "原创" | "多版本"

export interface Script {
  id: number
  scriptId: string
  scriptName: string
  scriptType: ScriptType | string
  content?: string
  bookId?: number
  book?: Book | null
  originalScriptId?: number | null
  originalScript?: Script | null
  writerId?: number
  writer?: User | null
  reviewerId?: number | null
  reviewer?: User | null
  episodeCount?: number
  payEpisode?: string
  createdAt?: string
}

// ─── Script Draft ───────────────────────────────────────────────────────────

export type DraftAuditStatus =
  | "待提审"
  | "待认领"
  | "审核中"
  | "审核通过"
  | "驳回修改"
  | "审核不通过"

export interface ScriptDraft {
  id: number
  scriptName: string
  content?: string
  bookId?: number
  book?: Book | null
  scriptType?: ScriptType | string
  originalScriptId?: number | null
  originalScript?: Script | null
  auditStatus: DraftAuditStatus
  auditOpinion?: string
  writerId?: number
  writer?: User | null
  reviewerId?: number | null
  reviewer?: User | null
  episodeCount?: number
  payEpisode?: string
  payBreakpointData?: string | null
  createdAt?: string
  updatedAt?: string
}

// ─── Production ─────────────────────────────────────────────────────────────

export type TaskType = "制作" | "修改"

export type TaskProgress =
  | "待认领"
  | "全集制作中"
  | "全集审核中"
  | "分集制作中"
  | "分集审核中"
  | "返修版制作中"
  | "返修版审核中"
  | "二审审核中"
  | "已完成"
  | "已取消"

export interface ProductionTask {
  id: number
  taskName: string
  scriptId: number
  script?: Script | null
  comicId?: number | null
  episodeCount: number
  artStyle: string
  visualEffect: string
  aspectRatio: string
  productionRemark?: string
  taskType: TaskType
  taskProgress: TaskProgress
  initiatorId: number
  initiator?: User | null
  producerId?: number | null
  producer?: User | null
  reviewerId?: number | null
  reviewer?: User | null
  publishTime: string
  reviewEpisodeName?: string
  createdAt?: string
  updatedAt?: string
}

export type DeliveryType = "全集" | "分集" | "返修版"

export type DeliveryFileType =
  | "全集视频"
  | "有字幕视频"
  | "无字幕视频"
  | "封面图"
  | "版权证明"

export interface TaskDeliveryFile {
  id: number
  deliveryId: number
  fileType: DeliveryFileType | string
  episodeNum: number
  fileUrl: string
  fileName?: string
  fileSize?: number
  createdAt?: string
}

export interface TaskDelivery {
  id: number
  taskId: number
  deliveryType: DeliveryType | string
  episodeName?: string
  coverUrl?: string
  files?: TaskDeliveryFile[]
  createdAt?: string
}

// ─── Review ─────────────────────────────────────────────────────────────────

export type ReviewType = "全集审核" | "分集审核" | "二审审核" | "返修版审核"

export type ReviewStatus =
  | "待认领"
  | "审核中"
  | "审核通过"
  | "驳回修改"
  | "已取消"
  | "待提审"

export interface ReviewOpinion {
  id: number
  reviewTaskId: number
  content: string
  images?: string[]
  sortOrder?: number
}

export interface ReviewTask {
  id: number
  productionTaskId: number
  productionTask?: ProductionTask | null
  taskType: ReviewType
  reviewStatus: ReviewStatus
  reviewerId?: number | null
  reviewer?: User | null
  episodeName?: string
  opinions?: ReviewOpinion[]
  createdAt?: string
  updatedAt?: string
}

// ─── Comic ──────────────────────────────────────────────────────────────────

export interface ComicEpisode {
  id: number
  comicId: number
  episodeNum: number
  subtitledUrl?: string
  rawUrl?: string
  duration?: number
  fileSize?: number
  thumbnailUrl?: string
}

export interface Comic {
  id: number
  comicId: string
  episodeName: string
  scriptId: number
  script?: Script | null
  coverUrl?: string
  episodeCount: number
  payEpisode?: string
  artStyle: string
  visualEffect: string
  aspectRatio: string
  writerId: number
  writer?: User | null
  producerId: number
  producer?: User | null
  copyrightImages?: string[] | null
  episodes?: ComicEpisode[]
  createdAt?: string
  updatedAt?: string
}

// ─── Download ───────────────────────────────────────────────────────────────

export type DownloadStatus = "进行中" | "已完成" | "已失败" | "失败" | "已失效"

export interface DownloadTask {
  id: number
  comicId: number
  comicName: string
  downloadContent: "有字幕视频" | "无字幕视频" | "提审材料" | string
  status: DownloadStatus
  fileUrl?: string
  expiresAt?: string
  creatorId: number
  creator?: User | null
  createdAt: string
}

// ─── Common UI Shapes ───────────────────────────────────────────────────────

/** 日期区间筛选器值（与 DateRangePicker 一致） */
export type DateRangeValue = [string, string] | []
