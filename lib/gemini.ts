// lib/gemini.ts — Stage 1: Face Identity Extraction
import { GoogleGenAI } from '@google/genai'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

// ─── Stage 1: Extract Face Identity ──────────────────────────────────────────
// Analyzes the face photo and returns a detailed text identity description.
// This description is cached in Supabase so the same face is only analyzed ONCE.

export async function extractFaceIdentity(
  faceBase64: string,
  mimeType: string = 'image/jpeg'
): Promise<string> {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: mimeType as 'image/jpeg' | 'image/png' | 'image/webp',
              data: faceBase64,
            },
          },
          {
            text: `Analyze this person's face in extreme detail for AI image generation consistency. 

You must output a single dense paragraph (no bullet points) covering ALL of these:

FACE STRUCTURE: exact face shape (oval/round/square/heart/diamond), jawline definition, cheekbone prominence, forehead width
EYES: exact eye shape (almond/round/hooded/monolid), iris color, eye size, spacing between eyes, eyebrow shape and thickness, any double eyelid
NOSE: bridge width, tip shape, nostril flare, nose length
LIPS: upper and lower lip thickness, cupid's bow definition, natural lip color
SKIN: exact tone using specific descriptors (e.g. "warm golden brown", "fair rosy", "deep mahogany", "olive medium"), undertone (warm/cool/neutral), texture quality
HAIR: exact color (with highlights if any), texture (straight/wavy/curly/coily), length, style
AGE RANGE: approximate range in years
DISTINCTIVE: any moles, dimples, freckles, scars, or unique identifiers

This description will be used as a reference identity lock for generating consistent images of this same person. Be as specific and detailed as possible.`,
          },
        ],
      },
    ],
    config: {
      responseModalities: ['TEXT'],
    },
  })

  const parts = response.candidates?.[0]?.content?.parts ?? []
  const text = parts.find((p: any) => p.text)?.text

  if (!text) {
    throw new Error('Gemini could not extract face identity description')
  }

  return text.trim()
}

// ─── Stage 2 (Alternative): Generate with Gemini ─────────────────────────────────

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
    model: 'gemini-2.5-flash-image', // The correct Gemini generation model
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

  for (const part of response.candidates?.[0]?.content?.parts ?? []) {
    if (part.inlineData?.mimeType?.startsWith('image/')) {
      return part.inlineData.data!
    }
  }

  throw new Error('Gemini did not return an image. Response: ' + JSON.stringify(response))
}

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
      console.error(`[Gemini Gen] Attempt ${attempt}/${maxRetries} failed:`, err.message)
      if (err.message?.includes('429') || err.status === 429) { await sleep(60000); continue }
      if (err.message?.includes('500') || err.status === 500) { await sleep(10000); continue }
      if (err.message?.includes('quota') || err.message?.includes('RESOURCE_EXHAUSTED')) { await sleep(120000); continue }
      await sleep(5000 * attempt)
    }
  }

  throw lastError ?? new Error('Max retries exceeded for Gemini generation')
}

// ─── Cost Estimation ──────────────────────────────────────────────────────────

export function estimateCost(jobCount: number): number {
  // Stage 1: ~0.001 per face analysis (one-time per face, cached)
  // Stage 2: Imagen generation cost
  const IMAGEN_COST = 0.04
  return jobCount * IMAGEN_COST
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function detectMimeType(base64: string): string {
  if (base64.startsWith('/9j/')) return 'image/jpeg'
  if (base64.startsWith('iVBOR')) return 'image/png'
  if (base64.startsWith('UklGR')) return 'image/webp'
  return 'image/jpeg'
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
