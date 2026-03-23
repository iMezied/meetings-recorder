import { useEffect, useState } from 'react'
import { Calendar, Clock, MoreHorizontal, Sparkles, FileText, BarChart3, MessageSquare, Info } from 'lucide-react'
import { format } from 'date-fns'
import { useStore } from '../hooks/useStore'
import { backend } from '../hooks/useBackend'
import type { Meeting, Transcript, Summary, Sentiment } from '../types'
import TranscriptTab from './TranscriptTab'
import SummaryTab from './SummaryTab'
import SentimentTab from './SentimentTab'
import InfoTab from './InfoTab'

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m ${s}s`
}

function StatusBadge({ status }: { status: Meeting['status'] }) {
  const styles: Record<string, string> = {
    recording: 'bg-red-500/15 text-red-400',
    recorded: 'bg-zinc-700 text-zinc-300',
    transcribing: 'bg-blue-500/15 text-blue-400',
    transcribed: 'bg-blue-500/15 text-blue-300',
    analyzing: 'bg-purple-500/15 text-purple-400',
    completed: 'bg-emerald-500/15 text-emerald-400',
    error: 'bg-red-500/15 text-red-400',
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? 'bg-zinc-700 text-zinc-300'}`}>
      {status}
    </span>
  )
}

const TABS = [
  { key: 'transcript' as const, label: 'Transcript', icon: FileText },
  { key: 'summary' as const, label: 'Summary', icon: MessageSquare },
  { key: 'sentiment' as const, label: 'Sentiment', icon: BarChart3 },
  { key: 'info' as const, label: 'Info', icon: Info },
]

export default function DetailView() {
  const selectedMeetingId = useStore((s) => s.selectedMeetingId)
  const meetings = useStore((s) => s.meetings)
  const activeTab = useStore((s) => s.activeTab)
  const setActiveTab = useStore((s) => s.setActiveTab)

  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [transcript, setTranscript] = useState<Transcript | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [sentiment, setSentiment] = useState<Sentiment | null>(null)
  const [analyzing, setAnalyzing] = useState(false)

  useEffect(() => {
    if (!selectedMeetingId) {
      setMeeting(null)
      setTranscript(null)
      setSummary(null)
      setSentiment(null)
      return
    }

    const m = meetings.find((x) => x.id === selectedMeetingId) ?? null
    setMeeting(m)

    if (m?.transcriptPath) {
      backend.getTranscript(m.id).then(setTranscript).catch(() => setTranscript(null))
    } else {
      setTranscript(null)
    }

    if (m?.summaryPath) {
      backend.getSummary(m.id).then(setSummary).catch(() => setSummary(null))
    } else {
      setSummary(null)
    }

    if (m?.sentimentPath) {
      backend.getSentiment(m.id).then(setSentiment).catch(() => setSentiment(null))
    } else {
      setSentiment(null)
    }
  }, [selectedMeetingId, meetings])

  const handleAnalyze = async () => {
    if (!meeting) return
    setAnalyzing(true)
    try {
      await backend.analyzeMeeting(meeting.id)
    } catch (err) {
      console.error('Failed to analyze:', err)
    } finally {
      setAnalyzing(false)
    }
  }

  const handleDelete = async () => {
    if (!meeting) return
    try {
      await backend.deleteMeeting(meeting.id)
      useStore.getState().selectMeeting(null)
      const updated = await backend.getMeetings()
      useStore.getState().setMeetings(updated)
    } catch (err) {
      console.error('Failed to delete:', err)
    }
  }

  if (!meeting) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <Sparkles className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
          <p className="text-sm text-zinc-500">Select a meeting to view details</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-zinc-700 px-5 py-3">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">
              {meeting.title ?? 'Untitled Meeting'}
            </h2>
            <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(meeting.createdAt), 'MMM d, yyyy h:mm a')}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDuration(meeting.duration)}
              </span>
              <StatusBadge status={meeting.status} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {meeting.status !== 'completed' && meeting.status !== 'analyzing' && (
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              >
                <Sparkles className="h-3 w-3" />
                {analyzing ? 'Analyzing...' : 'Analyze'}
              </button>
            )}
            <div className="relative">
              <button
                onClick={handleDelete}
                className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
                title="Delete meeting"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex shrink-0 border-b border-zinc-800 px-5">
        {TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-smooth ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'transcript' && <TranscriptTab transcript={transcript} meetingId={meeting.id} />}
        {activeTab === 'summary' && <SummaryTab summary={summary} />}
        {activeTab === 'sentiment' && <SentimentTab sentiment={sentiment} />}
        {activeTab === 'info' && <InfoTab meeting={meeting} />}
      </div>
    </div>
  )
}
