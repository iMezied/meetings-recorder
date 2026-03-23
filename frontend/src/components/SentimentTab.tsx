import { BarChart3 } from 'lucide-react'
import type { Sentiment } from '../types'

interface SentimentTabProps {
  sentiment: Sentiment | null
}

const TONE_COLORS: Record<string, string> = {
  collaborative: 'bg-emerald-500/20 text-emerald-300',
  tense: 'bg-red-500/20 text-red-300',
  productive: 'bg-blue-500/20 text-blue-300',
  unfocused: 'bg-yellow-500/20 text-yellow-300',
  neutral: 'bg-zinc-700 text-zinc-300',
}

const SENTIMENT_AVATAR_COLORS: Record<string, string> = {
  positive: 'bg-emerald-500/30 text-emerald-300',
  negative: 'bg-red-500/30 text-red-300',
  neutral: 'bg-zinc-600 text-zinc-300',
  mixed: 'bg-yellow-500/30 text-yellow-300',
}

const ENGAGEMENT_COLORS: Record<string, string> = {
  high: 'bg-emerald-500/20 text-emerald-300',
  medium: 'bg-yellow-500/20 text-yellow-300',
  low: 'bg-red-500/20 text-red-300',
}

function getToneColor(tone: string): string {
  const key = tone.toLowerCase()
  return TONE_COLORS[key] ?? 'bg-zinc-700 text-zinc-300'
}

function getAvatarColor(sentiment: string): string {
  const key = sentiment.toLowerCase()
  return SENTIMENT_AVATAR_COLORS[key] ?? 'bg-zinc-600 text-zinc-300'
}

function getEngagementColor(engagement: string): string {
  const key = engagement.toLowerCase()
  return ENGAGEMENT_COLORS[key] ?? 'bg-zinc-700 text-zinc-300'
}

export default function SentimentTab({ sentiment }: SentimentTabProps) {
  if (!sentiment) {
    return (
      <div className="flex flex-col items-center justify-center px-5 py-16">
        <BarChart3 className="mb-3 h-8 w-8 text-zinc-600" />
        <p className="text-sm text-zinc-500">No sentiment data yet. Click Analyze to generate.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 p-5">
      {/* Overall tone */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-zinc-400">Overall Tone</span>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getToneColor(sentiment.overallMeetingTone)}`}>
          {sentiment.overallMeetingTone}
        </span>
      </div>

      {/* Dynamics summary */}
      {sentiment.dynamicsSummary && (
        <p className="rounded-lg bg-zinc-800 p-3 text-sm leading-relaxed text-zinc-300">
          {sentiment.dynamicsSummary}
        </p>
      )}

      {/* Speaker cards */}
      <div className="space-y-3">
        {sentiment.speakers.map((speaker, i) => (
          <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-800/50 p-4">
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${getAvatarColor(speaker.sentiment)}`}
              >
                {speaker.name.charAt(0).toUpperCase()}
              </div>

              <div className="min-w-0 flex-1">
                {/* Name and sentiment */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-200">{speaker.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${getAvatarColor(speaker.sentiment)}`}>
                    {speaker.sentiment}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${getEngagementColor(speaker.engagement)}`}>
                    {speaker.engagement} engagement
                  </span>
                </div>

                {/* Tone descriptors */}
                {speaker.toneDescriptors.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {speaker.toneDescriptors.map((tone, j) => (
                      <span
                        key={j}
                        className="rounded-full bg-zinc-700 px-2 py-0.5 text-xs text-zinc-400"
                      >
                        {tone}
                      </span>
                    ))}
                  </div>
                )}

                {/* Style */}
                {speaker.style && (
                  <p className="mt-2 text-xs leading-relaxed text-zinc-400">{speaker.style}</p>
                )}

                {/* Contributions */}
                {speaker.contributions.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {speaker.contributions.map((c, j) => (
                      <li key={j} className="flex items-start gap-1.5 text-xs text-zinc-400">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-500" />
                        {c}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
