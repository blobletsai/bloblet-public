import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

export async function getServerSideProps() {
  if (process.env.ENABLE_TEST_PAGES !== 'true' && process.env.NODE_ENV !== 'development') {
    return { notFound: true }
  }

  return { props: {} }
}

export default function TestRealtime() {
  const [events, setEvents] = useState<any[]>([])
  const [status, setStatus] = useState('Initializing...')

  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      setStatus('Missing Supabase credentials')
      return
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    setStatus('Connecting to realtime...')

    const channel = supabase
      .channel('test-channel')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'bloblets' 
        },
        (payload) => {
          console.log('Realtime event:', payload)
          setEvents(prev => [...prev, {
            time: new Date().toLocaleTimeString(),
            type: payload.eventType,
            data: payload
          }])
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status)
        if (status === 'SUBSCRIBED') {
          setStatus('✅ Connected to realtime')
        } else if (status === 'CHANNEL_ERROR') {
          setStatus('❌ Channel error')
        } else if (status === 'TIMED_OUT') {
          setStatus('❌ Connection timed out')
        } else {
          setStatus(`Status: ${status}`)
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>Realtime Test Page</h1>
      <p>Status: {status}</p>
      <p>Supabase URL: {process.env.NEXT_PUBLIC_SUPABASE_URL || 'Not set'}</p>
      <p>Has Anon Key: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Yes' : 'No'}</p>
      
      <h2>Events ({events.length})</h2>
      <div style={{ maxHeight: '400px', overflow: 'auto', border: '1px solid #ccc', padding: '10px' }}>
        {events.length === 0 ? (
          <p>No events yet. Make a change to the bloblets table to test.</p>
        ) : (
          events.map((evt, i) => (
            <div key={i} style={{ marginBottom: '10px', borderBottom: '1px solid #eee' }}>
              <strong>{evt.time} - {evt.type}</strong>
              <pre>{JSON.stringify(evt.data, null, 2)}</pre>
            </div>
          ))
        )}
      </div>
      
      <button 
        onClick={async () => {
          const res = await fetch('/api/test-update', { method: 'POST' })
          const data = await res.json()
          console.log('Test update result:', data)
        }}
        style={{ marginTop: '20px', padding: '10px 20px' }}
      >
        Trigger Test Update
      </button>
    </div>
  )
}
