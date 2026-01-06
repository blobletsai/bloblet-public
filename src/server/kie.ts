import 'cross-fetch/polyfill'
import { aiConfig } from '../config/ai'

const KIE_API_BASE = 'https://api.kie.ai/api/v1/jobs'

export type KieCreateTaskInput = Record<string, unknown>

export type KieTaskState = 'waiting' | 'generating' | 'success' | 'fail'

export interface KieTaskRecord {
  taskId: string
  state: KieTaskState
  resultJson?: string | null
  failMsg?: string | null
  failCode?: string | null
}

interface CreateTaskResponse {
  code: number
  msg: string
  data?: { taskId: string; recordId?: string }
}

interface RecordInfoResponse {
  code: number
  msg: string
  data?: {
    taskId: string
    state: KieTaskState
    resultJson?: string | null
    failMsg?: string | null
    failCode?: string | null
  }
}

function ensureKieKey(): string {
  const key = aiConfig.kie.apiKey
  if (!key) throw new Error('Missing KIE_API_KEY')
  return key
}

async function createTask(body: Record<string, unknown>): Promise<string> {
  const res = await fetch(`${KIE_API_BASE}/createTask`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ensureKieKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Kie createTask failed ${res.status}`)
  const json = (await res.json()) as CreateTaskResponse
  const taskId = json?.data?.taskId
  if (!taskId) throw new Error(`Kie createTask missing taskId (${json?.msg || 'unknown error'})`)
  return taskId
}

async function getTask(taskId: string): Promise<KieTaskRecord> {
  const res = await fetch(`${KIE_API_BASE}/recordInfo?taskId=${encodeURIComponent(taskId)}`, {
    headers: { Authorization: `Bearer ${ensureKieKey()}` },
  })
  if (!res.ok) throw new Error(`Kie recordInfo failed ${res.status}`)
  const json = (await res.json()) as RecordInfoResponse
  const data = json?.data
  if (!data) throw new Error(`Kie recordInfo missing data (${json?.msg || 'unknown error'})`)
  return {
    taskId: data.taskId,
    state: data.state,
    resultJson: data.resultJson || null,
    failMsg: data.failMsg || null,
    failCode: data.failCode || null,
  }
}

export interface PollOptions {
  intervalMs?: number
  timeoutMs?: number
}

async function pollTask(taskId: string, options: PollOptions = {}): Promise<string[]> {
  const interval = Math.max(1000, options.intervalMs ?? 5000)
  const timeout = options.timeoutMs ?? 600000
  const started = Date.now()

  while (true) {
    const record = await getTask(taskId)
    if (record.state === 'success') {
      if (!record.resultJson) return []
      try {
        const parsed = JSON.parse(record.resultJson)
        if (Array.isArray(parsed?.resultUrls) && parsed.resultUrls.length) {
          return parsed.resultUrls
        }
        if (parsed?.image?.url) {
          return [parsed.image.url]
        }
      } catch (err) {
        throw new Error(`Kie resultJson parse error: ${(err as Error).message}`)
      }
      return []
    }
    if (record.state === 'fail') {
      throw new Error(`Kie task failed: ${record.failMsg || record.failCode || 'unknown error'}`)
    }
    if (Date.now() - started > timeout) {
      throw new Error('Kie task poll timeout')
    }
    await new Promise((resolve) => setTimeout(resolve, interval))
  }
}

export interface KieNanoBananaOptions {
  sourceUrl: string
  prompt: string
  outputFormat?: 'png' | 'jpeg'
  imageSize?: '1:1' | '9:16' | '16:9' | '3:4' | '4:3' | '3:2' | '2:3' | '5:4' | '4:5' | '21:9' | 'auto'
}

export async function kieNanoBananaEdit(options: KieNanoBananaOptions): Promise<string> {
  const { sourceUrl, prompt, outputFormat = 'png', imageSize = '1:1' } = options
  const taskId = await createTask({
    model: 'google/nano-banana-edit',
    input: {
      prompt,
      image_urls: [sourceUrl],
      num_images: 1,
      output_format: outputFormat,
      image_size: imageSize,
    },
  })
  const urls = await pollTask(taskId)
  const url = urls[0]
  if (!url) throw new Error('Kie nano-banana edit missing image url')
  return url
}

export interface KieSeedreamOptions {
  sourceUrl: string
  prompt: string
  imageSize?:
    | 'square'
    | 'square_hd'
    | 'portrait_4_3'
    | 'portrait_3_2'
    | 'portrait_16_9'
    | 'landscape_4_3'
    | 'landscape_3_2'
    | 'landscape_16_9'
    | 'landscape_21_9'
  imageResolution?: '1K' | '2K' | '4K'
  maxImages?: number
  seed?: number
}

export async function kieSeedreamEdit(options: KieSeedreamOptions): Promise<string> {
  const {
    sourceUrl,
    prompt,
    imageSize = 'square_hd',
    imageResolution = '1K',
    maxImages = 1,
    seed,
  } = options
  const input: Record<string, unknown> = {
    prompt,
    image_urls: [sourceUrl],
    image_size: imageSize,
    image_resolution: imageResolution,
    max_images: Math.min(Math.max(1, maxImages), 6),
  }
  if (seed !== undefined) input.seed = seed
  const taskId = await createTask({
    model: 'bytedance/seedream-v4-edit',
    input,
  })
  const urls = await pollTask(taskId)
  const url = urls[0]
  if (!url) throw new Error('Kie seedream edit missing image url')
  return url
}

export async function fetchBuffer(url: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download fail ${res.status}`)
  const arr = await res.arrayBuffer()
  return Buffer.from(arr)
}

