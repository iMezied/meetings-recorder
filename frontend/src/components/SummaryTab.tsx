import { CheckCircle2, AlertCircle, ThumbsUp, HelpCircle, FileText } from 'lucide-react'
import type { Summary } from '../types'

interface SummaryTabProps {
  summary: Summary | null
}

export default function SummaryTab({ summary }: SummaryTabProps) {
  if (!summary) {
    return (
      <div className="flex flex-col items-center justify-center px-5 py-16">
        <FileText className="mb-3 h-8 w-8 text-zinc-600" />
        <p className="text-sm text-zinc-500">No summary yet. Click Analyze to generate one.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 p-5">
      {/* Overview */}
      <div className="rounded-lg bg-blue-500/10 p-4">
        <h3 className="mb-2 text-sm font-semibold text-blue-300">{summary.title}</h3>
        <p className="text-sm leading-relaxed text-zinc-300">{summary.overview}</p>
      </div>

      {/* Key Points */}
      {summary.keyPoints.length > 0 && (
        <div>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-zinc-200">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            Key Points
          </h3>
          <ul className="space-y-1.5">
            {summary.keyPoints.map((point, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500/60" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Items */}
      {summary.actionItems.length > 0 && (
        <div>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-zinc-200">
            <AlertCircle className="h-4 w-4 text-orange-400" />
            Action Items
          </h3>
          <div className="space-y-2">
            {summary.actionItems.map((item, i) => (
              <div key={i} className="rounded-lg bg-orange-500/10 px-3 py-2.5">
                <p className="text-sm text-zinc-300">{item.task}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  {item.assignee && (
                    <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-xs font-medium text-orange-300">
                      {item.assignee}
                    </span>
                  )}
                  {item.deadline && (
                    <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-xs text-zinc-400">
                      {item.deadline}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Decisions */}
      {summary.decisions.length > 0 && (
        <div>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-zinc-200">
            <ThumbsUp className="h-4 w-4 text-blue-400" />
            Decisions
          </h3>
          <ul className="space-y-1.5">
            {summary.decisions.map((decision, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                <ThumbsUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500/60" />
                <span>{decision}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Open Questions */}
      {summary.openQuestions.length > 0 && (
        <div>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-zinc-200">
            <HelpCircle className="h-4 w-4 text-yellow-400" />
            Open Questions
          </h3>
          <ul className="space-y-1.5">
            {summary.openQuestions.map((question, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                <HelpCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-yellow-500/60" />
                <span>{question}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
