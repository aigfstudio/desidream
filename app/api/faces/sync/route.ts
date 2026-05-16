import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Sync faces from Supabase Storage bucket "aigf" → faces table
export async function POST() {
  try {
    // List all files in the aigf bucket
    const { data: files, error: listErr } = await supabaseAdmin.storage
      .from('aigf')
      .list('', { limit: 200 })

    if (listErr) {
      return NextResponse.json({ error: listErr.message }, { status: 500 })
    }

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files found in the aigf bucket. Please upload face images first.' }, { status: 400 })
    }

    // Get existing face storage_urls to avoid duplicates
    const { data: existingFaces } = await supabaseAdmin
      .from('faces')
      .select('storage_url')

    const existingUrls = new Set((existingFaces || []).map(f => f.storage_url))

    let synced = 0
    const imageExts = ['jpg', 'jpeg', 'png', 'webp', 'JPG', 'JPEG', 'PNG', 'WEBP']

    for (const file of files) {
      // Only process image files
      const ext = file.name.split('.').pop() || ''
      if (!imageExts.includes(ext)) continue

      const { data: urlData } = supabaseAdmin.storage
        .from('aigf')
        .getPublicUrl(file.name)

      const publicUrl = urlData.publicUrl

      // Skip if already in faces table
      if (existingUrls.has(publicUrl)) continue

      const label = file.name.split('.')[0] // use filename as label

      const { error: insertErr } = await supabaseAdmin
        .from('faces')
        .insert({
          label: label || `face_${synced + 1}`,
          storage_url: publicUrl,
          status: 'pending',
        })

      if (!insertErr) synced++
    }

    return NextResponse.json({
      success: true,
      synced,
      total: files.filter(f => imageExts.includes(f.name.split('.').pop() || '')).length,
      message: `Synced ${synced} new face(s) from Supabase Storage`,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
