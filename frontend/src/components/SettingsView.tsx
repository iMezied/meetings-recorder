import { useState, useEffect } from 'react'
import {
  Settings,
  Mic,
  Languages,
  Box,
  Info,
  Volume2,
  Loader2,
} from 'lucide-react'
import { useStore } from '../hooks/useStore'
import { backend } from '../hooks/useBackend'
import type { AudioDevice, ModelInfo } from '../types'
import AudioLevelMeter from './AudioLevelMeter'
import ModelManager from './ModelManager'

type SettingsTab = 'general' | 'audio' | 'transcription' | 'models' | 'about'

const TABS: { key: SettingsTab; label: string; icon: typeof Settings }[] = [
  { key: 'general', label: 'General', icon: Settings },
  { key: 'audio', label: 'Audio', icon: Mic },
  { key: 'transcription', label: 'Transcription', icon: Languages },
  { key: 'models', label: 'Models', icon: Box },
  { key: 'about', label: 'About', icon: Info },
]

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description?: string
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <span className="text-sm text-zinc-200">{label}</span>
        {description && <p className="mt-0.5 text-xs text-zinc-500">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 rounded-full transition-colors ${checked ? 'bg-blue-500' : 'bg-zinc-600'}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${checked ? 'left-[18px]' : 'left-0.5'}`}
        />
      </button>
    </div>
  )
}

function GeneralTab() {
  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)

  if (!settings) return <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />

  const update = async (patch: Partial<typeof settings>) => {
    try {
      const updated = await backend.updateSettings(patch)
      setSettings(updated)
    } catch (err) {
      console.error('Failed to update settings:', err)
    }
  }

  return (
    <div className="space-y-1">
      <Toggle
        checked={settings.launchAtLogin}
        onChange={(v) => update({ launchAtLogin: v })}
        label="Launch at Login"
        description="Start Meeting Recorder when you log in"
      />
      <Toggle
        checked={settings.autoRecord}
        onChange={(v) => update({ autoRecord: v })}
        label="Auto-record on Meeting Detection"
        description="Automatically start recording when a meeting is detected"
      />
      <Toggle
        checked={settings.autoTranscribe}
        onChange={(v) => update({ autoTranscribe: v })}
        label="Auto-transcribe"
        description="Automatically transcribe after recording stops"
      />
      <Toggle
        checked={settings.autoAnalyze}
        onChange={(v) => update({ autoAnalyze: v })}
        label="Auto-analyze"
        description="Automatically generate summary and sentiment after transcription"
      />
      <div className="border-t border-zinc-800 py-3">
        <span className="text-xs font-medium text-zinc-500">Storage Location</span>
        <p className="mt-1 text-sm text-zinc-300">{settings.storageLocation}</p>
      </div>
    </div>
  )
}

function AudioTab() {
  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  const [devices, setDevices] = useState<AudioDevice[]>([])
  const [testLevel, setTestLevel] = useState(0)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    backend.getAudioDevices().then(setDevices).catch(console.error)
  }, [])

  if (!settings) return <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />

  const update = async (patch: Partial<typeof settings>) => {
    try {
      const updated = await backend.updateSettings(patch)
      setSettings(updated)
    } catch (err) {
      console.error('Failed to update settings:', err)
    }
  }

  const handleTestAudio = () => {
    setTesting(true)
    // Simulate audio level testing
    let frame = 0
    const interval = setInterval(() => {
      setTestLevel(Math.random() * 0.8 + 0.1)
      frame++
      if (frame > 30) {
        clearInterval(interval)
        setTesting(false)
        setTestLevel(0)
      }
    }, 100)
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-zinc-400">Audio Device</label>
        <select
          value={settings.audioDevice ?? ''}
          onChange={(e) => update({ audioDevice: e.target.value || null })}
          className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-blue-500"
        >
          <option value="">System Default</option>
          {devices.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} {d.isDefault ? '(Default)' : ''}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-xs font-medium text-zinc-400">Test Audio</label>
          <button
            onClick={handleTestAudio}
            disabled={testing}
            className="flex items-center gap-1 rounded-md bg-zinc-700 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-600 disabled:opacity-50"
          >
            <Volume2 className="h-3 w-3" />
            {testing ? 'Testing...' : 'Test'}
          </button>
        </div>
        <AudioLevelMeter level={testLevel} compact={false} />
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-800/30 p-3">
        <h4 className="mb-1 text-xs font-semibold text-zinc-300">BlackHole Setup</h4>
        <p className="text-xs text-zinc-500">
          To capture system audio, install BlackHole and create a Multi-Output Device in Audio MIDI Setup.
          This routes system audio to the recorder while keeping your speaker output.
        </p>
      </div>
    </div>
  )
}

function TranscriptionTab() {
  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  const [models, setModels] = useState<ModelInfo[]>([])

  useEffect(() => {
    backend.getModels().then(setModels).catch(console.error)
  }, [])

  if (!settings) return <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />

  const downloadedModels = models.filter((m) => m.downloaded)

  const update = async (patch: Partial<typeof settings>) => {
    try {
      const updated = await backend.updateSettings(patch)
      setSettings(updated)
    } catch (err) {
      console.error('Failed to update settings:', err)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-zinc-400">
          faster-whisper Status
        </label>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Available
        </span>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-zinc-400">Whisper Model</label>
        <select
          value={settings.whisperModel}
          onChange={(e) => update({ whisperModel: e.target.value })}
          className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-blue-500"
        >
          {downloadedModels.map((m) => (
            <option key={m.name} value={m.name}>
              {m.name}
            </option>
          ))}
          {downloadedModels.length === 0 && (
            <option disabled>No models downloaded yet</option>
          )}
        </select>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-zinc-400">Language</label>
        <select
          value={settings.language}
          onChange={(e) => update({ language: e.target.value })}
          className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-blue-500"
        >
          <option value="auto">Auto Detect</option>
          <option value="en">English</option>
          <option value="ar">Arabic</option>
        </select>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-zinc-400">
          HuggingFace Token
        </label>
        <input
          type="password"
          value={settings.huggingfaceToken ?? ''}
          onChange={(e) => update({ huggingfaceToken: e.target.value || null })}
          placeholder="hf_..."
          className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-blue-500"
        />
        <p className="mt-1 text-xs text-zinc-500">
          Required for speaker diarization model download.
        </p>
      </div>
    </div>
  )
}

function AboutTab() {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-zinc-200">Meeting Recorder</h3>
        <p className="mt-1 text-xs text-zinc-500">Version 1.0.0</p>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-800/30 p-4">
        <h4 className="mb-1 text-sm font-semibold text-emerald-400">Privacy First</h4>
        <p className="text-xs leading-relaxed text-zinc-400">
          All data stays on your device. Recordings, transcripts, and analysis are processed
          locally using on-device models. Nothing is sent to external servers.
        </p>
      </div>

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Tech Stack
        </h4>
        <div className="space-y-1.5 text-xs text-zinc-400">
          <p>Electron + React + TypeScript (Frontend)</p>
          <p>Python + FastAPI (Backend)</p>
          <p>faster-whisper (Speech Recognition)</p>
          <p>Ollama (LLM Analysis)</p>
          <p>BlackHole (System Audio Capture)</p>
        </div>
      </div>
    </div>
  )
}

export default function SettingsView() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')

  const renderTab = () => {
    switch (activeTab) {
      case 'general':
        return <GeneralTab />
      case 'audio':
        return <AudioTab />
      case 'transcription':
        return <TranscriptionTab />
      case 'models':
        return <ModelManager />
      case 'about':
        return <AboutTab />
    }
  }

  return (
    <div className="flex min-h-0 flex-1">
      {/* Tab sidebar */}
      <div className="w-48 shrink-0 border-r border-zinc-800 bg-zinc-900 py-3">
        {TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-smooth ${
                activeTab === tab.key
                  ? 'bg-zinc-800 text-blue-400'
                  : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-lg">{renderTab()}</div>
      </div>
    </div>
  )
}
