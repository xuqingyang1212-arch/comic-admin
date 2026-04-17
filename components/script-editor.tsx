"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { X, Plus, Bold, Underline, Strikethrough, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "@/lib/toast"
import {
  type EditorNode,
  type BookDetail,
  type ScriptDraftPersistBody,
  newId,
  calcSegmentWords,
  calcTotalWords,
  calcEpisodeIndex,
  buildInitialNodes,
  TRIAL_PARAGRAPH_INDEX,
} from "@/lib/script-editor"

// Re-export for convenience (dependents can import UI + types from one place)
export { type EditorNode, type BookDetail, type ScriptDraftPersistBody } from "@/lib/script-editor"

const FONT_SIZES = ["12", "14", "16", "18", "20"] as const
const PRESET_COLORS = [
  "#111827", "#374151", "#6b7280", "#9ca3af",
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#3b82f6", "#8b5cf6", "#ec4899", "#ffffff",
]

// ─── OrangeDividerNode ──────────────────────────────────────────────────────

export function OrangeDividerNode({
  node, nodes, onDelete,
}: {
  node: Extract<EditorNode, { type: "orange-divider" }>
  nodes: EditorNode[]
  onDelete: (id: string) => void
}) {
  const [hovered, setHovered] = useState(false)
  const idx = nodes.findIndex((n) => n.id === node.id)
  const episodeNum = calcEpisodeIndex(nodes, node.id)
  const wordCount = calcSegmentWords(nodes, idx)
  return (
    <div
      className="my-1 flex select-none items-center gap-2 py-0.5"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="h-px flex-1 bg-[#f97316]" />
      <div className="flex items-center gap-0 rounded-[4px] border border-[#f97316] bg-[#fff7ed] px-3 py-1">
        <span className="text-[12px] font-medium text-[#ea580c]">
          第{episodeNum}集，总计{wordCount}字
        </span>
        {node.deletable && (
          <span
            className={cn(
              "overflow-hidden transition-all duration-150",
              hovered ? "ml-1.5 max-w-[20px] opacity-100" : "ml-0 max-w-0 opacity-0"
            )}
          >
            <button
              onMouseDown={(e) => { e.preventDefault(); onDelete(node.id) }}
              className="flex h-4 w-4 items-center justify-center rounded text-[#ea580c] hover:bg-[#fed7aa]"
              title="删除此分集线"
            >
              <X size={11} />
            </button>
          </span>
        )}
      </div>
      <div className="h-px flex-1 bg-[#f97316]" />
    </div>
  )
}

// ─── InsertDividerBtn ───────────────────────────────────────────────────────

export function InsertDividerBtn({ onInsert, disabled }: { onInsert: () => void; disabled?: boolean }) {
  if (disabled) return <div className="h-2" />
  return (
    <div className="group relative my-0 flex h-5 items-center justify-center">
      <div className="absolute inset-x-0 top-1/2 h-px bg-transparent transition-colors group-hover:bg-[#f3f4f6]" />
      <button
        onMouseDown={(e) => { e.preventDefault(); onInsert() }}
        className="relative z-10 hidden items-center gap-1 rounded-[3px] border border-[#fed7aa] bg-[#fff7ed] px-2 py-0.5 text-[11px] text-[#ea580c] opacity-0 transition-all group-hover:flex group-hover:opacity-100 hover:bg-[#ffedd5]">
        <Plus size={10} />新增分集线
      </button>
    </div>
  )
}

// ─── ParagraphEditor ────────────────────────────────────────────────────────

