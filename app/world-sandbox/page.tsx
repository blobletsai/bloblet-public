import { WorldSandboxCanvas } from './client-components'

export const dynamic = 'force-dynamic'

export default function WorldSandboxPage() {
  return (
    <main className="p-4">
      <div className="mb-3 text-sm text-gray-400">World Sandbox (procedural, no backend)</div>
      <WorldSandboxCanvas />
    </main>
  )}
