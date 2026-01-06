'use client'

import dynamic from 'next/dynamic'

export const WorldSandboxCanvas = dynamic(() => import('@/components/WorldSandboxCanvas2D'), { ssr: false })