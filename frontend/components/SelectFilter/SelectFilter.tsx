interface Option {
    label: string;
    value: string | number;
}

interface SelectFilterProps {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    title?: string;
}

export default function SelectFilter({ options, value, onChange, placeholder, className, disabled, title }: SelectFilterProps) {
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            title={title}
            className={`bg-slate-950 border border-slate-800 focus:border-blue-500 text-slate-300 text-sm rounded-xl px-3.5 py-2.5 focus:outline-none transition duration-150 cursor-pointer hover:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-slate-800 ${className}`}
        >
            {placeholder && <option value="">{placeholder}</option>}
            {options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                    {opt.label}
                </option>
            ))}
        </select>
    )
}