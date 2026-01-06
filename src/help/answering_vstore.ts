import OpenAI from 'openai'
import { aiConfig } from '../config/ai'
import { appConfig } from '../config/app'

type Audience = 'player' | 'team'

function chooseModel(): { id: string } {
  // Prefer explicit HELP_MODEL, then OPENAI_MODEL_DEFAULT; default to gpt-5-mini
  const explicit = aiConfig.help.model
  if (explicit) return { id: explicit }
  const env = aiConfig.openai.modelDefault
  const id = env && env.startsWith('gpt-5') ? env : 'gpt-5-mini'
  return { id }
}

function maxOutputTokens(): number {
  const raw = aiConfig.help.maxOutputTokens
  return Number.isFinite(raw) && raw > 50 ? Math.min(800, Math.floor(raw)) : 220
}

function systemPrompt(audience: Audience): string {
  const base = [
    'You are a concise, accurate help assistant for Bloblets.',
    'Player-friendly tone: explain in simple language for casual players; avoid formulas/equations and code-like notation.',
    'Use only facts present in retrieved sources; if a detail is not present, say "Not specified."',
    'Keep answers under 120 words formatted as 3–6 short bullet points. Do NOT include a "Sources:" line; the UI renders sources from citations.',
    'Ask one brief clarifying question only if the query is ambiguous.'
  ]
  if (audience === 'player') {
    base.unshift('Player audience — do not include stack/infra details in answers.')
  } else {
    base.unshift('Team audience — avoid secrets; do not print env values.')
  }
  return base.join('\n')
}

function extractText(resp: any): string {
  if (resp && typeof resp.output_text === 'string' && resp.output_text.trim()) return resp.output_text
  const chunks: string[] = []
  const out = (resp as any)?.output
  if (Array.isArray(out)) {
    for (const it of out) {
      const content = (it && (it.content || it.output || [])) || []
      if (Array.isArray(content)) {
        for (const p of content) {
          const t = (p && (p.text || p.output_text || p.content)) || ''
          if (typeof t === 'string' && t.trim()) chunks.push(t)
        }
      } else if (typeof it.text === 'string' && it.text.trim()) {
        chunks.push(it.text)
      }
    }
  }
  return chunks.join(' ').trim()
}

export async function answerWithVectorStore({
  audience = 'player',
  message,
  previousResponseId,
}: {
  audience?: Audience
  message: string
  previousResponseId?: string | null
}): Promise<{ text: string; conversationId: string; usage?: any; sources: string[] }> {
  const client = new OpenAI({ apiKey: aiConfig.openai.apiKey })
  const model = chooseModel()
  const vsId = aiConfig.help.vectorStoreId
  if (!vsId) throw new Error('vector_store_id_missing')

  // Fixed caps (simple, no extra envs)
  const maxResults = 3
  const scoreThreshold = 0.5

  const req: any = {
    model: model.id,
    instructions: systemPrompt(audience),
    input: [{ role: 'user', content: [{ type: 'input_text', text: message }] }],
    tools: [{
      type: 'file_search',
      vector_store_ids: [vsId],
      max_num_results: maxResults,
      ranking_options: { score_threshold: scoreThreshold },
    }],
    text: { verbosity: 'low' },
    truncation: 'auto',
    parallel_tool_calls: false,
  }
  // Reasoning effort 'low' is allowed with tools; avoid 'minimal' with tools
  req.reasoning = { effort: 'low' }
  // One-shot: do not send previous_response_id

  function extractSources(resp: any): string[] {
    try {
      const out = Array.isArray(resp?.output) ? resp.output : []
      const files = new Set<string>()
      for (const it of out) {
        if (it?.type === 'message' && Array.isArray(it?.content)) {
          for (const part of it.content) {
            const ann = Array.isArray(part?.annotations) ? part.annotations : []
            for (const a of ann) {
              if (a?.type === 'file_citation' && a?.filename) files.add(String(a.filename))
            }
          }
        }
      }
      return Array.from(files)
    } catch { return [] }
  }

  function mapToPublicDocUrls(filenames: string[]): string[] {
    const base = appConfig.urls.docs
    const urls = new Set<string>()
    for (const fn of filenames) {
      const name = String(fn || '').toLowerCase()
      if (!name) continue
      if (name.includes('quickstart')) urls.add(`${base}/quickstart`)
      else if (name.includes('01-gameplay') || name.includes('gameplay_rules') || name.includes('gameplay')) urls.add(`${base}/01-gameplay/rules`)
      else if (name.includes('02-economy') || name.includes('economy_rules')) urls.add(`${base}/02-economy/rules`)
      else if (name.includes('tokenomics')) urls.add(`${base}/02-economy/tokenomics`)
      else if (name.includes('faq')) urls.add(`${base}/faq`)
      else if (name.includes('treasury')) urls.add(`${base}/05-security/01-treasury-policy`)
      else if (name.includes('bible') || name.includes('handbook') || name.includes('help-docs')) urls.add(base)
    }
    return Array.from(urls)
  }

  try {
    const resp = await client.responses.create(req)
    const primaryText = extractText(resp)
    if (primaryText && primaryText.trim()) {
      const filenames = extractSources(resp)
      return {
        text: primaryText,
        conversationId: (resp as any).id,
        usage: (resp as any).usage,
        sources: mapToPublicDocUrls(filenames),
      }
    }
    // If SDK returns an object without output_text, retry via HTTP to get raw JSON
    const r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${aiConfig.openai.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error((j as any)?.error?.message || `openai_http_${r.status}`)
    const filenames = extractSources(j)
    return { text: extractText(j), conversationId: (j as any).id || '', usage: (j as any).usage, sources: mapToPublicDocUrls(filenames) }
  } catch (e) {
    // Plain fetch fallback
    const r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${aiConfig.openai.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error((j as any)?.error?.message || `openai_http_${r.status}`)
    const filenames = extractSources(j)
    return { text: extractText(j), conversationId: (j as any).id || '', usage: (j as any).usage, sources: mapToPublicDocUrls(filenames) }
  }
}
