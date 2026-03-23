import { Mic, Radio, Settings, Circle } from 'lucide-react'
import { useStore } from '../hooks/useStore'
import { backend } from '../hooks/useBackend'
import AudioLevelMeter from './AudioLevelMeter'

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function TopBar() {
  const recordingStatus = useStore((s) => s.recordingStatus)
  const detectorStatus = useStore((s) => s.detectorStatus)
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)

  const handleToggleMonitoring = async () => {
    try {
      if (detectorStatus.isMonitoring) {
        await backend.stopMonitoring()
      } else {
        await backend.startMonitoring()
      }
    } catch (err) {
      console.error('Failed to toggle monitoring:', err)
    }
  }

  const handleToggleRecording = async () => {
    try {
      if (recordingStatus.isRecording) {
        await backend.stopRecording()
      } else {
        await backend.startRecording()
      }
    } catch (err) {
      console.error('Failed to toggle recording:', err)
    }
  }

  return (
    <div className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-700 bg-zinc-900 px-4">
      {/* Left: App title */}
      <div className="flex items-center gap-2">
        <Mic className="h-4 w-4 text-blue-500" />
        <span className="text-sm font-semibold tracking-tight">Meeting Recorder</span>
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-3">
        {/* Recording duration and level */}
        {recordingStatus.isRecording && (
          <div className="flex items-center gap-2">
            <span className="text-xs tabular-nums text-zinc-400">
              {formatDuration(recordingStatus.duration)}
            </span>
            <AudioLevelMeter level={recordingStatus.level} />
          </div>
        )}

        {/* Monitor toggle */}
        <button
          onClick={handleToggleMonitoring}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-smooth ${
            detectorStatus.isMonitoring
              ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300'
          }`}
          title={detectorStatus.isMonitoring ? 'Stop monitoring' : 'Start monitoring'}
        >
          <Circle
            className={`h-2 w-2 ${detectorStatus.isMonitoring ? 'fill-emerald-400 text-emerald-400' : 'text-zinc-500'}`}
          />
          Monitor
        </button>

        {/* Record button */}
        <button
          onClick={handleToggleRecording}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-smooth ${
            recordingStatus.isRecording
              ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25'
              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300'
          }`}
          title={recordingStatus.isRecording ? 'Stop recording' : 'Start recording'}
        >
          <Radio
            className={`h-3.5 w-3.5 ${recordingStatus.isRecording ? 'animate-pulse-recording text-red-400' : ''}`}
          />
          {recordingStatus.isRecording ? 'Stop' : 'Record'}
        </button>

        {/* Settings */}
        <button
          onClick={() => setView(view === 'settings' ? 'library' : 'settings')}
          className={`rounded-md p-1.5 transition-smooth ${
            view === 'settings'
              ? 'bg-blue-500/15 text-blue-400'
              : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300'
          }`}
          title="Settings"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
