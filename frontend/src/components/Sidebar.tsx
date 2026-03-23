import { Search, HardDrive, RefreshCw } from 'lucide-react'
import { useStore } from '../hooks/useStore'
import MeetingRow from './MeetingRow'

const SOURCE_FILTERS = [
  { label: 'All', value: null },
  { label: 'Zoom', value: 'zoom' },
  { label: 'Meet', value: 'meet' },
  { label: 'Teams', value: 'teams' },
]

export default function Sidebar() {
  const meetings = useStore((s) => s.meetings)
  const selectedMeetingId = useStore((s) => s.selectedMeetingId)
  const selectMeeting = useStore((s) => s.selectMeeting)
  const searchQuery = useStore((s) => s.searchQuery)
  const setSearchQuery = useStore((s) => s.setSearchQuery)
  const sourceFilter = useStore((s) => s.sourceFilter)
  const setSourceFilter = useStore((s) => s.setSourceFilter)

  const filteredMeetings = meetings.filter((m) => {
    if (sourceFilter && m.source.toLowerCase() !== sourceFilter) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const title = (m.title ?? '').toLowerCase()
      return title.includes(q)
    }
    return true
  })

  return (
    <div className="flex w-[280px] shrink-0 flex-col border-r border-zinc-700 bg-zinc-900">
      {/* Search */}
      <div className="p-3">
        <div className="flex items-center gap-2 rounded-md bg-zinc-800 px-2.5 py-1.5">
          <Search className="h-3.5 w-3.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Search meetings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-xs text-zinc-200 placeholder-zinc-500 outline-none"
          />
        </div>
      </div>

      {/* Source filters */}
      <div className="flex gap-1 px-3 pb-2">
        {SOURCE_FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => setSourceFilter(f.value)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-smooth ${
              sourceFilter === f.value
                ? 'bg-blue-500/20 text-blue-400'
                : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Meeting list */}
      <div className="flex-1 overflow-y-auto">
        {filteredMeetings.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-zinc-500">
            {searchQuery ? 'No meetings match your search' : 'No meetings yet'}
          </div>
        ) : (
          filteredMeetings.map((meeting) => (
            <MeetingRow
              key={meeting.id}
              meeting={meeting}
              isSelected={meeting.id === selectedMeetingId}
              onClick={() => selectMeeting(meeting.id)}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-zinc-800 px-3 py-2">
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <HardDrive className="h-3 w-3" />
          <span>{meetings.length} meetings</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-zinc-500">
          <RefreshCw className="h-3 w-3" />
          <span>Synced</span>
        </div>
      </div>
    </div>
  )
}
