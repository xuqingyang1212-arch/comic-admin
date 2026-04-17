// Script editor types and utility functions
// Extracted from book-management.tsx for reuse across multiple components

export interface BookDetail {
  bookId: string
  bookName: string
  totalWordCount: number
  trialWordCount: number
  breakpointLabel: string
  contentParagraphs: string[]
  dividerPositions?: number[]
}

export type EditorNode =
  | { type: "paragraph"; id: string; html: string }
  | { type: "blue-divider"; id: string; label: string }
  | { type: "orange-divider"; id: string; deletable: boolean }

export type ScriptDraftPersistBody = {
  scriptName: string
  content: string
  bookId: number
  scriptType: string
  originalScriptId?: number | null
  episodeCount: number
  payEpisode?: string
  payBreakpointData?: string
}

export const sharedParagraphs: string[] = []

export const TRIAL_PARAGRAPH_INDEX = 28

let _idCounter = 0
export function newId() { return `n${++_idCounter}` }

export function calcSegmentWords(nodes: EditorNode[], upToIdx: number): number {
  let start = 0
  for (let i = upToIdx - 1; i >= 0; i--) {
    if (nodes[i].type === "orange-divider") { start = i + 1; break }
  }
  let count = 0
  for (let i = start; i < upToIdx; i++) {
    const n = nodes[i]
    if (n.type === "paragraph") {
      count += (n.html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ")).replace(/\s/g, "").length
    }
  }
  return count
}

export function calcTotalWords(nodes: EditorNode[]): number {
  return nodes.reduce((s, n) => {
    if (n.type !== "paragraph") return s
    return s + (n.html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ")).replace(/\s/g, "").length
  }, 0)
}

export function calcEpisodeIndex(nodes: EditorNode[], nodeId: string): number {
  let count = 0
  for (const n of nodes) {
    if (n.type === "orange-divider") { count++; if (n.id === nodeId) return count }
  }
  return count
}

export function buildInitialNodes(paragraphs: string[], trialIdx: number, trialLabel: string, dividerPositions?: number[]): EditorNode[] {
  const nodes: EditorNode[] = []
  const dividerSet = new Set(dividerPositions ?? [])
  paragraphs.forEach((text, i) => {
    nodes.push({ type: "paragraph", id: newId(), html: text })
    if (i === trialIdx - 1 && trialLabel) {
      nodes.push({ type: "blue-divider", id: newId(), label: trialLabel })
    }
    if (dividerSet.has(i)) {
      nodes.push({ type: "orange-divider", id: newId(), deletable: true })
    }
  })
  if (!dividerPositions || dividerPositions.length === 0) {
    nodes.push({ type: "orange-divider", id: newId(), deletable: false })
  }
  return nodes
}
