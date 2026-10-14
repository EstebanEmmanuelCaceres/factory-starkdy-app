interface SubtitleH2Props {
    title: string
}

export default function SubtitleH2({ title }: SubtitleH2Props) {
    return (
        <h2 className="text-lg md:text-2xl font-bold text-white tracking-tight">
            {title}
        </h2>
    )
}