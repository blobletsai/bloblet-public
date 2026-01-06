import type { ReactNode } from 'react'

export interface InfoPanelProps {
  title: string
  icon: string
  borderColor: string
  gradientFrom: string
  gradientTo: string
  titleColor: string
  children: ReactNode
}

export function InfoPanel({
  title,
  icon,
  borderColor,
  gradientFrom,
  gradientTo,
  titleColor,
  children,
}: InfoPanelProps) {
  return (
    <div
      className="w-[200px] rounded-system-sm border px-system-md py-system-md"
      style={{
        borderColor,
        backgroundImage: `linear-gradient(to bottom right, ${gradientFrom}, ${gradientTo})`,
      }}
    >
      <div className="mb-system-sm flex items-center gap-system-xs">
        <span className="text-[12px]">{icon}</span>
        <span
          className="font-pressstart text-[12px] uppercase tracking-[0.16em]"
          style={{ color: titleColor }}
        >
          {title}
        </span>
      </div>
      <div className="space-y-system-xs text-[12px]">
        {children}
      </div>
    </div>
  )
}
