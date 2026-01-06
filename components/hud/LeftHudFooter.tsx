"use client"

import React, { ReactNode } from 'react'

type LeftHudFooterProps = {
  locateButton?: ReactNode
  soundToggle?: ReactNode
}

export const LeftHudFooter: React.FC<LeftHudFooterProps> = ({
  locateButton,
  soundToggle,
}) => {
  return (
    <div className="pointer-events-none fixed left-6 bottom-6 z-30 flex flex-col gap-3 items-start">
      <div className="pointer-events-auto flex flex-col gap-3">
        {/* Stack them vertically from bottom up: Locate -> Sound */}
        {soundToggle}
        {locateButton}
      </div>
    </div>
  )
}
