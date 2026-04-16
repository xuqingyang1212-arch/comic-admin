"use client"

import { useRef, useState } from "react"
import { Upload } from "lucide-react"
import { VideoPlayerModal, VideoThumbnail, RemoteVideoThumbnail } from "@/components/video-thumbnail"
import { UploadProgressBar } from "@/components/image-thumbnail"
import type { UploadFileState, RemoteFileState } from "@/components/video-thumbnail"

export function VideoSlot({
  hint,
  state,
  remoteState,
  onFile,
  onRemove,
}: {
  hint?: string
  state: UploadFileState | null
  remoteState?: RemoteFileState | null
  onFile: (f: File) => void
  onRemove: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [playingSrc, setPlayingSrc] = useState<{ url: string; title: string } | null>(null)

  if (state) {
    return (
      <>
        {state.done ? (
          <VideoThumbnail
            state={state}
            onPlay={() => {
              const url = state.remoteUrl || URL.createObjectURL(state.file)
              setPlayingSrc({ url, title: state.file.name })
            }}
            onRemove={onRemove}
          />
        ) : (
          <UploadProgressBar state={state} onRemove={onRemove} />
        )}
        {playingSrc && (
          <VideoPlayerModal src={playingSrc.url} title={playingSrc.title} onClose={() => setPlayingSrc(null)} />
        )}
      </>
    )
  }

  if (remoteState) {
    return (
      <>
        <RemoteVideoThumbnail
          state={remoteState}
          onPlay={() => setPlayingSrc({ url: remoteState.remoteUrl, title: remoteState.fileName })}
          onRemove={onRemove}
        />
        {playingSrc && (
          <VideoPlayerModal src={playingSrc.url} title={playingSrc.title} onClose={() => setPlayingSrc(null)} />
        )}
      </>
    )
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[6px] border-2 border-dashed border-[#d1d5db] bg-[#f9fafb] py-6 hover:border-[#38c08f] hover:bg-[#f0fdf4] transition-colors"
    >
      <Upload size={18} className="text-[#9ca3af]" />
      <span className="text-[12px] text-[#9ca3af]">点击上传视频</span>
      {hint && <span className="text-[11px] text-[#c4c9d4]">{hint}</span>}
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
          e.target.value = ""
        }}
      />
    </div>
  )
}
