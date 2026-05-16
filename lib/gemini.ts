// lib/gemini.ts — uses @google/genai (new unified SDK)
import { GoogleGenAI } from '@google/genai'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

// Available image generation models (in order of preference):
// "Nano Banana Pro"  → gemini-3.0-pro-image-generation       (Gemini 3 Pro Image)
// "Nano Banana 2"    → gemini-3.1-flash-image-generation      (Gemini 3.1 Flash Image)
// "Nano Banana"      → gemini-2.5-flash-preview-image-generation (Gemini 2.5 Flash Preview Image)
const MODEL = 'gemini-2.5-flash-preview-image-generation'

// ─── Core Generate Function ───────────────────────────────────────────────────

export async function generateImageWithFace(
  faceBase64: string,
  faceMediaType: string = 'image/jpeg',
  promptText: string,
  styleName: string
): Promise<string> {

  const prompt = `You are a professional AI image generator for an AI girlfriend app.
Generate a new high-quality image of the SAME person shown in the reference photo.
CRITICAL RULES:
- Keep the person's face, skin tone, eye color, and facial features EXACTLY the same
- Only change the style, background, clothing, pose, and artistic treatment
- Output a real image, not a description
- Style to apply: ${styleName}

Generate image: ${promptText}. Preserve this person's exact facial features.`

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: faceMediaType as 'image/jpeg' | 'image/png' | 'image/webp',
              data: faceBase64,
            },
          },
          { text: prompt },
        ],
      },
    ],
    config: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
  })

  // Find image in response parts
  for (const part of response.candidates?.[0]?.content?.parts ?? []) {
    if (part.inlineData?.mimeType?.startsWith('image/')) {
      return part.inlineData.data! // base64 image
    }
  }

  throw new Error('Gemini did not return an image. Response: ' + JSON.stringify(response?.candidates?.[0]?.content?.parts?.map((p: any) => p.text)))
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
      return await generateImageWithFace(faceBase64, faceMediaType, promptText, styleName)
    } catch (err: any) {
      lastError = err
      console.error(`[Gemini] Attempt ${attempt}/${maxRetries} failed:`, err.message)

      if (err.message?.includes('429') || err.status === 429) {
        console.log('[Gemini] Rate limited. Waiting 60s...')
        await sleep(60_000)
        continue
      }
      if (err.message?.includes('500') || err.status === 500) {
        console.log('[Gemini] Server error. Waiting 10s...')
        await sleep(10_000)
        continue
      }
      if (err.message?.includes('quota') || err.message?.includes('RESOURCE_EXHAUSTED')) {
        console.log('[Gemini] Quota exceeded. Waiting 2 minutes...')
        await sleep(120_000)
        continue
      }

      await sleep(5_000 * attempt)
    }
  }

  throw lastError ?? new Error('Max retries exceeded')
}

// ─── Cost Estimation ──────────────────────────────────────────────────────────

const COST_PER_IMAGE_INPUT_USD = 0.0001
const COST_PER_IMAGE_OUTPUT_USD = 0.04

export function estimateCost(jobCount: number): number {
  return jobCount * (COST_PER_IMAGE_INPUT_USD + COST_PER_IMAGE_OUTPUT_USD)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function detectMimeType(base64: string): string {
  if (base64.startsWith('/9j/')) return 'image/jpeg'
  if (base64.startsWith('iVBOR')) return 'image/png'
  if (base64.startsWith('UklGR')) return 'image/webp'
  return 'image/jpeg'
}
