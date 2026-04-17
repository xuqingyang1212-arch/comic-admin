"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { ART_STYLES, VISUAL_EFFECTS, ASPECT_RATIOS } from "@/lib/constants"
import { scriptApi } from "@/lib/api"
import { toast } from "@/lib/toast"
import { RightDrawer } from "./right-drawer"

// ─── RadioGroup (internal) ──────────────────────────────────────────────────

function RadioGroup({
  label, options, value, onChange, required, error,
}: {
  label: string; options: string[]; value: string
  onChange: (v: string) => void; required?: boolean; error?: boolean
}) {
  return (
    <div>
      <p className="mb-2 text-[13px] font-medium text-[#374151]">
        {label}{required && <span className="ml-0.5 text-[#f04438]">*</span>}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = value === opt
          return (
            <button key={opt} type="button" onClick={() => onChange(opt)}
              className={cn(
                "h-[30px] rounded-[4px] border px-3.5 text-[12.5px] transition-colors",
                active
                  ? "border-[#38c08f] bg-[#f0fdf4] font-medium text-[#38c08f]"
                  : error
                    ? "border-[#fca5a5] bg-white text-[#374151] hover:border-[#38c08f]"
                    : "border-[#d1d5db] bg-white text-[#374151] hover:border-[#38c08f] hover:text-[#38c08f]",
              )}
            >{opt}</button>
          )
        })}
      </div>
      {error && <p className="mt-1 text-[11.5px] text-[#f04438]">请选择{label}</p>}
    </div>
  )
}

// ─── PublishTaskDrawer ──────────────────────────────────────────────────────

export interface PublishTaskDrawerProps {
  scriptId: number
  scriptName: string
  displayScriptId: string
  episodeCount: number
  paidEpisodeLabel: string
  zIndex?: number
  onClose: () => void
  onSuccess?: () => void
}

export function PublishTaskDrawer({
  scriptId,
  scriptName,
  displayScriptId,
  episodeCount,
  paidEpisodeLabel,
  zIndex = 100,
  onClose,
  onSuccess,
}: PublishTaskDrawerProps) {
  const [artStyle, setArtStyle] = useState("")
  const [visualEffect, setVisualEffect] = useState("")
  const [aspectRatio, setAspectRatio] = useState("")
  const [remark, setRemark] = useState("")
  const [errors, setErrors] = useState({ artStyle: false, visualEffect: false, aspectRatio: false })
  const [submitting, setSubmitting] = useState(false)

  async function handleConfirm() {
    const e = { artStyle: !artStyle, visualEffect: !visualEffect, aspectRatio: !aspectRatio }
    if (e.artStyle || e.visualEffect || e.aspectRatio) { setErrors(e); return }
    setSubmitting(true)
    try {
      await scriptApi.publishTask(scriptId, {
        artStyle,
        visualEffect,
        aspectRatio,
        productionRemark: remark.trim(),
      })
      onClose()
      onSuccess?.()
      toast.success(`已发布制作任务：${artStyle} / ${visualEffect} / ${aspectRatio}`)
    } catch (err) {
      toast.errorFrom(err, "发布失败")
    } finally {
      setSubmitting(false)
    }
  }

  const infoFields = [
    { label: "剧本名称", value: scriptName, mono: false },
    { label: "剧本ID", value: displayScriptId, mono: true },
    { label: "集数", value: `${episodeCount} 集`, mono: false },
    { label: "付费卡点", value: paidEpisodeLabel, mono: false },
  ]

  return (
    <RightDrawer width={640} zIndex={zIndex + 1} overlayOpacity={0.35} onClose={onClose}>
        <div className="flex items-center justify-between border-b border-[#e5e7eb] px-6 py-4">
          <span className="text-[15px] font-semibold text-[#111827]">发布制作任务</span>
          <button onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-[4px] text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#374151] transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="mb-5 rounded-[8px] border border-[#e5e7eb] bg-[#f9fafb] px-4 py-4">
            <p className="mb-3 text-[11.5px] font-semibold uppercase tracking-wide text-[#9ca3af]">剧本信息</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {infoFields.map(({ label, value, mono }) => (
                <div key={label}>
                  <p className="text-[11.5px] text-[#9ca3af]">{label}</p>
                  <p className={cn("mt-0.5 break-all text-[12.5px]", mono ? "font-mono text-[#4b5563]" : "text-[#111827]")}>
                    {label === "付费卡点" && value !== "--" ? (
                      <span className="inline-flex items-center rounded-[4px] border border-[#fde68a] bg-[#fef9ee] px-2 py-0.5 text-[11.5px] text-[#b45309]">
                        {value}
                      </span>
                    ) : value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[8px] border border-[#e5e7eb] bg-white px-4 py-4">
            <p className="mb-4 text-[11.5px] font-semibold uppercase tracking-wide text-[#9ca3af]">制作类型配置</p>
            <div className="flex flex-col gap-5">
              <RadioGroup label="画风类型" options={[...ART_STYLES]} value={artStyle}
                onChange={(v) => { setArtStyle(v); setErrors((p) => ({ ...p, artStyle: false })) }}
                required error={errors.artStyle} />
              <div className="h-px bg-[#f3f4f6]" />
              <RadioGroup label="视觉效果" options={[...VISUAL_EFFECTS]} value={visualEffect}
                onChange={(v) => { setVisualEffect(v); setErrors((p) => ({ ...p, visualEffect: false })) }}
                required error={errors.visualEffect} />
              <div className="h-px bg-[#f3f4f6]" />
              <RadioGroup label="画面比例" options={[...ASPECT_RATIOS]} value={aspectRatio}
                onChange={(v) => { setAspectRatio(v); setErrors((p) => ({ ...p, aspectRatio: false })) }}
                required error={errors.aspectRatio} />
              <div className="h-px bg-[#f3f4f6]" />
              <div>
                <p className="mb-2 text-[13px] font-medium text-[#374151]">制作备注</p>
                <textarea
                  rows={3}
                  placeholder="请输入制作备注（选填）"
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  className="w-full resize-none rounded-[6px] border border-[#d1d5db] px-3 py-2 text-[13px] text-[#374151] outline-none focus:border-[#38c08f] transition-colors"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[#e5e7eb] px-6 py-4">
          <span className="text-[12.5px] text-[#9ca3af]">请确认配置后再发布</span>
          <div className="flex items-center gap-2.5">
            <button onClick={onClose}
              className="rounded-[6px] border border-[#d1d5db] bg-white px-5 py-1.5 text-[13px] text-[#374151] hover:bg-[#f9fafb] transition-colors">
              取消
            </button>
            <button type="button" disabled={submitting}
              onClick={() => void handleConfirm()}
              className="rounded-[6px] bg-[#38c08f] px-5 py-1.5 text-[13px] font-medium text-white hover:bg-[#2da87a] transition-colors disabled:opacity-60">
              确认发布
            </button>
          </div>
        </div>
    </RightDrawer>
  )
}
