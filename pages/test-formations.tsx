// Test page for triggering formation scenes - Client-side rendered
import { useEffect, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'

// Dev-only page for the legacy OrganicCanvas2D formations sandbox.
// Production homepage uses BlobletsCanvas; keep this as a playground only.

// Import canvas dynamically to avoid SSR issues
const OrganicCanvas2D = dynamic(() => import('../components/OrganicCanvas2D'), {
  ssr: false
})

type Bloblet = {
  address: string
  is_alive: boolean
  tier: 'top' | 'middle' | 'bottom'
  avatar_alive_url_256?: string | null
  is_custom?: boolean | undefined
  name: string | null
  rank: number | null
  percent: number | null
}

export default function TestFormations() {
  // Data state
  const [bloblets, setBloblets] = useState<Bloblet[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Local controls (screen-space single-source parameters)
  const [spritePx, setSpritePx] = useState(48)
  const [letterFactor, setLetterFactor] = useState(14)
  const [spacingFactor, setSpacingFactor] = useState(0.30)
  const [edgePercent, setEdgePercent] = useState(0.40)
  const [targetFraction, setTargetFraction] = useState(0.25)
  const [targetMin, setTargetMin] = useState(300)
  const [targetMax, setTargetMax] = useState(600)
  const [jitterFactor, setJitterFactor] = useState(0.07)
  const [floatersPercent, setFloatersPercent] = useState(0.05)

  // Fetch bloblets data on mount
  const fetchBloblets = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Try to fetch 2000 in one go
      let response = await fetch('/api/test/bloblets?limit=2000')
      
      // If that fails or times out, try chunking
      if (!response.ok) {
        console.log('Fetching in chunks...')
        const chunk1 = await fetch('/api/test/bloblets?limit=1000&offset=0')
        const chunk2 = await fetch('/api/test/bloblets?limit=1000&offset=1000')
        
        if (chunk1.ok && chunk2.ok) {
          const data1 = await chunk1.json()
          const data2 = await chunk2.json()
          setBloblets([...data1.bloblets, ...data2.bloblets])
          setLoading(false)
          return
        } else {
          // Fall back to just first 1000
          if (chunk1.ok) {
            const data = await chunk1.json()
            setBloblets(data.bloblets)
            setLoading(false)
            return
          }
        }
        throw new Error('Failed to fetch bloblets data')
      }
      
      const data = await response.json()
      setBloblets(data.bloblets)
    } catch (err: any) {
      console.error('Error fetching bloblets:', err)
      setError(err.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBloblets()
  }, [fetchBloblets])

  // Initialize window config once data is loaded
  useEffect(() => {
    if (!loading && bloblets.length > 0) {
      try {
        (window as any).__blobFormation = {
          vectorTextEnabled: true,
          fontUrl: 'https://unpkg.com/roboto-fontface@0.10.0/fonts/Roboto/Roboto-Black.ttf',
          spritePx, letterFactor, spacingFactor, edgePercent, targetFraction, targetMin, targetMax,
          jitterFactor, floatersPercent,
          overlapPct: 0.5,  // Default to 50% overlap for dense packing
          useAll: true      // Use all sprites by default
        }
      } catch {}
    }
  }, [loading, bloblets.length, spritePx, letterFactor, spacingFactor, edgePercent, targetFraction, targetMin, targetMax, jitterFactor, floatersPercent])

  // Apply changes live to the global config so new scenes use updated params
  useEffect(() => {
    if (!loading && bloblets.length > 0) {
      try {
        const g: any = (window as any).__blobFormation || {}
        g.spritePx = spritePx
        g.letterFactor = letterFactor
        g.spacingFactor = spacingFactor
        g.edgePercent = edgePercent
        g.targetFraction = targetFraction
        g.targetMin = targetMin
        g.targetMax = targetMax
        g.jitterFactor = jitterFactor
        g.floatersPercent = floatersPercent
        ;(window as any).__blobFormation = g
      } catch {}
    }
  }, [loading, bloblets.length, spritePx, letterFactor, spacingFactor, edgePercent, targetFraction, targetMin, targetMax, jitterFactor, floatersPercent])

  const [status, setStatus] = useState<string>('')
  const [canvasRef, setCanvasRef] = useState<any>(null)

  const triggerScene = async (kind: string) => {
    setStatus(`Triggering ${kind} scene...`)
    
    try {
      // Call our new simple endpoint
      const response = await fetch('/api/scene/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind })
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Use the new canvas API to enqueue scene
        if (canvasRef?.enqueueScene) {
          const result = canvasRef.enqueueScene(data.scene.kind, { ...data.scene, forceAll: true })
          if (result) {
            setStatus(`✅ ${kind} scene triggered successfully!`)
            console.log(`[Test] Scene ${kind} enqueued with payload:`, data.scene)
          } else {
            setStatus(`⚠️ Scene could not be enqueued - orchestrator may not be ready`)
          }
        } else {
          setStatus(`⚠️ Canvas API not ready - waiting for canvas to initialize`)
          console.log('Scene data ready but canvas not initialized:', data.scene)
        }
        
        // Also log scene stats if available
        if (canvasRef?.getSceneStats) {
          const stats = canvasRef.getSceneStats()
          console.log('[Test] Scene stats:', stats)
        }
      } else {
        setStatus(`❌ Failed: ${data.error}`)
      }
    } catch (error: any) {
      setStatus(`❌ Error: ${error.message}`)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl mb-4">Loading bloblets data...</div>
          <div className="text-gray-400">Fetching holder information</div>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl mb-4 text-red-500">Error loading data</div>
          <div className="text-gray-400 mb-4">{error}</div>
          <button
            onClick={() => {
              setError(null)
              fetchBloblets()
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // No data state
  if (bloblets.length === 0) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl mb-4">No bloblets found</div>
          <div className="text-gray-400">Check database connection</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Control Panel */}
      <div className="fixed top-0 left-0 z-50 p-4 bg-gray-900/90 backdrop-blur rounded-br-lg max-w-[380px]">
        <h2 className="text-xl font-bold mb-4">Formation Test Controls</h2>
        <div className="text-xs text-green-400 mb-2">Loaded {bloblets.length} bloblets</div>

        <div className="space-y-2">
          <button
            onClick={() => triggerScene('welcome')}
            className="block w-full px-4 py-2 bg-green-600 hover:bg-green-700 rounded"
          >
            🎉 Welcome Scene
          </button>
          
          <button
            onClick={() => triggerScene('graveyard')}
            className="block w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded"
          >
            ⚰️ Graveyard Scene
          </button>
          
          <button
            onClick={() => triggerScene('trophy')}
            className="block w-full px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded"
          >
            🏆 Trophy Scene
          </button>
        </div>

        {/* Tunable parameters */}
        <div className="mt-4 space-y-3 text-xs">
          <div className="font-semibold text-gray-300">Screen-space Parameters</div>
          <label className="block">
            <span>Sprite Px: {spritePx}px</span>
            <input type="range" min={24} max={72} step={2} value={spritePx}
              onChange={(e) => setSpritePx(Number(e.target.value))}
              className="w-full" />
          </label>
          <label className="block">
            <span>Overlap Percent: {(Number((window as any)?.__blobFormation?.overlapPct ?? 0.2) * 100).toFixed(0)}%</span>
            <input
              type="range"
              min={0}
              max={0.35}
              step={0.01}
              value={(window as any)?.__blobFormation?.overlapPct ?? 0.2}
              onChange={(e) => {
                try {
                  const g: any = (window as any).__blobFormation || {}
                  g.overlapPct = Number(e.target.value)
                  ;(window as any).__blobFormation = g
                } catch {}
                // force small rerender
                setStatus(s => s ? s : '')
              }}
              className="w-full"
            />
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              defaultChecked={Boolean((window as any)?.__blobFormation?.useAll)}
              onChange={(e) => {
                try {
                  const g: any = (window as any).__blobFormation || {}
                  g.useAll = e.target.checked
                  ;(window as any).__blobFormation = g
                } catch {}
                setStatus(s => s ? s : '')
              }}
            />
            <span>Use ALL sprites in shape</span>
          </label>
          <label className="block">
            <span>Letter Factor (× sprite): {letterFactor.toFixed(0)}×</span>
            <input type="range" min={10} max={20} step={1} value={letterFactor}
              onChange={(e) => setLetterFactor(Number(e.target.value))}
              className="w-full" />
          </label>
          <label className="block">
            <span>Spacing Factor: {spacingFactor.toFixed(2)}</span>
            <input type="range" min={0.22} max={0.40} step={0.01} value={spacingFactor}
              onChange={(e) => setSpacingFactor(Number(e.target.value))}
              className="w-full" />
          </label>
          <label className="block">
            <span>Edge Percent: {(edgePercent * 100).toFixed(0)}%</span>
            <input type="range" min={0.2} max={0.6} step={0.01} value={edgePercent}
              onChange={(e) => setEdgePercent(Number(e.target.value))}
              className="w-full" />
          </label>
          <label className="block">
            <span>Target Fraction: {(targetFraction * 100).toFixed(0)}%</span>
            <input type="range" min={0.15} max={0.35} step={0.01} value={targetFraction}
              onChange={(e) => setTargetFraction(Number(e.target.value))}
              className="w-full" />
          </label>
          <div className="flex gap-2">
            <label className="block flex-1">
              <span>Min Targets: {targetMin}</span>
              <input type="range" min={150} max={500} step={10} value={targetMin}
                onChange={(e) => setTargetMin(Number(e.target.value))}
                className="w-full" />
            </label>
            <label className="block flex-1">
              <span>Max Targets: {targetMax}</span>
              <input type="range" min={400} max={800} step={10} value={targetMax}
                onChange={(e) => setTargetMax(Number(e.target.value))}
                className="w-full" />
            </label>
          </div>
          <label className="block">
            <span>Jitter Factor: {jitterFactor.toFixed(2)}</span>
            <input type="range" min={0} max={0.15} step={0.01} value={jitterFactor}
              onChange={(e) => setJitterFactor(Number(e.target.value))}
              className="w-full" />
          </label>
          <label className="block">
            <span>Floaters Percent: {(floatersPercent * 100).toFixed(0)}%</span>
            <input type="range" min={0} max={0.12} step={0.01} value={floatersPercent}
              onChange={(e) => setFloatersPercent(Number(e.target.value))}
              className="w-full" />
          </label>
          <button
            onClick={() => triggerScene('welcome')}
            className="w-full mt-2 px-3 py-2 rounded bg-blue-600 hover:bg-blue-500"
          >
            🔁 Re-run Welcome with current settings
          </button>
        </div>

        {status && (
          <div className="mt-4 p-2 bg-gray-800 rounded text-sm">
            {status}
          </div>
        )}
        
        <div className="mt-4 text-xs text-gray-400">
          <p>• Zoom in to ≥0.6 to see formations</p>
          <p>• Wait 15s between scenes</p>
          <p>• Don&apos;t interact during scenes</p>
        </div>
      </div>

      {/* Canvas - only render when data is ready */}
      <OrganicCanvas2D 
        bloblets={bloblets}
        debug={false}
        onCanvasReady={(api: any) => setCanvasRef(api)}
      />
    </div>
  )
}
