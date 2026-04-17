export interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
}

export interface PageData<T = any> {
  total: number
  list: T[]
}

export type PageSizeOption = 10 | 20 | 50 | 100
