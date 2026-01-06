import type { NextApiRequest, NextApiResponse } from 'next'
import { aiConfig } from '@/src/config/ai'
import { answerWithVectorStore } from '@/src/help/answering_vstore'

type Body = { conversationId?: string | null; audience?: 'player' | 'team'; message?: string }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method_not_allowed' })
  }
  try {
    const t0 = Date.now()
    const vsId = aiConfig.help.vectorStoreId
    if (!vsId) return res.status(500).json({ error: 'vector_store_id_missing' })
    const body = (req.body || {}) as Body
    const audience = body.audience === 'team' ? 'team' : 'player'
    const messageRaw = String(body.message || '').trim()
    if (!messageRaw) return res.status(400).json({ error: 'message_required' })
    const { text, conversationId, sources, usage } = await answerWithVectorStore({
      audience,
      message: messageRaw,
      previousResponseId: body.conversationId || null,
    })
    try { console.log('[help/chat_vstore] ok', { elapsedMs: Date.now() - t0, it: usage?.input_tokens || 0, ot: usage?.output_tokens || 0 }) } catch {}
    return res.status(200).json({ ok: true, conversationId, reply: text, sources, usage })
  } catch (e: any) {
    const msg = e?.message || 'help_chat_vstore_failed'
    try { console.warn('[help/chat_vstore] fail', { detail: msg.slice(0, 120) }) } catch {}
    return res.status(500).json({ error: 'help_chat_vstore_failed', detail: msg.slice(0, 180) })
  }
}
