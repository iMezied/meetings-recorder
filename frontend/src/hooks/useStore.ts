import { create } from 'zustand'
import type { Meeting, RecordingStatus, DetectorStatus, AppSettings } from '../types'

interface AppState {
  meetings: Meeting[]
  selectedMeetingId: string | null
  recordingStatus: RecordingStatus
  detectorStatus: DetectorStatus
  settings: AppSettings | null
  view: 'library' | 'settings'
  activeTab: 'transcript' | 'summary' | 'sentiment' | 'info'
  searchQuery: string
  sourceFilter: string | null

  setMeetings: (meetings: Meeting[]) => void
  selectMeeting: (id: string | null) => void
  setRecordingStatus: (status: RecordingStatus) => void
  setDetectorStatus: (status: DetectorStatus) => void
  setSettings: (settings: AppSettings) => void
  setView: (view: 'library' | 'settings') => void
  setActiveTab: (tab: 'transcript' | 'summary' | 'sentiment' | 'info') => void
  setSearchQuery: (query: string) => void
  setSourceFilter: (source: string | null) => void
}

export const useStore = create<AppState>((set) => ({
  meetings: [],
  selectedMeetingId: null,
  recordingStatus: { isRecording: false, duration: 0, level: 0, source: null },
  detectorStatus: { isMonitoring: false, detectedMeeting: false, meetingSource: null },
  settings: null,
  view: 'library',
  activeTab: 'transcript',
  searchQuery: '',
  sourceFilter: null,

  setMeetings: (meetings) => set({ meetings }),
  selectMeeting: (id) => set({ selectedMeetingId: id }),
  setRecordingStatus: (status) => set({ recordingStatus: status }),
  setDetectorStatus: (status) => set({ detectorStatus: status }),
  setSettings: (settings) => set({ settings }),
  setView: (view) => set({ view }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSourceFilter: (source) => set({ sourceFilter: source }),
}))
