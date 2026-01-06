"use client"

import React from 'react'

export type EnergizeToast = { id: string; icon: string; message: string }

type EnergizeToastsProps = {
  toasts: EnergizeToast[]
}

export const EnergizeToasts: React.FC<EnergizeToastsProps> = ({ toasts }) => {
  if (toasts.length === 0) return null
  return (
    <div className="pointer-events-none absolute bottom-10 right-10 z-30 flex flex-col gap-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="flex items-center gap-2 rounded-2xl border border-[rgba(148,93,255,0.35)] bg-gradient-to-r from-[rgba(255,134,230,0.16)] to-[rgba(140,231,255,0.18)] px-4 py-2 text-[11px] text-white shadow-[0_12px_30px_rgba(12,2,28,0.45)]"
        >
          <span>{toast.icon}</span>
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  )
}
