"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff } from "lucide-react"
import { authApi, setToken } from "@/lib/api"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    const trimmedEmail = email.trim()
    if (!trimmedEmail) { setError("请输入邮箱"); return }
    if (!password) { setError("请输入密码"); return }
    setLoading(true)
    setError("")
    try {
      const data = await authApi.login(trimmedEmail, password)
      setToken(data.token)
      window.location.replace("/")
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败")
      setLoading(false)
    }
  }

  const inputCls = "h-[38px] w-full rounded-[6px] border border-[#d1d5db] bg-white px-3 text-[13px] text-[#374151] placeholder-[#9ca3af] outline-none focus:border-[#38c08f] transition-colors"

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
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">密码</label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${inputCls} pr-9`}
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#6b7280] transition-colors"
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="flex justify-end -mt-1">
            <button
              type="button"
              onClick={() => router.push("/forgot-password")}
              className="text-[12.5px] text-[#6b7280] hover:text-[#38c08f] transition-colors"
            >
              忘记密码？
            </button>
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

        <p className="mt-5 text-center text-[13px] text-[#6b7280]">
          还没有账号？
          <button
            type="button"
            onClick={() => router.push("/register")}
            className="ml-1 font-medium text-[#38c08f] hover:text-[#2da87a] transition-colors"
          >
            立即注册
          </button>
        </p>
      </div>
    </div>
  )
}
