'use client'

export interface FieldProps {
  label: string
  value: string
  disabled?: boolean
  multiline?: boolean
  className?: string
  onChange?: (value: string) => void
}

export default function Field({ label, value, disabled = true, multiline, className = '', onChange }: FieldProps) {
  return (
    <div className={className}>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      {multiline ? (
        <textarea
          rows={3}
          disabled={disabled}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className="w-full bg-slate-950/50 border border-slate-850 rounded-lg px-3.5 py-2 text-xs text-slate-300 focus:outline-none disabled:cursor-not-allowed disabled:opacity-80 resize-none italic"
        />
      ) : (
        <input
          type="text"
          disabled={disabled}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className="w-full bg-slate-950/50 border border-slate-850 rounded-lg px-3.5 py-2 text-xs text-slate-300 focus:outline-none disabled:cursor-not-allowed disabled:opacity-80"
        />
      )}
    </div>
  )
}
