import { useEffect, useState } from 'react'
import { Download, Check, Loader2 } from 'lucide-react'
import { backend } from '../hooks/useBackend'
import type { ModelInfo } from '../types'

const MODEL_DESCRIPTIONS: Record<string, string> = {
  tiny: 'Very fast, English only. ~75MB',
  base: 'Fast with decent accuracy. ~145MB',
  small: 'Balanced speed and accuracy. ~484MB',
  medium: 'Good accuracy, slower. ~1.5GB',
  'large-v3': 'Best accuracy, especially Arabic. ~3.1GB',
}

export default function ModelManager() {
  const [models, setModels] = useState<ModelInfo[]>([])
  const [downloading, setDownloading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    backend.getModels().then(setModels).catch(console.error)
  }, [])

  const handleDownload = async (name: string) => {
    setDownloading(name)
    setError(null)
    try {
      await backend.downloadModel(name)
      const updated = await backend.getModels()
      setModels(updated)
    } catch (err) {
      setError(`Failed to download ${name}`)
      console.error(err)
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-zinc-200">Whisper Models</h3>
      <p className="text-xs text-zinc-500">
        Download speech recognition models. Larger models are more accurate but slower.
      </p>

      {error && (
        <div className="rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</div>
      )}

      <div className="space-y-2">
        {models.map((model) => (
          <div
            key={model.name}
            className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-800/30 px-4 py-3"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-zinc-200">{model.name}</span>
                <span className="text-xs text-zinc-500">{model.size}</span>
              </div>
              <p className="mt-0.5 text-xs text-zinc-500">
                {MODEL_DESCRIPTIONS[model.name] ?? model.description}
              </p>
            </div>
            <div>
              {model.downloaded ? (
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-400">
                  <Check className="h-3 w-3" />
                  Downloaded
                </span>
              ) : downloading === model.name ? (
                <span className="flex items-center gap-1.5 text-xs text-blue-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Downloading...
                </span>
              ) : (
                <button
                  onClick={() => handleDownload(model.name)}
                  className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
                >
                  <Download className="h-3 w-3" />
                  Download
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
