'use client'

import dynamic from 'next/dynamic'

export const WorldStrip = dynamic(() => import('@/components/WorldStrip'), { ssr: false })