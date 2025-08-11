import { NextRequest, NextResponse } from 'next/server'
import { uploadFile } from '@/lib/arweave/client'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file size
    const maxSize = parseInt(process.env.MAX_FILE_SIZE || '10485760') // 10MB default
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large' },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedTypes = process.env.ALLOWED_FILE_TYPES?.split(',') || [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp'
    ]
    
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type' },
        { status: 400 }
      )
    }

    // Upload to Arweave
    const result = await uploadFile(file, {
      'Content-Type': file.type,
      'User-Agent': 'Solana-NFT-Launchpad',
      'App-Name': 'Solana-NFT-Launchpad',
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    )
  }
}


