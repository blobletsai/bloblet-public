import OpenAI from 'openai'
import { fal } from '@fal-ai/client'
import { kieNanoBananaEdit, kieSeedreamEdit, fetchBuffer as kieFetchBuffer } from './kie'
import { aiConfig, validateAIConfig } from '../config/ai'

const SEEDREAM_NEGATIVE = 'new character, different species, fur, hair, human anatomy, deformed face, different body shape, missing outline, thicker outline, thin outline, anti-aliased edges, gradients, watercolor, 3D render, photorealism, soft lighting, background, scene, text, watermark, blurry, low-res, noise, artifacts'

export function ensureAiEnv() {
  validateAIConfig()
  fal.config({ credentials: aiConfig.fal.key })
}

export function openaiClient() {
  return new OpenAI({ apiKey: aiConfig.openai.apiKey })
}

export async function nbEditImage(sourceUrl: string, prompt: string) {
  return kieNanoBananaEdit({ sourceUrl, prompt, imageSize: '1:1', outputFormat: 'png' })
}

export async function qwenEditImage(sourceUrl: string, prompt: string) {
  const composed = prompt.includes('NEGATIVE:')
    ? prompt
    : `${prompt}\nNEGATIVE: ${SEEDREAM_NEGATIVE}`
  return kieSeedreamEdit({
    sourceUrl,
    prompt: composed,
    imageSize: 'square_hd',
    imageResolution: '1K',
    maxImages: 1,
  })
}

export async function briaRemoveBg(imageUrl: string) {
  const result = await fal.subscribe('fal-ai/bria/background/remove', {
    input: { image_url: imageUrl },
    logs: false,
  })
  const url = (result as any)?.data?.image?.url
  if (!url) throw new Error('Bria bg remove missing image url')
  return url
}

export async function fetchBuffer(url: string) {
  return kieFetchBuffer(url)
}
