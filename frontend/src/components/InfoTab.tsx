import { format } from 'date-fns'
import { Folder, HardDrive } from 'lucide-react'
import type { Meeting } from '../types'

interface InfoTabProps {
  meeting: Meeting
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-center justify-between border-b border-zinc-800 py-2.5">
      <span className="text-xs font-medium text-zinc-500">{label}</span>
      <span className="text-xs text-zinc-300">{value ?? '--'}</span>
    </div>
  )
}

function FileRow({ label, path }: { label: string; path: string | null }) {
  if (!path) return null
  return (
    <div className="flex items-start justify-between gap-4 border-b border-zinc-800 py-2.5">
      <span className="shrink-0 text-xs font-medium text-zinc-500">{label}</span>
      <span className="flex items-center gap-1 truncate text-xs text-zinc-400">
        <Folder className="h-3 w-3 shrink-0" />
        <span className="truncate">{path}</span>
      </span>
    </div>
  )
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}h ${m}m ${s}s`
  return `${m}m ${s}s`
}

export default function InfoTab({ meeting }: InfoTabProps) {
  return (
    <div className="space-y-6 p-5">
      {/* Meeting info */}
      <div>
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          <HardDrive className="h-3.5 w-3.5" />
          Meeting Details
        </h3>
        <div className="rounded-lg border border-zinc-800 bg-zinc-800/30 px-4">
          <InfoRow label="Source" value={meeting.source} />
          <InfoRow label="Date" value={format(new Date(meeting.createdAt), 'MMMM d, yyyy h:mm a')} />
          <InfoRow label="Duration" value={formatDuration(meeting.duration)} />
          <InfoRow label="Status" value={meeting.status} />
          <InfoRow label="Device" value={meeting.deviceId} />
          <InfoRow label="ID" value={meeting.id} />
        </div>
      </div>

      {/* File paths */}
      <div>
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          <Folder className="h-3.5 w-3.5" />
          Files
        </h3>
        <div className="rounded-lg border border-zinc-800 bg-zinc-800/30 px-4">
          <FileRow label="Audio" path={meeting.audioPath} />
          <FileRow label="Transcript" path={meeting.transcriptPath} />
          <FileRow label="Summary" path={meeting.summaryPath} />
          <FileRow label="Sentiment" path={meeting.sentimentPath} />
        </div>
      </div>

      {/* Timeline */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Timeline
        </h3>
        <div className="rounded-lg border border-zinc-800 bg-zinc-800/30 px-4">
          <InfoRow
            label="Created"
            value={format(new Date(meeting.createdAt), 'MMM d, yyyy h:mm:ss a')}
          />
          {meeting.syncedAt && (
            <InfoRow
              label="Last Synced"
              value={format(new Date(meeting.syncedAt), 'MMM d, yyyy h:mm:ss a')}
            />
          )}
        </div>
      </div>
    </div>
  )
}
