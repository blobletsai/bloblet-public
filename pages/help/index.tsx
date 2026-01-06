import dynamic from 'next/dynamic'
import React from 'react'

const ChatWidget = dynamic(() => import('@/components/help/ChatWidget').then(m => m.ChatWidget), { ssr: false })

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-[rgba(12,4,26,0.98)] text-white">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="font-pressstart text-[18px] uppercase tracking-[0.18em] text-[#8ff7ff]">Help & FAQ</h1>
        <p className="mt-3 text-[13px] text-[#d7caff]">
          Ask about gameplay, Nourish, loot, battles, BlobCoin, and personalization. Answers cite our docs.
        </p>
        <div className="mt-6 rounded-[18px] border border-[rgba(148,93,255,0.35)] bg-[rgba(20,8,50,0.85)] p-4">
          <ChatWidget bottomOffset={0} />
        </div>
      </div>
    </div>
  )
}
