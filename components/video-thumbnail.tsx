"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { X, Play, Pause, Volume2, VolumeX, Maximize, Minimize } from "lucide-react"

export interface UploadFileState {
  file: File
  progress: number
  done: boolean
  /** COS / local URL after presigned upload completes */
  remoteUrl?: string
}

export interface RemoteFileState {
  remoteUrl: string
  fileName: string
  fileSize: number
}

const SPEED_OPTIONS: { value: number; label: string }[] = [
  { value: 0.5, label: "0.5x" },
  { value: 0.75, label: "0.75x" },
  { value: 1.0, label: "1.0x" },
  { value: 1.25, label: "1.25x" },
  { value: 1.5, label: "1.5x" },
  { value: 2.0, label: "2.0x" },
]

function fmtTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
}

// ─── Inline Video Player ─────────────────────────────────────────────────────

export function InlineVideoPlayer({ src, className, onEnded, autoPlay = false }: { src: string; className?: string; onEnded?: () => void; autoPlay?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [started, setStarted] = useState(autoPlay)
  const [playing, setPlaying] = useState(autoPlay)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [speed, setSpeed] = useState(1.0)
  const [showSpeed, setShowSpeed] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [dragging, setDragging] = useState(false)

  const playPromise = useRef<Promise<void> | null>(null)

  const safePlay = useCallback((v: HTMLVideoElement) => {
    const p = v.play()
    if (p) {
      playPromise.current = p
      p.then(() => { playPromise.current = null }).catch(() => { playPromise.current = null })
    }
  }, [])

  const safePause = useCallback((v: HTMLVideoElement) => {
    if (playPromise.current) {
      playPromise.current.then(() => v.pause()).catch(() => {})
      playPromise.current = null
    } else {
      v.pause()
    }
  }, [])

  const togglePlay = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) { safePlay(v); setPlaying(true); setStarted(true) } else { safePause(v); setPlaying(false) }
  }, [safePlay, safePause])

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current
    if (!v || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    v.currentTime = pct * duration
    setCurrentTime(v.currentTime)
  }, [duration])

  const handleProgressMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    setDragging(true)
    handleSeek(e)
  }, [handleSeek])

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => {
      const bar = wrapRef.current?.querySelector("[data-progress-bar]") as HTMLElement | null
      if (!bar || !videoRef.current || !duration) return
      const rect = bar.getBoundingClientRect()
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      videoRef.current.currentTime = pct * duration
      setCurrentTime(videoRef.current.currentTime)
    }
    const onUp = () => setDragging(false)
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp) }
  }, [dragging, duration])

  const changeVolume = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current
    if (!v) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    v.volume = pct
    setVolume(pct)
    if (pct > 0 && muted) { v.muted = false; setMuted(false) }
  }, [muted])

  const toggleMute = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
    setMuted(v.muted)
  }, [])

  const changeSpeed = useCallback((s: number) => {
    const v = videoRef.current
    if (!v) return
    v.playbackRate = s
    setSpeed(s)
    setShowSpeed(false)
  }, [])

  const toggleFullscreen = useCallback(() => {
    const el = wrapRef.current
    if (!el) return
    if (!document.fullscreenElement) {
      el.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }, [])

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener("fullscreenchange", onFsChange)
    return () => document.removeEventListener("fullscreenchange", onFsChange)
  }, [])

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div ref={wrapRef} className={`relative flex flex-col overflow-hidden rounded-[6px] bg-black ${className ?? ""}`}>
      {/* Video area */}
      <div className="relative cursor-pointer" onClick={togglePlay}>
        <video
          ref={videoRef}
          src={src}
          preload="metadata"
          autoPlay={autoPlay}
          className="w-full aspect-video bg-black"
          onTimeUpdate={() => { if (videoRef.current) setCurrentTime(videoRef.current.currentTime) }}
          onLoadedMetadata={() => { if (videoRef.current) { setDuration(videoRef.current.duration); videoRef.current.playbackRate = speed } }}
          onPlay={() => { setPlaying(true); setStarted(true) }}
          onPause={() => setPlaying(false)}
          onEnded={() => { setPlaying(false); onEnded?.() }}
        />
        {!playing && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className={`flex items-center justify-center rounded-full bg-black/50 backdrop-blur-sm ${started ? "h-10 w-10" : "h-14 w-14"}`}>
              <Play size={started ? 20 : 28} className="text-white translate-x-0.5" fill="white" />
            </div>
          </div>
        )}
      </div>

      {/* Controls bar — visible after first play or always on hover */}
      <div className="flex flex-col bg-[#111827] px-2.5 py-1 shrink-0 select-none">
        <div
          data-progress-bar
          className="group relative h-3 flex items-center cursor-pointer mb-0.5"
          onMouseDown={handleProgressMouseDown}
        >
          <div className="absolute inset-x-0 h-[3px] rounded-full bg-white/20 group-hover:h-1 transition-all">
            <div className="h-full rounded-full bg-[#38c08f] transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div
            className="absolute h-2.5 w-2.5 rounded-full bg-[#38c08f] shadow-md -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `${pct}%` }}
          />
        </div>

        <div className="flex items-center gap-2 h-7">
          <button onClick={togglePlay} className="text-white hover:text-[#38c08f] transition-colors">
            {playing ? <Pause size={15} /> : <Play size={15} className="translate-x-0.5" />}
          </button>

          <span className="text-[11px] text-[#d1d5db] tabular-nums whitespace-nowrap">
            {fmtTime(currentTime)} / {fmtTime(duration)}
          </span>

          <button onClick={toggleMute} className="text-white hover:text-[#38c08f] transition-colors">
            {muted || volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
          <div className="relative h-3 w-[50px] flex items-center cursor-pointer group" onClick={changeVolume}>
            <div className="absolute inset-x-0 h-[3px] rounded-full bg-white/20">
              <div className="h-full rounded-full bg-[#38c08f]" style={{ width: `${(muted ? 0 : volume) * 100}%` }} />
            </div>
            <div className="absolute h-2 w-2 rounded-full bg-[#38c08f] -translate-x-1/2" style={{ left: `${(muted ? 0 : volume) * 100}%` }} />
          </div>

          <div className="flex-1" />

          <div className="relative">
            <button
              onClick={() => setShowSpeed((p) => !p)}
              className="rounded px-1.5 py-0.5 text-[11px] font-medium text-[#d1d5db] bg-white/10 hover:bg-white/20 transition-colors"
            >
              {SPEED_OPTIONS.find((o) => o.value === speed)?.label ?? `${speed}x`}
            </button>
            {showSpeed && (
              <div className="absolute bottom-full right-0 mb-2 rounded-[6px] bg-[#1f2937] shadow-xl border border-white/10 overflow-hidden z-50">
                {SPEED_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => changeSpeed(o.value)}
                    className={`block w-full px-4 py-1 text-[11.5px] text-left whitespace-nowrap transition-colors ${
                      o.value === speed ? "text-[#38c08f] bg-white/5" : "text-[#d1d5db] hover:bg-white/10"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button onClick={toggleFullscreen} className="text-white hover:text-[#38c08f] transition-colors">
            {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Video Player Modal (弹窗播放器) ─────────────────────────────────────────

export function VideoPlayerModal({ src, title, onClose }: { src: string; title?: string; onClose: () => void }) {
  const isBlob = src.startsWith("blob:")
  const blobRef = useRef(src)
  useEffect(() => {
    if (isBlob) return () => URL.revokeObjectURL(blobRef.current)
  }, [isBlob])

  const videoRef = useRef<HTMLVideoElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [speed, setSpeed] = useState(1.0)
  const [showSpeed, setShowSpeed] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [dragging, setDragging] = useState(false)

  const playPromiseModal = useRef<Promise<void> | null>(null)

  const safePlayModal = useCallback((v: HTMLVideoElement) => {
    const p = v.play()
    if (p) {
      playPromiseModal.current = p
      p.then(() => { playPromiseModal.current = null }).catch(() => { playPromiseModal.current = null })
    }
  }, [])

  const safePauseModal = useCallback((v: HTMLVideoElement) => {
    if (playPromiseModal.current) {
      playPromiseModal.current.then(() => v.pause()).catch(() => {})
      playPromiseModal.current = null
    } else {
      v.pause()
    }
  }, [])

  const togglePlay = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) { safePlayModal(v); setPlaying(true) } else { safePauseModal(v); setPlaying(false) }
  }, [safePlayModal, safePauseModal])

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current
    if (!v || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    v.currentTime = pct * duration
    setCurrentTime(v.currentTime)
  }, [duration])

  const handleProgressMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    setDragging(true)
    handleSeek(e)
  }, [handleSeek])

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => {
      const bar = wrapRef.current?.querySelector("[data-progress-bar]") as HTMLElement | null
      if (!bar || !videoRef.current || !duration) return
      const rect = bar.getBoundingClientRect()
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      videoRef.current.currentTime = pct * duration
      setCurrentTime(videoRef.current.currentTime)
    }
    const onUp = () => setDragging(false)
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp) }
  }, [dragging, duration])

  const changeVolume = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current
    if (!v) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    v.volume = pct
    setVolume(pct)
    if (pct > 0 && muted) { v.muted = false; setMuted(false) }
  }, [muted])

  const toggleMute = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
    setMuted(v.muted)
  }, [])

  const changeSpeed = useCallback((s: number) => {
    const v = videoRef.current
    if (!v) return
    v.playbackRate = s
    setSpeed(s)
    setShowSpeed(false)
  }, [])

  const toggleFullscreen = useCallback(() => {
    const el = wrapRef.current
    if (!el) return
    if (!document.fullscreenElement) {
      el.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }, [])

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener("fullscreenchange", onFsChange)
    return () => document.removeEventListener("fullscreenchange", onFsChange)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement) onClose()
      if (e.key === " " || e.key === "k") { e.preventDefault(); togglePlay() }
      if (e.key === "f") toggleFullscreen()
      if (e.key === "m") toggleMute()
      const v = videoRef.current
      if (!v) return
      if (e.key === "ArrowLeft") { v.currentTime = Math.max(0, v.currentTime - 5); setCurrentTime(v.currentTime) }
      if (e.key === "ArrowRight") { v.currentTime = Math.min(v.duration, v.currentTime + 5); setCurrentTime(v.currentTime) }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose, togglePlay, toggleFullscreen, toggleMute])

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <>
      <div className="fixed inset-0 z-[200] bg-black/80" onClick={onClose} />
      <div className="fixed inset-0 z-[201] flex items-center justify-center p-8">
        <div ref={wrapRef} className="relative flex flex-col w-full max-w-[860px] rounded-[8px] overflow-hidden bg-black shadow-2xl">
          <div className="flex items-center justify-between bg-[#111827] px-4 py-2.5 shrink-0">
            <span className="truncate text-[12.5px] text-[#d1d5db]">{title ?? "视频播放"}</span>
            <button onClick={onClose} className="ml-4 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[#9ca3af] hover:bg-white/10 hover:text-white transition-colors">
              <X size={14} />
            </button>
          </div>

          <div className="relative cursor-pointer" onClick={togglePlay}>
            <video
              ref={videoRef}
              src={src}
              className="w-full max-h-[70vh] bg-black"
              onTimeUpdate={() => { if (videoRef.current) setCurrentTime(videoRef.current.currentTime) }}
              onLoadedMetadata={() => {
                const v = videoRef.current
                if (!v) return
                setDuration(v.duration)
                v.playbackRate = speed
                safePlayModal(v)
              }}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
            />
            {!playing && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm">
                  <Play size={28} className="text-white translate-x-0.5" fill="white" />
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col bg-[#111827] px-3 py-1.5 shrink-0 select-none" onClick={(e) => e.stopPropagation()}>
            <div
              data-progress-bar
              className="group relative h-3 flex items-center cursor-pointer mb-1"
              onMouseDown={handleProgressMouseDown}
            >
              <div className="absolute inset-x-0 h-1 rounded-full bg-white/20 group-hover:h-1.5 transition-all">
                <div className="h-full rounded-full bg-[#38c08f] transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div
                className="absolute h-3 w-3 rounded-full bg-[#38c08f] shadow-md -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ left: `${pct}%` }}
              />
            </div>

            <div className="flex items-center gap-3 h-8">
              <button onClick={togglePlay} className="text-white hover:text-[#38c08f] transition-colors">
                {playing ? <Pause size={18} /> : <Play size={18} className="translate-x-0.5" />}
              </button>
              <span className="text-[12px] text-[#d1d5db] tabular-nums whitespace-nowrap">
                {fmtTime(currentTime)} / {fmtTime(duration)}
              </span>
              <button onClick={toggleMute} className="ml-1 text-white hover:text-[#38c08f] transition-colors">
                {muted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <div className="relative h-4 w-[70px] flex items-center cursor-pointer group" onClick={changeVolume}>
                <div className="absolute inset-x-0 h-1 rounded-full bg-white/20">
                  <div className="h-full rounded-full bg-[#38c08f]" style={{ width: `${(muted ? 0 : volume) * 100}%` }} />
                </div>
                <div className="absolute h-2.5 w-2.5 rounded-full bg-[#38c08f] -translate-x-1/2" style={{ left: `${(muted ? 0 : volume) * 100}%` }} />
              </div>
              <div className="flex-1" />
              <div className="relative">
                <button
                  onClick={() => setShowSpeed((p) => !p)}
                  className="rounded px-2 py-0.5 text-[12px] font-medium text-[#d1d5db] bg-white/10 hover:bg-white/20 transition-colors"
                >
                  {SPEED_OPTIONS.find((o) => o.value === speed)?.label ?? `${speed}x`}
                </button>
                {showSpeed && (
                  <div className="absolute bottom-full right-0 mb-2 rounded-[6px] bg-[#1f2937] shadow-xl border border-white/10 overflow-hidden">
                    {SPEED_OPTIONS.map((o) => (
                      <button
                        key={o.value}
                        onClick={() => changeSpeed(o.value)}
                        className={`block w-full px-5 py-1.5 text-[12.5px] text-left whitespace-nowrap transition-colors ${
                          o.value === speed ? "text-[#38c08f] bg-white/5" : "text-[#d1d5db] hover:bg-white/10"
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={toggleFullscreen} className="text-white hover:text-[#38c08f] transition-colors">
                {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── VideoThumbnail ───────────────────────────────────────────────────────────

export function VideoThumbnail({
  state,
  onPlay,
  onRemove,
}: {
  state: UploadFileState
  onPlay: () => void
  onRemove: () => void
}) {
  const [thumb, setThumb] = useState<string | null>(null)

  useEffect(() => {
    const videoUrl = URL.createObjectURL(state.file)
    const video = document.createElement("video")
    video.crossOrigin = "anonymous"
    video.src = videoUrl
    video.currentTime = 0.5
    video.onloadeddata = () => {
      const canvas = document.createElement("canvas")
      canvas.width = 160
      canvas.height = 90
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        setThumb(canvas.toDataURL("image/jpeg", 0.8))
      }
      URL.revokeObjectURL(videoUrl)
    }
    video.onerror = () => URL.revokeObjectURL(videoUrl)
    return () => URL.revokeObjectURL(videoUrl)
  }, [state.file])

  const sizeMB = (state.file.size / 1024 / 1024).toFixed(1)

  return (
    <VideoThumbnailUI
      thumbSrc={thumb}
      fileName={state.file.name}
      sizeMB={sizeMB}
      onPlay={onPlay}
      onRemove={onRemove}
    />
  )
}

export function RemoteVideoThumbnail({
  state,
  onPlay,
  onRemove,
}: {
  state: RemoteFileState
  onPlay: () => void
  onRemove: () => void
}) {
  const [thumb, setThumb] = useState<string | null>(null)

  useEffect(() => {
    if (!state.remoteUrl) return
    let cancelled = false

    function tryCapture(crossOrigin: boolean) {
      const video = document.createElement("video")
      if (crossOrigin) video.crossOrigin = "anonymous"
      video.preload = "metadata"
      video.muted = true
      video.playsInline = true
      video.onloadeddata = () => {
        if (cancelled) return
        try {
          const canvas = document.createElement("canvas")
          canvas.width = 160
          canvas.height = 90
          const ctx = canvas.getContext("2d")
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            setThumb(canvas.toDataURL("image/jpeg", 0.8))
          }
        } catch {
          if (crossOrigin && !cancelled) tryCapture(false)
        }
      }
      video.onerror = () => {
        if (crossOrigin && !cancelled) tryCapture(false)
      }
      video.src = state.remoteUrl
      video.currentTime = 0.5
    }

    tryCapture(true)
    return () => { cancelled = true }
  }, [state.remoteUrl])

  const sizeMB = (state.fileSize / 1024 / 1024).toFixed(1)
  return (
    <VideoThumbnailUI
      thumbSrc={thumb}
      fileName={state.fileName}
      sizeMB={sizeMB}
      onPlay={onPlay}
      onRemove={onRemove}
    />
  )
}

function VideoThumbnailUI({
  thumbSrc,
  fileName,
  sizeMB,
  onPlay,
  onRemove,
}: {
  thumbSrc: string | null
  fileName: string
  sizeMB: string
  onPlay: () => void
  onRemove: () => void
}) {
  return (
    <div className="flex items-center gap-3 rounded-[6px] border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-2.5">
      <button
        onClick={onPlay}
        className="relative h-[52px] w-[92px] shrink-0 overflow-hidden rounded-[4px] bg-[#1f2937] hover:opacity-90 transition-opacity"
        title="点击播放"
        type="button"
      >
        {thumbSrc ? (
          <img src={thumbSrc} alt="视频首帧" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <svg viewBox="0 0 24 24" fill="white" className="h-5 w-5 opacity-40"><path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/></svg>
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-black/50">
            <svg viewBox="0 0 24 24" fill="white" className="h-3.5 w-3.5 translate-x-0.5">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </button>
      <div className="flex flex-1 flex-col gap-0.5 min-w-0">
        <span className="truncate text-[12px] font-medium text-[#111827]">{fileName}</span>
        <div className="flex items-center gap-2">
          <span className="text-[11.5px] text-[#9ca3af]">{sizeMB} MB</span>
          <span className="text-[11.5px] font-medium text-[#38c08f]">上传完成</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center">
        <button
          onClick={onRemove}
          className="rounded-[3px] border border-[#fecaca] bg-white px-2 py-0.5 text-[11px] text-[#dc2626] hover:bg-[#fef2f2] transition-colors"
          type="button"
        >
          删除
        </button>
      </div>
    </div>
  )
}
