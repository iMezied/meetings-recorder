import { FileText } from 'lucide-react'
import { backend } from '../hooks/useBackend'
import { useStore } from '../hooks/useStore'
import type { Transcript } from '../types'

interface TranscriptTabProps {
  transcript: Transcript | null
  meetingId: string
}

const SPEAKER_COLORS = [
  'bg-blue-500/20 text-blue-300',
  'bg-emerald-500/20 text-emerald-300',
  'bg-purple-500/20 text-purple-300',
  'bg-orange-500/20 text-orange-300',
  'bg-pink-500/20 text-pink-300',
  'bg-cyan-500/20 text-cyan-300',
  'bg-yellow-500/20 text-yellow-300',
  'bg-red-500/20 text-red-300',
]

function getSpeakerColor(speaker: string | null, speakerMap: Map<string, number>): string {
  if (!speaker) return 'bg-zinc-700 text-zinc-300'
  if (!speakerMap.has(speaker)) {
    speakerMap.set(speaker, speakerMap.size)
  }
  const idx = speakerMap.get(speaker)!
  return SPEAKER_COLORS[idx % SPEAKER_COLORS.length]!
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function isRTL(text: string): boolean {
  const rtlPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/
  return rtlPattern.test(text.slice(0, 50))
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query) return text
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  const parts = text.split(regex)
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="rounded bg-yellow-500/30 text-yellow-200">
        {part}
      </mark>
    ) : (
      part
    )
  )
}

export default function TranscriptTab({ transcript, meetingId }: TranscriptTabProps) {
  const searchQuery = useStore((s) => s.searchQuery)

  const handleTranscribe = async () => {
    try {
      await backend.transcribeMeeting(meetingId)
    } catch (err) {
      console.error('Failed to transcribe:', err)
    }
  }

  if (!transcript) {
    return (
      <div className="flex flex-col items-center justify-center px-5 py-16">
        <FileText className="mb-3 h-8 w-8 text-zinc-600" />
        <p className="mb-3 text-sm text-zinc-500">No transcript yet.</p>
        <button
          onClick={handleTranscribe}
          className="rounded-md bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-500"
        >
          Transcribe Meeting
        </button>
      </div>
    )
  }

  const speakerMap = new Map<string, number>()

  return (
    <div className="p-5">
      {transcript.language && (
        <div className="mb-3 text-xs text-zinc-500">
          Language: {transcript.language}
        </div>
      )}
      <div className="space-y-3">
        {transcript.segments.map((seg, i) => {
          const rtl = isRTL(seg.text)
          return (
            <div key={i} className="flex gap-3" dir={rtl ? 'rtl' : 'ltr'}>
              <span className="shrink-0 pt-0.5 text-xs tabular-nums text-zinc-600">
                {formatTimestamp(seg.start)}
              </span>
              <div className="min-w-0 flex-1">
                {seg.speaker && (
                  <span
                    className={`mb-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${getSpeakerColor(seg.speaker, speakerMap)}`}
                  >
                    {seg.speaker}
                  </span>
                )}
                <p className="text-sm leading-relaxed text-zinc-300">
                  {highlightText(seg.text, searchQuery)}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
