"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Eye, EyeOff, ShieldCheck, CheckCircle2 } from "lucide-react"
import { authApi } from "@/lib/api"

const PASSWORD_RE = /^[A-Za-z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?~`]{6,24}$/

export default function RegisterPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteCode = searchParams.get("invite") || ""

  const [form, setForm] = useState({ email: "", code: "", password: "", name: "" })
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [codeSent, setCodeSent] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [registerSuccess, setRegisterSuccess] = useState(false)

  const [inviteRoleId, setInviteRoleId] = useState<number>(0)
  const [inviteRoleName, setInviteRoleName] = useState("")
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState("")

  useEffect(() => {
    if (!inviteCode) return
    setInviteLoading(true)
    authApi.inviteInfo(inviteCode)
      .then((res) => {
        setInviteRoleId(res.roleId)
        setInviteRoleName(res.roleName)
      })
      .catch(() => setInviteError("邀请链接无效或已过期"))
      .finally(() => setInviteLoading(false))
  }, [inviteCode])

  function set<K extends keyof typeof form>(key: K, val: string) {
    setForm((p) => ({ ...p, [key]: val }))
    setErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  const handleSendCode = useCallback(() => {
    const email = form.email.trim()
    if (!email) { setErrors((p) => ({ ...p, email: "请先输入邮箱" })); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErrors((p) => ({ ...p, email: "邮箱格式不正确" })); return }
    setErrors((p) => { const n = { ...p }; delete n.email; return n })
    setCodeSent(true)
    setCountdown(60)
  }, [form.email])

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()

    const email = form.email.trim()
    const name = form.name.trim()
    const { code, password } = form

    const errs: Record<string, string> = {}
    if (!email) errs.email = "请输入邮箱"
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "邮箱格式不正确"
    if (!codeSent) errs.code = "请先发送验证码"
    else if (!code) errs.code = "请输入验证码"
    if (!password) errs.password = "请输入密码"
    else if (!PASSWORD_RE.test(password)) errs.password = "密码需 6~24 位，数字、字母、符号任意组合，区分大小写"
    if (!name) errs.name = "请输入用户名"

    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})

    setLoading(true)
    try {
      const body: { email: string; code: string; password: string; name: string; roleId?: number } = { email, code, password, name }
      if (inviteRoleId > 0) body.roleId = inviteRoleId
      await authApi.register(body)
      setRegisterSuccess(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "注册失败"
      const fieldMap: [RegExp, string][] = [
        [/邮箱/, "email"],
        [/验证码/, "code"],
        [/密码/, "password"],
        [/用户名/, "name"],
      ]
      const matched = fieldMap.find(([re]) => re.test(msg))
      setErrors(matched ? { [matched[1]]: msg } : { _form: msg })
      setLoading(false)
    }
  }

  const fieldErrCls = "mt-1 text-[12px] text-[#f04438]"

  const inputCls = "h-[38px] w-full rounded-[6px] border border-[#d1d5db] bg-white px-3 text-[13px] text-[#374151] placeholder-[#9ca3af] outline-none focus:border-[#38c08f] transition-colors"

  if (registerSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f7f9]">
        <div className="w-full max-w-[400px] rounded-xl border border-[#e5e7eb] bg-white p-8 shadow-sm text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#ecfdf5]">
            <CheckCircle2 size={28} className="text-[#38c08f]" />
          </div>
          <h1 className="text-[20px] font-semibold text-[#111827]">提交成功</h1>
          <p className="mt-2 text-[13px] text-[#6b7280] leading-relaxed">
            您的账号已提交审核，请等待管理员审核通过后再登录。
          </p>
          <button
            onClick={() => router.push("/login")}
            className="mt-6 flex h-[38px] w-full items-center justify-center rounded-[6px] bg-[#38c08f] text-[14px] font-medium text-white hover:bg-[#2da87a] transition-colors"
          >
            返回登录
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f7f9]">
      <div className="w-full max-w-[400px] rounded-xl border border-[#e5e7eb] bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-[22px] font-semibold text-[#111827]">注册账号</h1>
          <p className="mt-1.5 text-[13px] text-[#6b7280]">
            {inviteCode && inviteRoleName
              ? `通过邀请注册为「${inviteRoleName}」`
              : "创建账号以使用漫剧运营后台"}
          </p>
        </div>

        <form onSubmit={handleRegister} className="flex flex-col gap-4">
          {inviteCode && (
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">注册角色</label>
              {inviteLoading ? (
                <div className="flex h-[38px] items-center px-3 text-[13px] text-[#9ca3af]">加载中...</div>
              ) : inviteError ? (
                <div className="flex h-[38px] items-center px-3 text-[13px] text-[#f04438]">{inviteError}</div>
              ) : (
                <div className="flex h-[38px] items-center gap-2 rounded-[6px] border border-[#e5e7eb] bg-[#f9fafb] px-3">
                  <ShieldCheck size={14} className="text-[#38c08f]" />
                  <span className="text-[13px] font-medium text-[#374151]">{inviteRoleName}</span>
                </div>
              )}
            </div>
          )}

          {/* 邮箱 */}
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">邮箱</label>
            <input
              type="email"
              placeholder="请输入邮箱地址"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              className={`${inputCls} ${errors.email ? "border-[#f04438]" : ""}`}
            />
            {errors.email && <p className={fieldErrCls}>{errors.email}</p>}
          </div>

          {/* 验证码 */}
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">验证码</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="请输入邮箱验证码"
                maxLength={6}
                value={form.code}
                onChange={(e) => set("code", e.target.value.replace(/\D/g, ""))}
                className={`${inputCls} ${errors.code ? "border-[#f04438]" : ""}`}
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
            {errors.code && <p className={fieldErrCls}>{errors.code}</p>}
          </div>

          {/* 密码 */}
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">密码</label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                placeholder="6~24位，数字、字母、符号任意组合"
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                className={`${inputCls} pr-9 ${errors.password ? "border-[#f04438]" : ""}`}
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#6b7280] transition-colors"
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && <p className={fieldErrCls}>{errors.password}</p>}
          </div>

          {/* 用户名 */}
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">用户名</label>
            <input
              type="text"
              placeholder="请输入用户名"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className={`${inputCls} ${errors.name ? "border-[#f04438]" : ""}`}
            />
            {errors.name && <p className={fieldErrCls}>{errors.name}</p>}
          </div>

          {errors._form && (
            <p className="text-[12.5px] text-[#f04438]">{errors._form}</p>
          )}

          <button
            type="submit"
            disabled={loading || (!!inviteCode && !inviteRoleName)}
            className="mt-1 flex h-[38px] w-full items-center justify-center rounded-[6px] bg-[#38c08f] text-[14px] font-medium text-white hover:bg-[#2da87a] transition-colors disabled:opacity-60"
          >
            {loading ? "注册中..." : "注册"}
          </button>
        </form>

        <p className="mt-5 text-center text-[13px] text-[#6b7280]">
          已有账号？
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="ml-1 font-medium text-[#38c08f] hover:text-[#2da87a] transition-colors"
          >
            返回登录
          </button>
        </p>
      </div>
    </div>
  )
}
