interface Props {
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
  invert?: boolean;
}

export function SectionHeading({ eyebrow, title, description, className = "", invert = false }: Props) {
  const muted = invert ? "text-white/60" : "text-muted";
  return (
    <div className={`flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16 ${className}`}>
      <div>
        {eyebrow && (
          <p className="font-mono text-xs font-bold text-accent uppercase tracking-[0.2em] mb-4">
            {eyebrow}
          </p>
        )}
        <h2 className="text-4xl font-extrabold tracking-tighter">{title}</h2>
      </div>
      {description && (
        <p className={`${muted} max-w-[40ch] text-sm leading-relaxed pb-1`}>{description}</p>
      )}
    </div>
  );
}
