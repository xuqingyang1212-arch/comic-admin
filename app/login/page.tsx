"use client"

import { useState } from "react"
import { authApi, setToken } from "@/lib/api"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setError("请输入邮箱")
      return
    }
    setLoading(true)
    setError("")
    try {
      const data = await authApi.login(trimmedEmail, name.trim() || undefined)
      setToken(data.token)
      window.location.replace("/")
    } catch (err) {
      console.error("Login failed:", err)
      setError(err instanceof Error ? err.message : "登录失败")
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f7f9]">
      <div className="w-full max-w-[400px] rounded-xl border border-[#e5e7eb] bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-[22px] font-semibold text-[#111827]">漫剧运营后台</h1>
          <p className="mt-1.5 text-[13px] text-[#6b7280]">登录以访问管理系统</p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">邮箱</label>
            <input
              type="email"
              placeholder="请输入邮箱地址"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-[38px] w-full rounded-[6px] border border-[#d1d5db] bg-white px-3 text-[13px] text-[#374151] placeholder-[#9ca3af] outline-none focus:border-[#38c08f] transition-colors"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">
              姓名 <span className="font-normal text-[#9ca3af]">(首次登录自动注册)</span>
            </label>
            <input
              type="text"
              placeholder="请输入姓名"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-[38px] w-full rounded-[6px] border border-[#d1d5db] bg-white px-3 text-[13px] text-[#374151] placeholder-[#9ca3af] outline-none focus:border-[#38c08f] transition-colors"
            />
          </div>

          {error && (
            <p className="text-[12.5px] text-[#f04438]">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 flex h-[38px] w-full items-center justify-center rounded-[6px] bg-[#38c08f] text-[14px] font-medium text-white hover:bg-[#2da87a] transition-colors disabled:opacity-60"
          >
            {loading ? "登录中..." : "登录"}
          </button>
        </form>

        <p className="mt-5 text-center text-[12px] text-[#9ca3af]">
          管理员账号: admin@comic-admin.com
        </p>
      </div>
    </div>
  )
}