export function ParagraphEditor({
  node,
  onChange,
}: {
  node: Extract<EditorNode, { type: "paragraph" }>
  onChange: (id: string, html: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const isComposing = useRef(false)
  const lastHtml = useRef(node.html)

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== node.html) {
      ref.current.innerHTML = node.html
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const syncHtml = useCallback(() => {
    if (!ref.current) return
    const html = ref.current.innerHTML
    if (html !== lastHtml.current) {
      lastHtml.current = html
      onChange(node.id, html)
    }
  }, [node.id, onChange])

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      data-node-id={node.id}
      onCompositionStart={() => { isComposing.current = true }}
      onCompositionEnd={() => {
        isComposing.current = false
        syncHtml()
      }}
      onInput={() => {
        if (!isComposing.current) syncHtml()
      }}
      onBlur={syncHtml}
      className="min-h-[1.6em] rounded-[2px] py-0.5 text-[13.5px] leading-relaxed text-[#374151] outline-none focus:bg-[#f8fffe] focus:ring-1 focus:ring-[#38c08f]/30"
      style={{ whiteSpace: "pre-wrap" }}
    />
  )
}

// ─── FloatingToolbar ────────────────────────────────────────────────────────

interface FloatingToolbarPos { top: number; left: number; above: boolean }
type PanelKey = "fontSize" | "fontColor" | "bgColor" | null

export function FloatingToolbar({ containerRef }: { containerRef: React.RefObject<HTMLDivElement | null> }) {
  const [pos, setPos] = useState<FloatingToolbarPos | null>(null)
  const [openPanel, setOpenPanel] = useState<PanelKey>(null)
  const [activeFontSize, setActiveFontSize] = useState("14")
  const toolbarRef = useRef<HTMLDivElement>(null)
  const savedRange = useRef<Range | null>(null)

  function saveSelection() {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      savedRange.current = sel.getRangeAt(0).cloneRange()
    }
  }

  function restoreSelection() {
    if (!savedRange.current) return
    const sel = window.getSelection()
    if (sel) { sel.removeAllRanges(); sel.addRange(savedRange.current) }
  }

  function execCmd(cmd: string, value?: string) {
    restoreSelection()
    document.execCommand(cmd, false, value ?? undefined)
    savedRange.current = null
  }

  function togglePanel(key: PanelKey) {
    saveSelection()
    setOpenPanel(prev => prev === key ? null : key)
  }

  useEffect(() => {
    function onSelectionChange() {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setPos(null)
        setOpenPanel(null)
        return
      }
      const range = sel.getRangeAt(0)
      if (!containerRef.current?.contains(range.commonAncestorContainer)) {
        setPos(null)
        setOpenPanel(null)
        return
      }
      saveSelection()
      setOpenPanel(null)

      const rect = range.getBoundingClientRect()
      if (!rect || (rect.width === 0 && rect.height === 0)) return

      const TOOLBAR_W = 340
      const TOOLBAR_H = 36
      const PANEL_H = 120
      const GAP = 8
      const VP_W = window.innerWidth
      const VP_H = window.innerHeight

      let left = rect.left + rect.width / 2 - TOOLBAR_W / 2
      if (left < 6) left = 6
      if (left + TOOLBAR_W > VP_W - 6) left = VP_W - TOOLBAR_W - 6

      const topAbove = rect.top - TOOLBAR_H - GAP
      const topBelow = rect.bottom + GAP
      const above = topAbove >= PANEL_H + 6
      const top = above ? topAbove : topBelow

      const finalTop = Math.min(top, VP_H - TOOLBAR_H - 6)

      setPos({ top: Math.max(finalTop, 6), left, above })
    }

    document.addEventListener("selectionchange", onSelectionChange)
    return () => document.removeEventListener("selectionchange", onSelectionChange)
  }, [containerRef])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (toolbarRef.current?.contains(e.target as Node)) return
      if (containerRef.current?.contains(e.target as Node)) return
      setPos(null)
      setOpenPanel(null)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [containerRef])

  if (!pos) return null

  const panelClass = pos.above
    ? "absolute bottom-full mb-1 z-[200]"
    : "absolute top-full mt-1 z-[200]"

  return (
    <>
      <div
        ref={toolbarRef}
        className="fixed z-[150] flex items-center gap-0.5 rounded-[6px] border border-[#e5e7eb] bg-white px-2 py-1 shadow-xl"
        style={{ top: pos.top, left: pos.left, pointerEvents: "auto" }}
        onMouseDown={(e) => e.preventDefault()}
      >
        {/* 字号 */}
        <div className="relative">
          <button
            onMouseDown={(e) => { e.preventDefault(); togglePanel("fontSize") }}
            className={cn("flex h-6 items-center gap-0.5 rounded-[3px] px-1.5 text-[12px] transition-colors hover:bg-[#f3f4f6]",
              openPanel === "fontSize" ? "bg-[#f3f4f6] text-[#38c08f]" : "text-[#374151]")}
          >
            {activeFontSize}px
            <ChevronDown size={9} className="text-[#9ca3af]" />
          </button>
          {openPanel === "fontSize" && (
            <div className={cn(panelClass, "left-0 rounded-[6px] border border-[#e5e7eb] bg-white py-1 shadow-lg min-w-[76px]")}>
              {FONT_SIZES.map((s) => (
                <button key={s}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    setActiveFontSize(s)
                    restoreSelection()
                    const sizeVal = s === "12" ? "1" : s === "14" ? "2" : s === "16" ? "3" : s === "18" ? "4" : "5"
                    document.execCommand("fontSize", false, sizeVal)
                    setOpenPanel(null)
                    savedRange.current = null
                  }}
                  className={cn("flex w-full px-3 py-1.5 text-[12px] hover:bg-[#f0fdf4]",
                    activeFontSize === s ? "text-[#38c08f] font-semibold" : "text-[#374151]")}>
                  {s}px
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-[#e5e7eb] mx-0.5" />

        <button onMouseDown={(e) => { e.preventDefault(); execCmd("bold") }}
          className="flex h-6 w-6 items-center justify-center rounded-[3px] hover:bg-[#f3f4f6] transition-colors" title="加粗">
          <Bold size={13} className="text-[#374151]" />
        </button>

        <button onMouseDown={(e) => { e.preventDefault(); execCmd("underline") }}
          className="flex h-6 w-6 items-center justify-center rounded-[3px] hover:bg-[#f3f4f6] transition-colors" title="下划线">
          <Underline size={13} className="text-[#374151]" />
        </button>

        <button onMouseDown={(e) => { e.preventDefault(); execCmd("strikeThrough") }}
          className="flex h-6 w-6 items-center justify-center rounded-[3px] hover:bg-[#f3f4f6] transition-colors" title="删除线">
          <Strikethrough size={13} className="text-[#374151]" />
        </button>

        <div className="h-4 w-px bg-[#e5e7eb] mx-0.5" />

        <div className="relative">
          <button
            onMouseDown={(e) => { e.preventDefault(); togglePanel("fontColor") }}
            className={cn("flex h-6 w-6 flex-col items-center justify-center gap-[1px] rounded-[3px] transition-colors hover:bg-[#f3f4f6]",
              openPanel === "fontColor" && "bg-[#f3f4f6]")}
            title="字体颜色"
          >
            <span className="text-[11px] font-bold leading-none text-[#374151]">A</span>
            <span className="h-[2.5px] w-3.5 rounded-full bg-[#ef4444]" />
          </button>
        </div>

        <div className="relative">
          <button
            onMouseDown={(e) => { e.preventDefault(); togglePanel("bgColor") }}
            className={cn("flex h-6 w-6 flex-col items-center justify-center gap-[1px] rounded-[3px] transition-colors hover:bg-[#f3f4f6]",
              openPanel === "bgColor" && "bg-[#f3f4f6]")}
            title="背景颜色"
          >
            <span className="text-[11px] font-bold leading-none text-[#374151]">A</span>
            <span className="h-[2.5px] w-3.5 rounded-full bg-[#fde047]" />
          </button>
        </div>
      </div>

      {openPanel === "fontColor" && (
        <div
          className="fixed z-[200] rounded-[6px] border border-[#e5e7eb] bg-white p-2 shadow-xl"
          style={{
            top: pos.above ? pos.top - 10 - 120 : pos.top + 44,
            left: Math.min(pos.left + 188, window.innerWidth - 130),
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <p className="mb-1 text-[10px] font-medium text-[#9ca3af]">字体颜色</p>
          <div className="grid grid-cols-6 gap-1">
            {PRESET_COLORS.map((c) => (
              <button key={c}
                onMouseDown={(e) => {
                  e.preventDefault()
                  restoreSelection()
                  document.execCommand("foreColor", false, c)
                  setOpenPanel(null)
                  savedRange.current = null
                }}
                className="h-5 w-5 rounded-[3px] border border-[#e5e7eb] transition-transform hover:scale-110"
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
      )}

      {openPanel === "bgColor" && (
        <div
          className="fixed z-[200] rounded-[6px] border border-[#e5e7eb] bg-white p-2 shadow-xl"
          style={{
            top: pos.above ? pos.top - 10 - 120 : pos.top + 44,
            left: Math.min(pos.left + 216, window.innerWidth - 130),
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <p className="mb-1 text-[10px] font-medium text-[#9ca3af]">背景颜色</p>
          <div className="grid grid-cols-6 gap-1">
            {PRESET_COLORS.map((c) => (
              <button key={c}
                onMouseDown={(e) => {
                  e.preventDefault()
                  restoreSelection()
                  document.execCommand("hiliteColor", false, c)
                  setOpenPanel(null)
                  savedRange.current = null
                }}
                className="h-5 w-5 rounded-[3px] border border-[#e5e7eb] transition-transform hover:scale-110"
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
      )}
    </>
  )
}

// ─── ScriptEditorDrawer ─────────────────────────────────────────────────────

export function ScriptEditorDrawer({
  bookName: initialBookName,
  detail,
  onClose,
  persistBookId,
  persistScriptType,
  persistOriginalScriptId,
  onPersistSave,
  onPersistSubmit,
}: {
  bookName: string
  detail: BookDetail
  onClose: () => void
  persistBookId?: number
  persistScriptType?: string
  persistOriginalScriptId?: number | null
  onPersistSave?: (body: ScriptDraftPersistBody) => Promise<void>
  onPersistSubmit?: () => Promise<void>
}) {
  const [scriptName, setScriptName] = useState(initialBookName)
  const [nodes, setNodes] = useState<EditorNode[]>(() =>
    buildInitialNodes(detail.contentParagraphs, TRIAL_PARAGRAPH_INDEX, detail.breakpointLabel, detail.dividerPositions)
  )
  const [submitted, setSubmitted] = useState(false)
  const [saved, setSaved] = useState(false)
  const editorContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: KeyboardEvent) { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [onClose])

  const updateParagraphHtml = useCallback((id: string, html: string) => {
    setNodes((prev) => prev.map((n) => n.type === "paragraph" && n.id === id ? { ...n, html } : n))
  }, [])

  function insertOrangeDividerAfterIdx(afterIdx: number) {
    setNodes((prev) => {
      if (prev[afterIdx + 1]?.type === "orange-divider") return prev
      const next = [...prev]
      next.splice(afterIdx + 1, 0, { type: "orange-divider", id: newId(), deletable: true })
      return next
    })
  }

  function deleteOrangeDivider(id: string) {
    setNodes((prev) => prev.filter((n) => n.id !== id))
  }

  const totalWords = calcTotalWords(nodes)

  function buildPersistBody(): ScriptDraftPersistBody {
    const paragraphs = nodes.filter(
      (n): n is Extract<EditorNode, { type: "paragraph" }> => n.type === "paragraph"
    )
    const content = paragraphs.map((p) => p.html).join("\n")
    const episodeCount = Math.max(1, nodes.filter((n) => n.type === "orange-divider").length)

    const dividerAfterIndices: number[] = []
    let pIdx = 0
    for (const n of nodes) {
      if (n.type === "paragraph") pIdx++
      else if (n.type === "orange-divider") dividerAfterIndices.push(pIdx - 1)
    }

    return {
      scriptName,
      content,
      bookId: persistBookId!,
      scriptType: persistScriptType!,
      originalScriptId: persistOriginalScriptId ?? undefined,
      episodeCount,
      payEpisode: "",
      payBreakpointData: JSON.stringify(dividerAfterIndices),
    }
  }

  async function handleSaveClick() {
    if (onPersistSave && persistBookId != null && persistScriptType) {
      try {
        await onPersistSave(buildPersistBody())
        toast.success("保存成功")
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } catch (e) {
        toast.errorFrom(e, "保存失败")
      }
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  async function handleSubmitClick() {
    if (onPersistSubmit && onPersistSave && persistBookId != null && persistScriptType) {
      try {
        await onPersistSave(buildPersistBody())
        await onPersistSubmit()
        toast.success("提交成功")
        setSubmitted(true)
        setTimeout(() => {
          setSubmitted(false)
          onClose()
        }, 1200)
      } catch (e) {
        toast.errorFrom(e, "提交失败")
      }
    } else if (onPersistSubmit) {
      try {
        await onPersistSubmit()
        toast.success("提交成功")
        setSubmitted(true)
        setTimeout(() => {
          setSubmitted(false)
          onClose()
        }, 1200)
      } catch (e) {
        toast.errorFrom(e, "提交失败")
      }
    } else {
      setSubmitted(true)
      setTimeout(() => {
        setSubmitted(false)
        onClose()
      }, 1200)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40" style={{ zIndex: 60 }} onClick={onClose} />
      <div className="fixed right-0 top-0 flex h-full w-[1040px] flex-col bg-white"
        style={{ zIndex: 61, boxShadow: "-4px 0 32px rgba(0,0,0,0.15)" }}>

        <div className="flex items-center justify-between border-b border-[#e5e7eb] px-6 py-4">
          <h2 className="text-[15px] font-semibold text-[#111827]">创作剧本</h2>
          <button onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-[4px] text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#374151] transition-colors"
            aria-label="关闭">
            <X size={16} />
          </button>
        </div>

        <div className="border-b border-[#e5e7eb] px-6 py-3.5">
          <div className="flex items-center gap-3">
            <label className="whitespace-nowrap text-[13px] font-medium text-[#374151]">剧本名称</label>
            <input
              type="text"
              value={scriptName}
              onChange={(e) => setScriptName(e.target.value)}
              className="h-[30px] w-[320px] rounded-[6px] border border-[#d1d5db] bg-white px-3 text-[13px] text-[#111827] outline-none focus:border-[#38c08f] transition-colors"
            />
          </div>
        </div>

        <div className="relative flex-1 overflow-y-auto bg-[#f9fafb] px-8 py-5" ref={editorContainerRef}>
          <FloatingToolbar containerRef={editorContainerRef} />

          <div className="mx-auto max-w-[860px] rounded-[6px] border border-[#e5e7eb] bg-white px-8 py-6 min-h-full">
            {nodes.map((node, idx) => {
              const prevNodeIsOrange = idx > 0 && nodes[idx - 1].type === "orange-divider"
              const nextNodeIsOrange = nodes[idx + 1]?.type === "orange-divider"

              const blueDividerGroupHasOrange = (blueIdx: number): boolean => {
                const prevIsOrange = blueIdx > 0 && nodes[blueIdx - 1].type === "orange-divider"
                const nextIsOrange = nodes[blueIdx + 1]?.type === "orange-divider"
                return prevIsOrange || nextIsOrange
              }

              if (node.type === "paragraph") {
                return (
                  <div key={node.id}>
                    {idx > 0 && (
                      <InsertDividerBtn
                        onInsert={() => insertOrangeDividerAfterIdx(idx - 1)}
                        disabled={prevNodeIsOrange}
                      />
                    )}
                    <ParagraphEditor
                      node={node as Extract<EditorNode, { type: "paragraph" }>}
                      onChange={updateParagraphHtml}
                    />
                  </div>
                )
              }

              if (node.type === "blue-divider") {
                const groupHasOrange = blueDividerGroupHasOrange(idx)
                return (
                  <div key={node.id}>
                    <InsertDividerBtn
                      onInsert={() => insertOrangeDividerAfterIdx(idx - 1)}
                      disabled={groupHasOrange}
                    />
                    <div className="my-6 flex select-none items-center gap-3 cursor-not-allowed">
                      <div className="h-px flex-1 bg-[#3b82f6]" />
                      <span className="whitespace-nowrap rounded-[4px] border border-[#3b82f6] bg-[#eff6ff] px-3 py-1 text-[12px] font-medium text-[#2563eb]">
                        {node.label}
                      </span>
                      <div className="h-px flex-1 bg-[#3b82f6]" />
                    </div>
                    <InsertDividerBtn
                      onInsert={() => insertOrangeDividerAfterIdx(idx)}
                      disabled={groupHasOrange}
                    />
                  </div>
                )
              }

              if (node.type === "orange-divider") {
                return (
                  <div key={node.id}>
                    <OrangeDividerNode
                      node={node as Extract<EditorNode, { type: "orange-divider" }>}
                      nodes={nodes}
                      onDelete={deleteOrangeDivider}
                    />
                  </div>
                )
              }

              return null
            })}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[#e5e7eb] bg-white px-6 py-3.5">
          <span className="text-[13px] text-[#6b7280]">
            全文字数：<span className="font-medium text-[#111827]">{totalWords.toLocaleString()} 字</span>
            <span className="mx-2 text-[#d1d5db]">|</span>
            集数：<span className="font-medium text-[#111827]">{Math.max(1, nodes.filter((n) => n.type === "orange-divider").length)} 集</span>
          </span>
          <div className="flex items-center gap-2">
            {saved && <span className="text-[12.5px] text-[#6b7280]">已保存</span>}
            {submitted && <span className="text-[12.5px] text-[#38c08f]">已提交</span>}
            <button
              onClick={() => void handleSaveClick()}
              className="rounded-[6px] border border-[#d1d5db] bg-white px-5 py-1.5 text-[13px] font-medium text-[#374151] hover:border-[#38c08f] hover:text-[#38c08f] transition-colors">
              保存
            </button>
            <button
              onClick={() => void handleSubmitClick()}
              className="rounded-[6px] bg-[#38c08f] px-6 py-1.5 text-[13px] font-medium text-white hover:bg-[#2da87a] transition-colors">
              提交
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
