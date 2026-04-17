function getApiBase() {
  if (typeof window !== "undefined") {
    return `http://${window.location.hostname}:8080/api/v1`;
  }
  return process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080/api/v1";
}

function getBackendOrigin() {
  return getApiBase().replace(/\/api\/v1\/?$/, "");
}

export function assetUrl(path: string | undefined | null): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:") || path.startsWith("blob:")) return path;
  return `${getBackendOrigin()}${path.startsWith("/") ? "" : "/"}${path}`;
}

interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

interface PageData<T = any> {
  total: number;
  list: T[];
}

let token = "";
let _offlineUntil = 0;

export function setToken(t: string) {
  token = t;
  if (typeof window !== "undefined") {
    localStorage.setItem("token", t);
  }
}

export function getToken(): string {
  if (token) return token;
  if (typeof window !== "undefined") {
    token = localStorage.getItem("token") || "";
  }
  return token;
}

export function clearToken() {
  token = "";
  if (typeof window !== "undefined") {
    localStorage.removeItem("token");
  }
}

async function request<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  if (Date.now() < _offlineUntil) throw new Error("backend offline");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  const t = getToken();
  if (t) {
    headers["Authorization"] = `Bearer ${t}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  let res: Response;
  try {
    res = await fetch(`${getApiBase()}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch {
    clearTimeout(timeout);
    _offlineUntil = Date.now() + 3000;
    throw new Error("backend offline");
  } finally {
    clearTimeout(timeout);
  }
  _offlineUntil = 0;

  if (res.status === 401) {
    clearToken();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new Error("未登录或登录已过期");
  }

  const text = await res.text();
  if (!text) {
    throw new Error(`服务器错误 (${res.status})`);
  }
  let json: ApiResponse<T>;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`服务器返回异常 (${res.status})`);
  }
  if (json.code !== 0) {
    throw new Error(json.message || "请求失败");
  }
  return json.data;
}

function get<T = any>(path: string, params?: Record<string, any>): Promise<T> {
  const query = params
    ? "?" +
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join("&")
    : "";
  return request<T>(path + query);
}

function post<T = any>(path: string, body?: any): Promise<T> {
  return request<T>(path, { method: "POST", body: JSON.stringify(body) });
}

function put<T = any>(path: string, body?: any): Promise<T> {
  return request<T>(path, { method: "PUT", body: JSON.stringify(body) });
}

function del<T = any>(path: string): Promise<T> {
  return request<T>(path, { method: "DELETE" });
}

// ======================== Auth ========================
export const authApi = {
  login: (email: string, name?: string) =>
    post<{ token: string; user: any }>("/auth/login", { email, name }),
  me: () => get<{ user: any; permissions: string[] }>("/users/me"),
};

// ======================== Users ========================
export const userApi = {
  list: (params?: any) => get<PageData>("/users", params),
  update: (id: number, body: any) => put(`/users/${id}`, body),
};

// ======================== Roles ========================
export const roleApi = {
  list: (params?: any) => get<PageData>("/roles", params),
  create: (body: any) => post("/roles", body),
  update: (id: number, body: any) => put(`/roles/${id}`, body),
  permissionTree: () => get<any[]>("/permissions/tree"),
};

// ======================== Books ========================
export const bookApi = {
  list: (params?: any) => get<PageData>("/books", params),
  detail: (id: number) => get<any>(`/books/${id}`),
};

// ======================== Script Drafts ========================
export const scriptDraftApi = {
  list: (params?: any) => get<PageData>("/script-drafts", params),
  detail: (id: number) => get<any>(`/script-drafts/${id}`),
  create: (body: any) => post("/script-drafts", body),
  update: (id: number, body: any) => put(`/script-drafts/${id}`, body),
  submit: (id: number) => post(`/script-drafts/${id}/submit`),
  delete: (id: number) => del(`/script-drafts/${id}`),
  auditLogs: (id: number) => get<any[]>(`/script-drafts/${id}/audit-logs`),
};

// ======================== Script Audit ========================
export const scriptAuditApi = {
  hall: (params?: any) => get<PageData>("/script-audit/hall", params),
  mine: (params?: any) => get<PageData>("/script-audit/mine", params),
  claim: (id: number) => post(`/script-audit/${id}/claim`),
  review: (id: number, body: any) => post(`/script-audit/${id}/review`, body),
  saveDraft: (id: number, body: any) =>
    put(`/script-audit/${id}/save`, body),
};

// ======================== Scripts ========================
export const scriptApi = {
  list: (params?: any) => get<PageData>("/scripts", params),
  detail: (id: number) => get<any>(`/scripts/${id}`),
  publishTask: (id: number, body: any) =>
    post(`/scripts/${id}/production-tasks`, body),
  remake: (id: number, body: any) =>
    post(`/scripts/${id}/remakes`, body),
};

// ======================== Production Tasks ========================
export const productionTaskApi = {
  hall: (params?: any) => get<PageData>("/production-tasks/hall", params),
  mine: (params?: any) => get<PageData>("/production-tasks/mine", params),
  detail: (id: number) => get<any>(`/production-tasks/${id}`),
  claim: (id: number) => post(`/production-tasks/${id}/claim`),
  cancel: (id: number) => post(`/production-tasks/${id}/cancel`),
  auditLogs: (id: number) =>
    get<any[]>(`/production-tasks/${id}/audit-logs`),
  listDeliveries: (id: number, deliveryType?: string) =>
    get<any[]>(`/production-tasks/${id}/deliveries`, deliveryType ? { deliveryType } : undefined),
  submitDelivery: (id: number, body: any) =>
    post(`/production-tasks/${id}/deliveries`, body),
  saveDeliveryDraft: (id: number, body: any) =>
    put(`/production-tasks/${id}/deliveries/draft`, body),
};

// ======================== Comic Review ========================
export const comicReviewApi = {
  list: (params?: any) => get<PageData>("/comic-review/tasks", params),
  detail: (id: number) => get<any>(`/comic-review/tasks/${id}`),
  review: (id: number, body: any) =>
    post(`/comic-review/tasks/${id}/review`, body),
  saveDraft: (id: number, body: any) =>
    put(`/comic-review/tasks/${id}/save`, body),
  logs: (id: number) =>
    get<any[]>(`/comic-review/tasks/${id}/logs`),
};

// ======================== Comics ========================
export const comicApi = {
  list: (params?: any) => get<PageData>("/comics", params),
  detail: (id: number) => get<any>(`/comics/${id}`),
  download: (id: number, downloadContent: string, force = false) =>
    post<{ duplicate?: boolean; message?: string; taskId?: number }>(`/comics/${id}/download`, { downloadContent, force }),
  revision: (id: number, body: any) =>
    post(`/comics/${id}/revisions`, body),
};

// ======================== Download Center ========================
export const downloadApi = {
  list: (params?: any) => get<PageData>("/download/tasks", params),
  getUrl: (id: number) => get<{ url: string }>(`/download/tasks/${id}/url`),
  retry: (id: number) => post(`/download/tasks/${id}/retry`),
};

// ======================== Upload ========================
export const uploadApi = {
  presign: (body: { fileName: string; fileType: string; scene?: string }) =>
    post<{ uploadUrl: string; fileKey: string; fileUrl: string }>(
      "/upload/presign",
      body
    ),
};
