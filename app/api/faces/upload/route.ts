import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, uploadFaceToStorage } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const files = formData.getAll('files') as File[]

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    let uploadedCount = 0

    // Sequential upload or `Promise.all` depending on rate limits
    for (const file of files) {
      const label = `face_${Date.now()}_${Math.random().toString(36).substring(7)}`
      
      // Upload to Supabase Storage
      const storageUrl = await uploadFaceToStorage(file, label)

      // Insert into faces table
      const { error } = await supabaseAdmin.from('faces').insert({
        label,
        storage_url: storageUrl,
        status: 'pending',
      })

      if (error) {
        console.error('Failed to insert face record:', error.message)
      } else {
        uploadedCount++
      }
    }

    return NextResponse.json({ success: true, uploaded: uploadedCount })
  } catch (err: any) {
    console.error('[Upload]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
