interface AudioLevelMeterProps {
  level: number
  compact?: boolean
}

export default function AudioLevelMeter({ level, compact = true }: AudioLevelMeterProps) {
  const clampedLevel = Math.max(0, Math.min(1, level))

  const getColor = (l: number): string => {
    if (l < 0.5) return 'bg-emerald-500'
    if (l < 0.8) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  return (
    <div
      className={`overflow-hidden rounded-full bg-zinc-700 ${compact ? 'h-1.5 w-16' : 'h-2.5 w-full'}`}
    >
      <div
        className={`h-full rounded-full transition-all duration-100 ease-out ${getColor(clampedLevel)}`}
        style={{ width: `${clampedLevel * 100}%` }}
      />
    </div>
  )
}
