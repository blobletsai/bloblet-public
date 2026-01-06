/**
 * AI Services Configuration
 * Centralizes OpenAI, KIE, FAL, and Vector Store settings.
 */

interface OpenAIConfig {
  apiKey: string
  modelDefault: string
  projectId?: string
}

interface HelpConfig {
  vectorStoreId: string
  maxOutputTokens: number
  model: string
}

interface AIConfig {
  openai: OpenAIConfig
  kie: {
    apiKey: string
  }
  fal: {
    key: string
  }
  help: HelpConfig
}

function readEnv(key: string, fallback = ''): string {
  return (process.env[key] || fallback).trim()
}

export const aiConfig: AIConfig = {
  openai: {
    apiKey: readEnv('OPENAI_API_KEY'),
    modelDefault: readEnv('OPENAI_MODEL_DEFAULT'),
    projectId: readEnv('OPENAI_PROJECT_ID'),
  },
  kie: {
    apiKey: readEnv('KIE_API_KEY'),
  },
  fal: {
    key: readEnv('FAL_KEY'),
  },
  help: {
    vectorStoreId: readEnv('HELP_VECTOR_STORE_ID'),
    maxOutputTokens: Number(process.env.HELP_MAX_OUTPUT_TOKENS || 220),
    model: readEnv('HELP_MODEL'),
  },
}

export function validateAIConfig() {
  const missing = []
  if (!aiConfig.openai.apiKey) missing.push('OPENAI_API_KEY')
  if (!aiConfig.kie.apiKey) missing.push('KIE_API_KEY')
  if (!aiConfig.fal.key) missing.push('FAL_KEY')
  
  if (missing.length > 0) {
    throw new Error(`Missing AI configuration keys: ${missing.join(', ')}`)
  }
}
