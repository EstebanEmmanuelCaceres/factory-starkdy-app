
interface ButtonCategoryAddProps {
    label: string
    selected: boolean
    onToggle: () => void
}

export default function ButtonCategoryAdd({ label, selected, onToggle }: ButtonCategoryAddProps) {
    return (
        <button
            type="button"
            onClick={onToggle}
            aria-pressed={selected}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition flex items-center gap-1.5 ${selected
                ? 'bg-blue-500 border-blue-600 text-white shadow-sm'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
        >
            <span>{selected ? '✓' : '+'}</span>
            <span>{label}</span>
        </button>
    )
}