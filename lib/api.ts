// Endpoint 集合：业务 API 分组聚合。
// 注意：HTTP 客户端 / token 管理位于 ./api-client，所有 endpoint 共用同一份 request 封装。
// 其他文件保持从 "@/lib/api" 导入即可，无需感知拆分。

import { get, post, put, del } from "./api-client"
import type { PageData } from "./types"

export {
  assetUrl,
  setToken,
  getToken,
  clearToken,
} from "./api-client"

// ======================== Auth ========================
export const authApi = {
  login: (email: string, password: string) =>
    post<{ token: string; user: any }>("/auth/login", { email, password }),
  register: (body: { email: string; code: string; password: string; name: string; roleId?: number }) =>
    post<null>("/auth/register", body),
  resetPassword: (body: { email: string; code: string; password: string }) =>
    post<null>("/auth/reset-password", body),
  inviteInfo: (code: string) =>
    get<{ roleId: number; roleName: string }>("/auth/invite-info", { code }),
  checkEmail: (email: string) =>
    post<null>("/auth/check-email", { email }),
  me: () => get<{ user: any; permissions: string[] }>("/users/me"),
}

// ======================== Register Review ========================
export const registerReviewApi = {
  list: <T = any>(params?: any) => get<PageData<T>>("/register-reviews", params),
  review: (id: number, action: "approve" | "reject") =>
    post(`/register-reviews/${id}/review`, { action }),
}

// ======================== Users ========================
export const userApi = {
  list: <T = any>(params?: any) => get<PageData<T>>("/users", params),
  update: (id: number, body: any) => put(`/users/${id}`, body),
}

// ======================== Roles ========================
export const roleApi = {
  list: <T = any>(params?: any) => get<PageData<T>>("/roles", params),
  create: (body: any) => post<any>("/roles", body),
  update: (id: number, body: any) => put<any>(`/roles/${id}`, body),
  permissionTree: () => get<any[]>("/permissions/tree"),
  inviteCode: (id: number) => get<{ code: string }>(`/roles/${id}/invite-code`),
}

// ======================== Books ========================
export const bookApi = {
  list: <T = any>(params?: any) => get<PageData<T>>("/books", params),
  detail: (id: number) => get<any>(`/books/${id}`),
}

// ======================== Script Drafts ========================
export const scriptDraftApi = {
  list: <T = any>(params?: any) => get<PageData<T>>("/script-drafts", params),
  detail: (id: number) => get<any>(`/script-drafts/${id}`),
  create: (body: any) => post<any>("/script-drafts", body),
  update: (id: number, body: any) => put<any>(`/script-drafts/${id}`, body),
  submit: (id: number) => post<any>(`/script-drafts/${id}/submit`),
  delete: (id: number) => del<any>(`/script-drafts/${id}`),
  auditLogs: (id: number) => get<any[]>(`/script-drafts/${id}/audit-logs`),
}

// ======================== Script Audit ========================
export const scriptAuditApi = {
  hall: <T = any>(params?: any) => get<PageData<T>>("/script-audit/hall", params),
  mine: <T = any>(params?: any) => get<PageData<T>>("/script-audit/mine", params),
  claim: (id: number) => post<any>(`/script-audit/${id}/claim`),
  review: (id: number, body: any) => post<any>(`/script-audit/${id}/review`, body),
  saveDraft: (id: number, body: any) =>
    put<any>(`/script-audit/${id}/save`, body),
}

// ======================== Scripts ========================
export const scriptApi = {
  list: <T = any>(params?: any) => get<PageData<T>>("/scripts", params),
  detail: (id: number) => get<any>(`/scripts/${id}`),
  publishTask: (id: number, body: any) =>
    post<any>(`/scripts/${id}/production-tasks`, body),
  remake: (id: number, body: any) =>
    post<any>(`/scripts/${id}/remakes`, body),
}

// ======================== Production Tasks ========================
export const productionTaskApi = {
  hall: <T = any>(params?: any) => get<PageData<T>>("/production-tasks/hall", params),
  mine: <T = any>(params?: any) => get<PageData<T>>("/production-tasks/mine", params),
  detail: (id: number) => get<any>(`/production-tasks/${id}`),
  claim: (id: number) => post<any>(`/production-tasks/${id}/claim`),
  cancel: (id: number) => post<any>(`/production-tasks/${id}/cancel`),
  auditLogs: (id: number) =>
    get<any[]>(`/production-tasks/${id}/audit-logs`),
  listDeliveries: (id: number, deliveryType?: string) =>
    get<any[]>(
      `/production-tasks/${id}/deliveries`,
      deliveryType ? { deliveryType } : undefined
    ),
  submitDelivery: (id: number, body: any) =>
    post<any>(`/production-tasks/${id}/deliveries`, body),
  saveDeliveryDraft: (id: number, body: any) =>
    put<any>(`/production-tasks/${id}/deliveries/draft`, body),
}

// ======================== Comic Review ========================
export const comicReviewApi = {
  list: <T = any>(params?: any) => get<PageData<T>>("/comic-review/tasks", params),
  detail: (id: number) => get<any>(`/comic-review/tasks/${id}`),
  review: (id: number, body: any) =>
    post<any>(`/comic-review/tasks/${id}/review`, body),
  saveDraft: (id: number, body: any) =>
    put<any>(`/comic-review/tasks/${id}/save`, body),
  logs: (id: number) =>
    get<any[]>(`/comic-review/tasks/${id}/logs`),
}

// ======================== Comics ========================
export const comicApi = {
  list: <T = any>(params?: any) => get<PageData<T>>("/comics", params),
  detail: (id: number) => get<any>(`/comics/${id}`),
  download: (id: number, downloadContent: string, force = false) =>
    post<{ duplicate?: boolean; message?: string; taskId?: number }>(
      `/comics/${id}/download`,
      { downloadContent, force }
    ),
  revision: (id: number, body: any) =>
    post<any>(`/comics/${id}/revisions`, body),
}

// ======================== Download Center ========================
export const downloadApi = {
  list: <T = any>(params?: any) => get<PageData<T>>("/download/tasks", params),
  getUrl: (id: number) => get<{ url: string }>(`/download/tasks/${id}/url`),
  retry: (id: number) => post<any>(`/download/tasks/${id}/retry`),
}

// ======================== Upload ========================
export const uploadApi = {
  presign: (body: { fileName: string; fileType: string; scene?: string }) =>
    post<{ uploadUrl: string; fileKey: string; fileUrl: string }>(
      "/upload/presign",
      body
    ),
}
