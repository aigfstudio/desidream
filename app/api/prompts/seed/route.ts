import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const DEFAULT_PROMPTS = [
  { style_name: 'Realistic', pose_name: 'Casual Smile', prompt_text: 'Ultra-realistic portrait, soft studio lighting, casual warm smile, bokeh background, 4K quality, photorealistic skin texture' },
  { style_name: 'Anime', pose_name: 'Looking Away', prompt_text: 'Anime art style, cel-shaded illustration, looking to the side pensively, soft pastel background, detailed flowing hair, Studio Ghibli quality' },
  { style_name: 'Oil Painting', pose_name: 'Regal Seated', prompt_text: 'Classical oil painting style, seated pose, regal elegant posture, Renaissance-era aesthetic, rich warm tones, Rembrandt lighting' },
  { style_name: 'Cyberpunk', pose_name: 'City Night', prompt_text: 'Cyberpunk aesthetic, neon-lit city background, night scene, glowing cybernetic accents, futuristic street fashion, rain reflections' },
  { style_name: 'Watercolor', pose_name: 'Outdoor Garden', prompt_text: 'Soft watercolor painting, outdoor garden setting, natural golden lighting, flowy summer dress, pastel color palette, impressionistic style' },
  { style_name: 'Studio Photo', pose_name: 'Professional Headshot', prompt_text: 'Professional headshot photography, clean white background, business casual attire, confident warm expression, sharp focus, commercial quality' },
  { style_name: 'Fantasy', pose_name: 'Warrior Stance', prompt_text: 'High fantasy digital art, powerful warrior stance, ornate armor and weapon, dramatic cinematic lighting, epic mountain landscape background' },
  { style_name: 'Vintage Film', pose_name: 'Candid Laughing', prompt_text: '1970s vintage film grain aesthetic, candid authentic laughing moment, warm golden Kodachrome tones, natural outdoor summer light' },
  { style_name: 'Streetwear', pose_name: 'Urban Cool', prompt_text: 'Modern streetwear fashion editorial, urban city setting, graffiti mural wall, cool confident pose, golden hour photography' },
  { style_name: 'Ethereal', pose_name: 'Eyes Closed Peaceful', prompt_text: 'Ethereal dreamy soft portrait, gentle glow, eyes closed in peace, floating cherry blossoms, pastel purple and pink tones' },
  { style_name: 'Black and White', pose_name: 'Dramatic Shadow', prompt_text: 'High contrast black and white portrait photography, dramatic Rembrandt shadows, moody introspective expression, cinematic framing' },
  { style_name: 'Cottage Core', pose_name: 'Reading in Nature', prompt_text: 'Cottage core aesthetic, reading a leather book in a sunlit meadow, white floral dress, soft warm morning sunlight, wildflowers' },
  { style_name: 'Korean Drama', pose_name: 'Shy Smile', prompt_text: 'Korean drama style portrait, soft dewy glass skin, shy warm smile, pink cherry blossom tree background, clean beauty makeup' },
  { style_name: 'Futuristic', pose_name: 'Holographic', prompt_text: 'Sci-fi futuristic portrait, holographic digital overlays, sleek metallic bodysuit, deep space nebula background, digital glitch effects' },
  { style_name: 'Impressionist', pose_name: 'Walking in Rain', prompt_text: 'French Impressionist painting style, walking with umbrella in rain, cobblestone Paris street, Monet-inspired color palette' },
  { style_name: 'Gothic', pose_name: 'Mysterious', prompt_text: 'Gothic dark romantic portrait, dramatic dark makeup, mysterious alluring expression, old stone castle background, candlelight' },
  { style_name: 'Boho', pose_name: 'Sunset Beach', prompt_text: 'Bohemian free-spirit style, golden sunset beach, flowy linen clothes, warm orange golden hour glow, relaxed carefree pose' },
  { style_name: 'Pop Art', pose_name: 'Bold Graphic', prompt_text: 'Andy Warhol pop art style, bold saturated block colors, halftone dot pattern, graphic comic outlines, vibrant neon background' },
  { style_name: 'Cinematic', pose_name: 'Action Scene', prompt_text: 'Hollywood blockbuster cinematic portrait, action hero pose, dramatic directional lighting, shallow depth of field, motion blur' },
  { style_name: 'Minimalist', pose_name: 'Clean Aesthetic', prompt_text: 'Ultra minimalist portrait, pure white seamless background, simple monochrome outfit, perfect even lighting, no clutter, high-end fashion editorial' }
]

export async function POST() {
  try {
    const { error } = await supabaseAdmin.from('prompts').insert(DEFAULT_PROMPTS)
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, count: DEFAULT_PROMPTS.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
