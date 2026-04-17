"use client"

import type { ReactNode } from "react"

export interface RightDrawerProps {
  width: number | string
  zIndex?: number
  overlayOpacity?: number
  onClose: () => void
  children: ReactNode
}

export function RightDrawer({
  width,
  zIndex = 50,
  overlayOpacity = 0.35,
  onClose,
  children,
}: RightDrawerProps) {
  const w = typeof width === "number" ? `${width}px` : width
  return (
    <>
      <div
        className="fixed inset-0"
        style={{ zIndex: zIndex - 1, backgroundColor: `rgba(0,0,0,${overlayOpacity})` }}
        onClick={onClose}
      />
      <div
        className="fixed right-0 top-0 flex h-full flex-col bg-white"
        style={{ zIndex, width: w, boxShadow: "-4px 0 24px rgba(0,0,0,0.12)" }}
      >
        {children}
      </div>
    </>
  )
}
