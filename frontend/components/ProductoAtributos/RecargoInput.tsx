'use client'

import { inputClass } from './styles'

interface RecargoInputProps {
  value: number
  onChange: (value: number) => void
  className?: string
}

// Monto en pesos que suma al precio unitario. Vacío equivale a 0 (se ve el placeholder).
export const RecargoInput = ({ value, onChange, className = '' }: RecargoInputProps) => (
  <div className={`relative ${className}`}>
    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">+$</span>
    <input
      type="number"
      min={0}
      step="0.01"
      inputMode="decimal"
      value={value === 0 ? '' : value}
      placeholder="0"
      onChange={(e) => {
        const numero = parseFloat(e.target.value)
        onChange(Number.isFinite(numero) && numero > 0 ? numero : 0)
      }}
      className={`${inputClass} pl-8`}
      aria-label="Recargo"
      title="Recargo en pesos sobre el precio unitario"
    />
  </div>
)
