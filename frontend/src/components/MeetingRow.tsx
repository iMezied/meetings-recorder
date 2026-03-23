import { Video, Monitor, Users, Mic, Check, Loader2 } from 'lucide-react'
import { format, isToday, isYesterday } from 'date-fns'
import type { Meeting } from '../types'

interface MeetingRowProps {
  meeting: Meeting
  isSelected: boolean
  onClick: () => void
}

function formatMeetingDate(dateStr: string): string {
  const date = new Date(dateStr)
  if (isToday(date)) return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'MMM d, yyyy')
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function SourceIcon({ source }: { source: string }) {
  const className = 'h-3.5 w-3.5 text-zinc-500'
  switch (source.toLowerCase()) {
    case 'zoom':
      return <Video className={className} />
    case 'meet':
    case 'google meet':
      return <Monitor className={className} />
    case 'teams':
    case 'microsoft teams':
      return <Users className={className} />
    default:
      return <Mic className={className} />
  }
}

function StatusIndicator({ status }: { status: Meeting['status'] }) {
  if (status === 'completed') {
    return <Check className="h-3 w-3 text-emerald-500" />
  }
  if (status === 'transcribing' || status === 'analyzing') {
    return <Loader2 className="h-3 w-3 animate-spin text-blue-400" />
  }
  if (status === 'error') {
    return <span className="h-2 w-2 rounded-full bg-red-500" />
  }
  return <span className="h-2 w-2 rounded-full border border-zinc-500" />
}

export default function MeetingRow({ meeting, isSelected, onClick }: MeetingRowProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full px-3 py-2.5 text-left transition-smooth ${
        isSelected
          ? 'bg-blue-500/15 border-l-2 border-blue-500'
          : 'border-l-2 border-transparent hover:bg-zinc-800/50'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <StatusIndicator status={meeting.status} />
            <span className="truncate text-sm font-medium text-zinc-200">
              {meeting.title ?? 'Untitled Meeting'}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
            <SourceIcon source={meeting.source} />
            <span>{formatDuration(meeting.duration)}</span>
            <span>{formatMeetingDate(meeting.createdAt)}</span>
          </div>
        </div>
      </div>
    </button>
  )
}
