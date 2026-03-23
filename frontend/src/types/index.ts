export interface Meeting {
  id: string
  date: string
  source: string
  duration: number
  audioPath: string
  transcriptPath: string | null
  summaryPath: string | null
  sentimentPath: string | null
  status: 'recording' | 'recorded' | 'transcribing' | 'transcribed' | 'analyzing' | 'completed' | 'error'
  title: string | null
  createdAt: string
  syncedAt: string | null
  deviceId: string
}

export interface TranscriptSegment {
  start: number
  end: number
  text: string
  speaker: string | null
}

export interface Transcript {
  segments: TranscriptSegment[]
  language: string
  duration: number
}

export interface ActionItem {
  task: string
  assignee: string | null
  deadline: string | null
}

export interface Summary {
  title: string
  overview: string
  keyPoints: string[]
  actionItems: ActionItem[]
  decisions: string[]
  openQuestions: string[]
}

export interface SpeakerSentiment {
  name: string
  sentiment: string
  engagement: string
  toneDescriptors: string[]
  style: string
  contributions: string[]
}

export interface Sentiment {
  speakers: SpeakerSentiment[]
  overallMeetingTone: string
  dynamicsSummary: string
}

export interface RecordingStatus {
  isRecording: boolean
  duration: number
  level: number
  source: string | null
}

export interface DetectorStatus {
  isMonitoring: boolean
  detectedMeeting: boolean
  meetingSource: string | null
}

export interface ModelInfo {
  name: string
  size: string
  description: string
  downloaded: boolean
}

export interface AppSettings {
  launchAtLogin: boolean
  autoRecord: boolean
  autoTranscribe: boolean
  autoAnalyze: boolean
  storageLocation: string
  audioDevice: string | null
  whisperModel: string
  language: string
  huggingfaceToken: string | null
  ollamaModel: string
  syncEnabled: boolean
  syncProvider: string | null
  syncPath: string | null
}

export interface SyncStatus {
  enabled: boolean
  provider: string | null
  lastSync: string | null
  pendingChanges: number
}

export interface AudioDevice {
  id: string
  name: string
  isDefault: boolean
}

export interface SSEEvent {
  type: string
  data: unknown
}
