interface Option {
    label: string;
    value: string | number;
}

interface SelectStatusProps {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
}

export default function SelectStatus({ options, value, onChange }: SelectStatusProps) {
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="bg-transparent text-xs font-bold text-blue-400 focus:outline-none cursor-pointer pr-1">
            {options.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-slate-900 text-white">
                    {opt.label}
                </option>
            ))}
        </select>
    )
}