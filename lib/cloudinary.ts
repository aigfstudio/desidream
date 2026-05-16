// lib/cloudinary.ts
import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
  secure: true,
})

export { cloudinary }

// ─── Upload Generated Image ───────────────────────────────────────────────────

export async function uploadGeneratedImage(
  base64Data: string,
  faceLabel: string,
  styleName: string,
  poseName: string,
  jobId: string
): Promise<{ secure_url: string; public_id: string }> {
  const dataUri = `data:image/jpeg;base64,${base64Data}`

  const folder = `aigf/${faceLabel}/${styleName.toLowerCase().replace(/\s+/g, '-')}`

  const result = await cloudinary.uploader.upload(dataUri, {
    folder,
    public_id: `${jobId}`,
    resource_type: 'image',
    overwrite: false,
    tags: [faceLabel, styleName, poseName, 'aigf', 'generated'],
    transformation: [
      { quality: 'auto:good', fetch_format: 'webp' },
    ],
  })

  return {
    secure_url: result.secure_url,
    public_id: result.public_id,
  }
}

// ─── Delete Image ─────────────────────────────────────────────────────────────

export async function deleteImage(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId)
}

// ─── Get Gallery Images ───────────────────────────────────────────────────────

export async function getCloudinaryGallery(
  faceLabel?: string,
  nextCursor?: string
): Promise<{
  images: Array<{ url: string; public_id: string; tags: string[] }>
  next_cursor: string | null
}> {
  const expression = faceLabel
    ? `folder:aigf/${faceLabel}/*`
    : `folder:aigf/*`

  const result = await cloudinary.search
    .expression(expression)
    .sort_by('created_at', 'desc')
    .max_results(50)
    .next_cursor(nextCursor ?? '')
    .with_field('tags')
    .execute()

  return {
    images: result.resources.map((r: any) => ({
      url: r.secure_url,
      public_id: r.public_id,
      tags: r.tags ?? [],
    })),
    next_cursor: result.next_cursor ?? null,
  }
}

// ─── Bulk Delete by Folder ────────────────────────────────────────────────────

export async function deleteFolder(folderPath: string): Promise<void> {
  await cloudinary.api.delete_resources_by_prefix(folderPath)
  await cloudinary.api.delete_folder(folderPath)
}
