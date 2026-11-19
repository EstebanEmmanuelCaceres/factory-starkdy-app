'use client'

export interface FieldProps {
  label: string
  value: string
  disabled?: boolean
  multiline?: boolean
  type?: 'text' | 'email' | 'number'
  required?: boolean
  placeholder?: string
  className?: string
  onChange?: (value: string) => void
}

export default function Field({
  label,
  value,
  disabled = true,
  multiline,
  type = 'text',
  required = false,
  placeholder,
  className = '',
  onChange,
}: FieldProps) {
  const inputClasses = disabled
    ? 'w-full bg-slate-950/50 border border-slate-850 rounded-lg px-3.5 py-2 text-xs text-slate-300 focus:outline-none disabled:cursor-not-allowed disabled:opacity-80'
    : 'w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500 transition'

  return (
    <div className={className}>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
        {label}
        {!disabled && required && <span className="text-rose-400 ml-1">*</span>}
      </label>
      {multiline ? (
        <textarea
          rows={3}
          disabled={disabled}
          required={!disabled && required}
          placeholder={!disabled ? placeholder : undefined}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className={`${inputClasses} resize-none ${disabled ? 'italic' : ''}`}
        />
      ) : (
        <input
          type={type}
          disabled={disabled}
          required={!disabled && required}
          placeholder={!disabled ? placeholder : undefined}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className={inputClasses}
        />
      )}
    </div>
  )
}
