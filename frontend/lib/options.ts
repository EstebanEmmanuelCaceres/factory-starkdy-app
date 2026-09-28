export type SelectOption<T extends string = string> = {
    value: T
    label: string
}

export function toOptions<T extends string>(
    labels: Record<T, string>,
    config: { exclude?: T[]; format?: (label: string, value: T) => string } = {}
): SelectOption<T>[] {
    const { exclude = [], format } = config

    return (Object.entries(labels) as [T, string][])
        .filter(([value]) => !exclude.includes(value))
        .map(([value, label]) => ({
            value,
            label: format ? format(label, value) : label,
        }))
}