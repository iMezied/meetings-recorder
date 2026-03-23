import type {
  Meeting,
  Transcript,
  Summary,
  Sentiment,
  RecordingStatus,
  DetectorStatus,
  ModelInfo,
  AppSettings,
  AudioDevice,
  SyncStatus,
  SSEEvent,
} from '../types'

declare global {
  interface Window {
    api?: {
      getBackendUrl?: () => Promise<string>
    }
  }
}

let _baseUrl: string | null = null

async function initBaseUrl(): Promise<string> {
  if (_baseUrl) return _baseUrl
  try {
    const url = await window.api?.getBackendUrl?.()
    if (url) {
      _baseUrl = url
      return url
    }
  } catch {
    // Not running in Electron
  }
  _baseUrl = 'http://localhost:8765'
  return _baseUrl
}

const getBaseUrl = (): string => {
  return _baseUrl ?? 'http://localhost:8765'
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const base = getBaseUrl()
  const url = `${base}${path}`
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const error = await res.text().catch(() => 'Unknown error')
    throw new Error(`API error ${res.status}: ${error}`)
  }
  return res.json() as Promise<T>
}

// Recording
function startRecording(source?: string): Promise<{ message: string }> {
  const params = source ? `?source=${encodeURIComponent(source)}` : ''
  return request(`/api/recording/start${params}`, { method: 'POST' })
}

function stopRecording(): Promise<Meeting> {
  return request('/api/recording/stop', { method: 'POST' })
}

function getRecordingStatus(): Promise<RecordingStatus> {
  return request('/api/recording/status')
}

// Detector
function startMonitoring(): Promise<{ message: string }> {
  return request('/api/detector/start', { method: 'POST' })
}

function stopMonitoring(): Promise<{ message: string }> {
  return request('/api/detector/stop', { method: 'POST' })
}

function getDetectorStatus(): Promise<DetectorStatus> {
  return request('/api/detector/status')
}

// Meetings
interface MeetingFilters {
  source?: string
  search?: string
}

function getMeetings(filters?: MeetingFilters): Promise<Meeting[]> {
  const params = new URLSearchParams()
  if (filters?.source) params.set('source', filters.source)
  if (filters?.search) params.set('search', filters.search)
  const qs = params.toString()
  return request(`/api/meetings${qs ? `?${qs}` : ''}`)
}

function getMeeting(id: string): Promise<Meeting> {
  return request(`/api/meetings/${id}`)
}

function deleteMeeting(id: string): Promise<{ message: string }> {
  return request(`/api/meetings/${id}`, { method: 'DELETE' })
}

// Analysis
function getTranscript(id: string): Promise<Transcript> {
  return request(`/api/meetings/${id}/transcript`)
}

function getSummary(id: string): Promise<Summary> {
  return request(`/api/meetings/${id}/summary`)
}

function getSentiment(id: string): Promise<Sentiment> {
  return request(`/api/meetings/${id}/sentiment`)
}

function transcribeMeeting(id: string): Promise<{ message: string }> {
  return request(`/api/transcribe/${id}`, { method: 'POST' })
}

function analyzeMeeting(id: string): Promise<{ message: string }> {
  return request(`/api/analyze/${id}`, { method: 'POST' })
}

// Models
function getModels(): Promise<ModelInfo[]> {
  return request('/api/models')
}

function downloadModel(name: string): Promise<{ message: string }> {
  return request('/api/models/download', { method: 'POST', body: JSON.stringify({ name }) })
}

// Ollama
function getOllamaStatus(): Promise<{ available: boolean; models: string[] }> {
  return request('/api/ollama/status')
}

// Settings
function getSettings(): Promise<AppSettings> {
  return request('/api/settings')
}

function updateSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
  return request('/api/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  })
}

// Audio
function getAudioDevices(): Promise<AudioDevice[]> {
  return request('/api/audio/devices')
}

// Sync
function getSyncStatus(): Promise<SyncStatus> {
  return request('/api/sync/status')
}

function syncPush(): Promise<{ message: string }> {
  return request('/api/sync/push', { method: 'POST' })
}

function syncPull(): Promise<{ message: string }> {
  return request('/api/sync/pull', { method: 'POST' })
}

function configureSync(config: { provider: string; path: string }): Promise<{ message: string }> {
  return request('/api/sync/configure', {
    method: 'POST',
    body: JSON.stringify(config),
  })
}

// SSE Events
function subscribeEvents(onEvent: (event: SSEEvent) => void): () => void {
  // Ensure base URL is resolved
  initBaseUrl()
  const eventSource = new EventSource(`${getBaseUrl()}/api/events`)

  eventSource.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data as string) as SSEEvent
      onEvent(data)
    } catch {
      // ignore parse errors
    }
  }

  eventSource.onerror = () => {
    // EventSource will auto-reconnect
  }

  return () => eventSource.close()
}

export const backend = {
  startRecording,
  stopRecording,
  getRecordingStatus,
  startMonitoring,
  stopMonitoring,
  getDetectorStatus,
  getMeetings,
  getMeeting,
  deleteMeeting,
  getTranscript,
  getSummary,
  getSentiment,
  transcribeMeeting,
  analyzeMeeting,
  getModels,
  downloadModel,
  getOllamaStatus,
  getSettings,
  updateSettings,
  getAudioDevices,
  getSyncStatus,
  syncPush,
  syncPull,
  configureSync,
  subscribeEvents,
}
