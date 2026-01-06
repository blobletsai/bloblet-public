import { useState } from 'react'

export async function getServerSideProps() {
  if (process.env.ENABLE_TEST_PAGES !== 'true' && process.env.NODE_ENV !== 'development') {
    return { notFound: true }
  }

  return { props: {} }
}

export default function TestControls() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [count, setCount] = useState(10)
  const [autoMode, setAutoMode] = useState(false)
  
  const triggerTransitions = async (mode: string) => {
    setLoading(true)
    setResult(null)
    
    try {
      const response = await fetch(`/api/test-transitions?mode=${mode}&count=${count}`, {
        method: 'POST'
      })
      const data = await response.json()
      setResult(data)
    } catch (error: any) {
      setResult({ error: error.message })
    } finally {
      setLoading(false)
    }
  }
  
  // Auto mode for continuous testing
  const startAutoMode = () => {
    setAutoMode(true)
    const interval = setInterval(async () => {
      if (!autoMode) {
        clearInterval(interval)
        return
      }
      await triggerTransitions('random')
    }, 3000)
  }
  
  return (
    <div style={{
      padding: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      maxWidth: '800px',
      margin: '0 auto'
    }}>
      <h1>🎮 Canvas Transition Test Controls</h1>
      
      <div style={{ marginBottom: '20px', padding: '15px', background: '#f0f0f0', borderRadius: '8px' }}>
        <p><strong>Instructions:</strong></p>
        <ol>
          <li>Open the main canvas in another tab/window</li>
          <li>Position the canvas to see some sprites</li>
          <li>Click the buttons below to trigger transitions</li>
          <li>Watch sprites change from alive to dead (and vice versa)</li>
        </ol>
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <label>
          Number of sprites to transition: 
          <input 
            type="number" 
            value={count} 
            onChange={(e) => setCount(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
            min="1"
            max="50"
            style={{ marginLeft: '10px', padding: '5px', width: '60px' }}
          />
        </label>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '20px' }}>
        <button 
          onClick={() => triggerTransitions('toggle')}
          disabled={loading}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.5 : 1
          }}
        >
          🔄 Toggle States
        </button>
        
        <button 
          onClick={() => triggerTransitions('kill')}
          disabled={loading}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            background: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.5 : 1
          }}
        >
          💀 Kill All
        </button>
        
        <button 
          onClick={() => triggerTransitions('revive')}
          disabled={loading}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            background: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.5 : 1
          }}
        >
          ✨ Revive All
        </button>
        
        <button 
          onClick={() => triggerTransitions('random')}
          disabled={loading}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            background: '#8b5cf6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.5 : 1
          }}
        >
          🎲 Random States
        </button>
        
        <button 
          onClick={() => autoMode ? setAutoMode(false) : startAutoMode()}
          disabled={loading}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            background: autoMode ? '#f59e0b' : '#06b6d4',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.5 : 1
          }}
        >
          {autoMode ? '⏸️ Stop Auto' : '▶️ Auto Mode'}
        </button>
      </div>
      
      {loading && (
        <div style={{ padding: '10px', background: '#fef3c7', borderRadius: '6px', marginBottom: '10px' }}>
          ⏳ Triggering transitions...
        </div>
      )}
      
      {result && (
        <div style={{ 
          padding: '15px', 
          background: result.error ? '#fee2e2' : '#d1fae5', 
          borderRadius: '6px',
          marginTop: '20px'
        }}>
          <h3>{result.error ? '❌ Error' : '✅ Success'}</h3>
          {result.error ? (
            <p>{result.error}</p>
          ) : (
            <div>
              <p><strong>Mode:</strong> {result.mode}</p>
              <p><strong>Total sprites:</strong> {result.total}</p>
              <p><strong>Transitioned:</strong> {result.transitioned}</p>
              <p><strong>Skipped (already in target state):</strong> {result.skipped}</p>
              {result.failed > 0 && <p><strong>Failed:</strong> {result.failed}</p>}
              
              <details style={{ marginTop: '10px' }}>
                <summary style={{ cursor: 'pointer' }}>View Details</summary>
                <pre style={{ 
                  background: '#f9fafb', 
                  padding: '10px', 
                  borderRadius: '4px',
                  overflow: 'auto',
                  maxHeight: '200px',
                  fontSize: '12px'
                }}>
                  {JSON.stringify(result.details, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>
      )}
      
      <div style={{ marginTop: '40px', padding: '15px', background: '#f3f4f6', borderRadius: '8px' }}>
        <h3>🧪 What to Look For:</h3>
        <ul>
          <li><strong>Alive → Dead:</strong> Sprites should change to blood/dead version</li>
          <li><strong>Dead → Alive:</strong> Sprites should return to normal appearance</li>
          <li><strong>Realtime:</strong> Changes should appear without page refresh</li>
          <li><strong>Smooth:</strong> Transitions should be immediate (0.5-1s delay max)</li>
        </ul>
        
        <h3>📊 Current Avatar URLs:</h3>
        <ul>
          <li><strong>Alive:</strong> source_mascot_nobg.png</li>
          <li><strong>Dead:</strong> source_mascot_nobg(dead).png</li>
        </ul>
      </div>
    </div>
  )
}
