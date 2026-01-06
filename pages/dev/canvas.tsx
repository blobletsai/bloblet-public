import dynamic from 'next/dynamic'

// Dev-only page that hosts the legacy OrganicCanvas2D playground.
// Production homepage uses BlobletsCanvas; this stays as a sandbox only.

const CanvasPlayground = dynamic(() => import('@/components/CanvasPlayground'), { ssr: false })

export default function DevCanvasPage() {
  return <CanvasPlayground />
}
