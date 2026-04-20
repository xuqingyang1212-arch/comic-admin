"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff } from "lucide-react"
import { authApi } from "@/lib/api"

const PASSWORD_RE = /^[A-Za-z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?~`]{6,24}$/

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [password, setPassword] = useState("")
  const [showPwd, setShowPwd] = useState(false)
  const [verified, setVerified] = useState(false)
  const [codeSent, setCodeSent] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  const handleSendCode = useCallback(() => {
    const trimmed = email.trim()
    if (!trimmed) { setError("请先输入邮箱"); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { setError("邮箱格式不正确"); return }
    setError("")
    setCodeSent(true)
    setCountdown(60)
  }, [email])

  const [verifying, setVerifying] = useState(false)

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    const trimmed = email.trim()
    if (!trimmed) { setError("请输入邮箱"); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { setError("邮箱格式不正确"); return }
    if (!codeSent) { setError("请先发送验证码"); return }
    if (!code) { setError("请输入验证码"); return }
    if (code !== "000000") { setError("验证码错误"); return }

    setVerifying(true)
    try {
      await authApi.checkEmail(trimmed)
      setVerified(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "验证失败")
    } finally {
      setVerifying(false)
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!password) { setError("请输入新密码"); return }
    if (!PASSWORD_RE.test(password)) { setError("密码需 6~24 位，可由数字、字母、常规符号任意组合，区分大小写"); return }

    setLoading(true)
    try {
      await authApi.resetPassword({ email: email.trim(), code, password })
      setSuccess("密码重置成功，即将跳转登录页面...")
      setTimeout(() => router.push("/login"), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "重置失败")
      setLoading(false)
    }
  }

  const inputCls = "h-[38px] w-full rounded-[6px] border border-[#d1d5db] bg-white px-3 text-[13px] text-[#374151] placeholder-[#9ca3af] outline-none focus:border-[#38c08f] transition-colors"

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f7f9]">
      <div className="w-full max-w-[400px] rounded-xl border border-[#e5e7eb] bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-[22px] font-semibold text-[#111827]">忘记密码</h1>
          <p className="mt-1.5 text-[13px] text-[#6b7280]">
            {verified ? "请设置新密码" : "验证邮箱后重置密码"}
          </p>
        </div>

        {!verified ? (
          <form onSubmit={handleVerify} className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">邮箱</label>
              <input
                type="email"
                placeholder="请输入注册邮箱"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">验证码</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="请输入邮箱验证码"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className={inputCls}
                />
                <button
                  type="button"
                  disabled={countdown > 0}
                  onClick={handleSendCode}
                  className="shrink-0 h-[38px] w-[96px] rounded-[6px] border border-[#38c08f] text-[13px] font-medium text-[#38c08f] hover:bg-[#f0fdf4] transition-colors disabled:border-[#d1d5db] disabled:text-[#9ca3af] disabled:hover:bg-white"
                >
                  {countdown > 0 ? `${countdown}s` : codeSent ? "重新发送" : "发送验证码"}
                </button>
              </div>
            </div>

            {error && <p className="text-[12.5px] text-[#f04438]">{error}</p>}

            <button
              type="submit"
              disabled={verifying}
              className="mt-1 flex h-[38px] w-full items-center justify-center rounded-[6px] bg-[#38c08f] text-[14px] font-medium text-white hover:bg-[#2da87a] transition-colors disabled:opacity-60"
            >
              {verifying ? "验证中..." : "验证"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleReset} className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">邮箱</label>
              <input
                type="email"
                disabled
                value={email}
                className={`${inputCls} bg-[#f9fafb] text-[#9ca3af]`}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">新密码</label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  placeholder="6~24位，数字、字母、符号任意组合"
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

            {error && <p className="text-[12.5px] text-[#f04438]">{error}</p>}
            {success && <p className="text-[12.5px] text-[#059669]">{success}</p>}

            <button
              type="submit"
              disabled={loading || !!success}
              className="mt-1 flex h-[38px] w-full items-center justify-center rounded-[6px] bg-[#38c08f] text-[14px] font-medium text-white hover:bg-[#2da87a] transition-colors disabled:opacity-60"
            >
              {loading ? "重置中..." : "重置密码"}
            </button>
          </form>
        )}

        <p className="mt-5 text-center text-[13px] text-[#6b7280]">
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="font-medium text-[#38c08f] hover:text-[#2da87a] transition-colors"
          >
            返回登录
          </button>
        </p>
      </div>
    </div>
  )
}
