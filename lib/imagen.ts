// lib/imagen.ts — Stage 2: Image Generation
import { GoogleGenAI } from '@google/genai'
import { sleep } from './gemini'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

export async function generateImagen(
  identityDescription: string,
  promptText: string,
  styleName: string
): Promise<string> {
  const fullPrompt = `Generate a high quality photo of a person. 
IDENTITY LOCK: ${identityDescription}

SCENE AND STYLE:
Action/Pose: ${promptText}
Style/Vibe: ${styleName}

Ensure the person perfectly matches the IDENTITY LOCK description above.`

  const response = await ai.models.generateImages({
    model: 'imagen-4.0-fast-generate-001',
    prompt: fullPrompt,
    config: {
      numberOfImages: 1,
      aspectRatio: '3:4', // Best for portraits
      outputMimeType: 'image/jpeg',
      personGeneration: 'ALLOW_ADULT' // Required for generating real people/faces
    },
  })

  const base64 = response.generatedImages?.[0]?.image?.imageBytes
  if (!base64) {
    throw new Error('Imagen did not return any image data')
  }

  return base64
}

export async function generateImagenWithRetry(
  identityDescription: string,
  promptText: string,
  styleName: string,
  maxRetries = 3
): Promise<string> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await generateImagen(identityDescription, promptText, styleName)
    } catch (err: any) {
      lastError = err
      console.error(`[Imagen] Attempt ${attempt}/${maxRetries} failed:`, err.message)

      if (err.message?.includes('429') || err.status === 429) {
        console.log('[Imagen] Rate limited. Waiting 60s...')
        await sleep(60_000)
        continue
      }
      if (err.message?.includes('500') || err.status === 500) {
        console.log('[Imagen] Server error. Waiting 10s...')
        await sleep(10_000)
        continue
      }
      if (err.message?.includes('quota') || err.message?.includes('RESOURCE_EXHAUSTED')) {
        console.log('[Imagen] Quota exceeded. Waiting 2 minutes...')
        await sleep(120_000)
        continue
      }

      await sleep(5_000 * attempt)
    }
  }

  throw lastError ?? new Error('Max retries exceeded for Imagen')
}
