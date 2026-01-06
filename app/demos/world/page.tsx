import { WorldStrip } from './client-components'

export const dynamic = 'force-dynamic'

export default function WorldDemoPage() {
  return (
    <main className="p-4">
      <div className="mb-2 text-sm text-gray-400">World Demo · Deterministic Soccer Sim</div>
      <div className="w-full max-w-4xl aspect-video border border-slate-800 rounded overflow-hidden">
        <WorldStrip />
      </div>
    </main>
  )
}
