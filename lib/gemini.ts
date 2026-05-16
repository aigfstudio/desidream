// lib/gemini.ts
import { GoogleGenerativeAI, Part } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// Model that supports image input + image generation output
const MODEL = 'gemini-2.0-flash-exp-image-generation'

// ─── Core Generate Function ───────────────────────────────────────────────────

export async function generateImageWithFace(
  faceBase64: string,
  faceMediaType: string = 'image/jpeg',
  promptText: string,
  styleName: string
): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      // @ts-ignore — responseModalities is supported in gemini-2.0
      responseModalities: ['Text', 'Image'],
    },
  })

  const systemInstruction = `You are a professional AI image generator for an AI girlfriend app.
Your task is to generate a new image of the SAME person shown in the reference photo.
CRITICAL RULES:
- Keep the person's face, facial features, skin tone, and eye color EXACTLY the same
- Only change the style, background, clothing, pose, and artistic treatment
- The output must be a high-quality image, not a description
- Style to apply: ${styleName}`

  const parts: Part[] = [
    {
      inlineData: {
        mimeType: faceMediaType as 'image/jpeg' | 'image/png' | 'image/webp',
        data: faceBase64,
      },
    },
    {
      text: `${systemInstruction}\n\nGenerate image: ${promptText}. Keep this person's exact facial features.`,
    },
  ]

  const result = await model.generateContent(parts)
  const response = result.response

  // Find image part in response
  for (const candidate of response.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      if (part.inlineData?.mimeType?.startsWith('image/')) {
        return part.inlineData.data // base64 image data
      }
    }
  }

  throw new Error('Gemini did not return an image. Response: ' + JSON.stringify(response))
}

// ─── Retry Wrapper ────────────────────────────────────────────────────────────

export async function generateWithRetry(
  faceBase64: string,
  faceMediaType: string,
  promptText: string,
  styleName: string,
  maxRetries = 3
): Promise<string> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await generateImageWithFace(
        faceBase64,
        faceMediaType,
        promptText,
        styleName
      )
      return result
    } catch (err: any) {
      lastError = err
      console.error(`[Gemini] Attempt ${attempt}/${maxRetries} failed:`, err.message)

      // Rate limit → wait 60 seconds
      if (err.message?.includes('429') || err.status === 429) {
        console.log('[Gemini] Rate limited. Waiting 60s...')
        await sleep(60_000)
        continue
      }

      // Server error → wait 10 seconds
      if (err.message?.includes('500') || err.status === 500) {
        console.log('[Gemini] Server error. Waiting 10s...')
        await sleep(10_000)
        continue
      }

      // Quota exceeded → wait 2 minutes
      if (err.message?.includes('quota') || err.message?.includes('RESOURCE_EXHAUSTED')) {
        console.log('[Gemini] Quota exceeded. Waiting 2 minutes...')
        await sleep(120_000)
        continue
      }

      // Other error → short wait before retry
      await sleep(5_000 * attempt)
    }
  }

  throw lastError ?? new Error('Max retries exceeded')
}

// ─── Cost Estimation ──────────────────────────────────────────────────────────

// Gemini 2.0 Flash pricing (approximate)
const COST_PER_IMAGE_INPUT_USD = 0.0001  // image input token cost
const COST_PER_IMAGE_OUTPUT_USD = 0.04   // image generation cost

export function estimateCost(jobCount: number): number {
  return jobCount * (COST_PER_IMAGE_INPUT_USD + COST_PER_IMAGE_OUTPUT_USD)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function detectMimeType(base64OrUrl: string): string {
  if (base64OrUrl.startsWith('/9j/')) return 'image/jpeg'
  if (base64OrUrl.startsWith('iVBOR')) return 'image/png'
  if (base64OrUrl.startsWith('UklGR')) return 'image/webp'
  return 'image/jpeg' // default
}
