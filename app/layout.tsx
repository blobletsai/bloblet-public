import './globals.css'
import type { Metadata } from 'next'
import dynamic from 'next/dynamic'

export const metadata: Metadata = {
  title: 'Bloblets',
  description: 'AI Token Pets — chat with Bloblets',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // This layout is for app router pages (/bloblet/[address])
  // Homepage uses pages router with its own _app.tsx provider
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  )
}
