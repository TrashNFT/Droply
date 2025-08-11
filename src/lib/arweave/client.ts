import Arweave from 'arweave'
import type { ArweaveUploadResult } from '@/types'

const arweave = Arweave.init({
  host: 'arweave.net',
  port: 443,
  protocol: 'https',
})

export const uploadToArweave = async (
  data: Buffer | string,
  contentType: string,
  tags?: Record<string, string>
): Promise<ArweaveUploadResult> => {
  try {
    const transaction = await arweave.createTransaction({
      data: data,
    })

    // Set content type
    transaction.addTag('Content-Type', contentType)

    // Add custom tags
    if (tags) {
      Object.entries(tags).forEach(([key, value]) => {
        transaction.addTag(key, value)
      })
    }

    // Sign the transaction
    const privateKey = process.env.ARWEAVE_PRIVATE_KEY
    if (!privateKey) {
      throw new Error('ARWEAVE_PRIVATE_KEY not found in environment variables')
    }

    // Parse the private key as JSON
    const parsedKey = JSON.parse(privateKey)
    await arweave.transactions.sign(transaction, parsedKey)

    // Submit the transaction
    const response = await arweave.transactions.post(transaction)
    
    if (response.status !== 200 && response.status !== 202) {
      throw new Error(`Failed to upload to Arweave: ${response.statusText}`)
    }

    const url = `https://arweave.net/${transaction.id}`

    return {
      transactionId: transaction.id,
      url,
      size: data.length,
    }
  } catch (error) {
    console.error('Error uploading to Arweave:', error)
    throw new Error(`Failed to upload to Arweave: ${error}`)
  }
}

export const uploadFile = async (
  file: File,
  tags?: Record<string, string>
): Promise<ArweaveUploadResult> => {
  const buffer = await file.arrayBuffer()
  const contentType = file.type || 'application/octet-stream'
  
  return uploadToArweave(Buffer.from(buffer), contentType, tags)
}

export const uploadMetadata = async (
  metadata: any,
  tags?: Record<string, string>
): Promise<ArweaveUploadResult> => {
  const data = JSON.stringify(metadata)
  const contentType = 'application/json'
  
  return uploadToArweave(data, contentType, tags)
}

export const getArweaveUrl = (transactionId: string): string => {
  return `https://arweave.net/${transactionId}`
}

