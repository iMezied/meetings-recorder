import { useEffect } from 'react'
import { useStore } from './hooks/useStore'
import { backend } from './hooks/useBackend'
import TopBar from './components/TopBar'
import Sidebar from './components/Sidebar'
import DetailView from './components/DetailView'
import SettingsView from './components/SettingsView'

export default function App() {
  const view = useStore((s) => s.view)
  const setMeetings = useStore((s) => s.setMeetings)
  const setRecordingStatus = useStore((s) => s.setRecordingStatus)
  const setDetectorStatus = useStore((s) => s.setDetectorStatus)
  const setSettings = useStore((s) => s.setSettings)

  useEffect(() => {
    // Load initial data
    backend.getMeetings().then(setMeetings).catch(console.error)
    backend.getRecordingStatus().then(setRecordingStatus).catch(console.error)
    backend.getDetectorStatus().then(setDetectorStatus).catch(console.error)
    backend.getSettings().then(setSettings).catch(console.error)

    // Subscribe to SSE events
    const cleanup = backend.subscribeEvents((event) => {
      if (event.type === 'recording_status') {
        setRecordingStatus(event.data)
      } else if (event.type === 'detector_status') {
        setDetectorStatus(event.data)
      } else if (event.type === 'meeting_updated') {
        backend.getMeetings().then(setMeetings).catch(console.error)
      }
    })

    return cleanup
  }, [setMeetings, setRecordingStatus, setDetectorStatus, setSettings])

  return (
    <div className="flex h-full flex-col bg-zinc-900 text-zinc-100">
      <TopBar />
      {view === 'settings' ? (
        <SettingsView />
      ) : (
        <div className="flex min-h-0 flex-1">
          <Sidebar />
          <DetailView />
        </div>
      )}
    </div>
  )
}
