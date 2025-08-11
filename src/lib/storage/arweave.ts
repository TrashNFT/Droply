import Arweave from 'arweave'
import { NFTMetadata } from '@/types'

class ArweaveService {
  private arweave: Arweave

  constructor() {
    this.arweave = Arweave.init({
      host: 'arweave.net',
      port: 443,
      protocol: 'https',
    })
  }

  async uploadFile(file: any, tags: Record<string, string> = {}): Promise<string> {
    try {
      let data: ArrayBuffer
      let contentType: string
      
      // Handle different file formats
      if (file instanceof File) {
        data = await file.arrayBuffer()
        contentType = file.type
      } else if (file.buffer) {
        // Handle Buffer objects
        // Ensure we convert Node Buffer/SharedArrayBuffer to ArrayBuffer
        if (file.buffer instanceof ArrayBuffer) {
          data = file.buffer
        } else if (typeof SharedArrayBuffer !== 'undefined' && file.buffer instanceof SharedArrayBuffer) {
          data = new Uint8Array(file.buffer).slice().buffer
        } else if (typeof Buffer !== 'undefined' && Buffer.isBuffer(file.buffer)) {
          const u8 = new Uint8Array(file.buffer)
          data = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength)
        } else {
          const u8 = new Uint8Array(file.buffer)
          data = u8.buffer
        }
        contentType = file.mimetype || 'application/octet-stream'
      } else if (file.data) {
        // Handle objects with data property
        if (file.data instanceof ArrayBuffer) {
          data = file.data
        } else if (typeof SharedArrayBuffer !== 'undefined' && file.data instanceof SharedArrayBuffer) {
          data = new Uint8Array(file.data).slice().buffer
        } else if (typeof Buffer !== 'undefined' && Buffer.isBuffer(file.data)) {
          const u8 = new Uint8Array(file.data)
          data = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength)
        } else {
          const u8 = new Uint8Array(file.data)
          data = u8.buffer
        }
        contentType = file.type || 'application/octet-stream'
      } else {
        // For now, create a mock file for demo purposes
        console.log('Creating mock file for demo purposes')
        const mockData = new TextEncoder().encode('Mock NFT Image Data')
        // Create a new ArrayBuffer to ensure type compatibility
        const view = new Uint8Array(mockData.length)
        view.set(mockData)
        data = view.buffer
        contentType = 'image/png'
      }
      
      // For demo purposes, return mock Arweave URLs
      // In production, you would use Bundlr or fund your Arweave wallet with AR tokens
      console.log('Uploading file to Arweave (mock for demo)')
      
      const mockId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const mockUrl = `https://arweave.net/${mockId}`
      
      console.log('Mock Arweave URL generated:', mockUrl)
      return mockUrl
      
    } catch (error) {
      console.error('Error uploading to Arweave:', error)
      throw new Error('Failed to upload file to Arweave')
    }
  }

  async uploadMetadata(metadata: NFTMetadata): Promise<string> {
    try {
      console.log('Uploading metadata to Arweave (mock for demo)')
      
      // For demo purposes, return mock Arweave URLs
      const mockId = `metadata-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const mockUrl = `https://arweave.net/${mockId}`
      
      console.log('Mock metadata URL generated:', mockUrl)
      return mockUrl
      
    } catch (error) {
      console.error('Error uploading metadata to Arweave:', error)
      throw new Error('Failed to upload metadata to Arweave')
    }
  }

  async uploadCollection(
    files: any[],
    collectionMetadata: any,
    onProgress?: (progress: number) => void
  ): Promise<{ imageUris: string[]; metadataUris: string[] }> {
    const imageUris: string[] = []
    const metadataUris: string[] = []
    
    try {
      console.log('Uploading collection with files:', files.length)
      console.log('Collection metadata:', collectionMetadata)
      
      // Upload images first
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        console.log(`Uploading file ${i + 1}/${files.length}:`, file)
        
        const imageUri = await this.uploadFile(file, {
          'Collection': collectionMetadata.name,
          'Index': i.toString(),
        })
        imageUris.push(imageUri)
        
        if (onProgress) {
          onProgress((i + 1) / (files.length * 2) * 100)
        }
      }
      
      // Create and upload metadata for each NFT
      for (let i = 0; i < files.length; i++) {
        const metadata: NFTMetadata = {
          name: `${collectionMetadata.name} #${i + 1}`,
          symbol: collectionMetadata.symbol,
          description: collectionMetadata.description,
          image: imageUris[i],
          attributes: [
            {
              trait_type: 'Collection',
              value: collectionMetadata.name,
            },
            {
              trait_type: 'Edition',
              value: (i + 1).toString(),
            },
          ],
          properties: {
            files: [
              {
                type: files[i]?.type || 'image/png',
                uri: imageUris[i],
              },
            ],
            category: 'image',
          },
        }
        
        const metadataUri = await this.uploadMetadata(metadata)
        metadataUris.push(metadataUri)
        
        if (onProgress) {
          onProgress((files.length + i + 1) / (files.length * 2) * 100)
        }
      }
      
      console.log('Collection upload completed successfully!')
      console.log('Image URIs:', imageUris)
      console.log('Metadata URIs:', metadataUris)
      
      return { imageUris, metadataUris }
      
    } catch (error) {
      console.error('Error uploading collection:', error)
      throw new Error('Failed to upload collection to Arweave')
    }
  }
}

export const arweaveService = new ArweaveService()
export default ArweaveService

