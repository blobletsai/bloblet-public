import Link from 'next/link'

export default function NotFound() {
  return (
    <html>
      <body style={{ color: '#fff', background: '#000', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Inter, Arial' }}>
        <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: 28, marginBottom: 12 }}>Page not found</h1>
            <Link href="/" style={{ color: '#9ae6b4', textDecoration: 'underline' }}>Go home</Link>
          </div>
        </div>
      </body>
    </html>
  )
}
