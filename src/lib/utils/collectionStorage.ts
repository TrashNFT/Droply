import type { Collection } from '@/types'

const STORAGE_KEY = 'deployed-collections'

export interface DeployedCollection extends Omit<Collection, 'createdAt' | 'updatedAt'> {
  createdAt: string
  updatedAt: string
}

export function saveDeployedCollection(collection: Collection): void {
  try {
    const existing = getDeployedCollections()
    
    // Convert dates to strings for localStorage
    const collectionToSave: DeployedCollection = {
      ...collection,
      createdAt: collection.createdAt.toISOString(),
      updatedAt: collection.updatedAt.toISOString(),
      standard: collection.standard || 'core',
    }
    
    const updated = [...existing, collectionToSave]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    
    // Trigger storage event for other tabs/components
    window.dispatchEvent(new StorageEvent('storage', {
      key: STORAGE_KEY,
      newValue: JSON.stringify(updated)
    }))
  } catch (error) {
    console.error('Error saving collection:', error)
  }
}

export function getDeployedCollections(): Collection[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return []
    
    const parsed: DeployedCollection[] = JSON.parse(saved)
    
    // Convert string dates back to Date objects
    return parsed.map(collection => ({
      ...collection,
      createdAt: new Date(collection.createdAt),
      updatedAt: new Date(collection.updatedAt),
    }))
  } catch (error) {
    console.error('Error loading collections:', error)
    return []
  }
}

export function removeDeployedCollection(collectionId: string): void {
  try {
    const existing = getDeployedCollections()
    const updated = existing.filter(c => c.id !== collectionId)
    
    const updatedSerialized = updated.map(collection => ({
      ...collection,
      createdAt: collection.createdAt.toISOString(),
      updatedAt: collection.updatedAt.toISOString(),
    }))
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSerialized))
    
    // Trigger storage event
    window.dispatchEvent(new StorageEvent('storage', {
      key: STORAGE_KEY,
      newValue: JSON.stringify(updatedSerialized)
    }))
  } catch (error) {
    console.error('Error removing collection:', error)
  }
}

export function clearAllDeployedCollections(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
    
    // Trigger storage event
    window.dispatchEvent(new StorageEvent('storage', {
      key: STORAGE_KEY,
      newValue: null
    }))
  } catch (error) {
    console.error('Error clearing collections:', error)
  }
}
