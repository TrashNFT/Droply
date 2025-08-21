'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Calendar, Clock, DollarSign, Users, HelpCircle, ChevronDown } from 'lucide-react'
import InfoTooltip from '@/components/ui/InfoTooltip'
import toast from 'react-hot-toast'

interface MintSettingsProps {
  formData: any
  onUpdate: (data: any) => void
  onNext: () => void
  onBack: () => void
  onDeploy: () => void
  isLastStep: boolean
}

export function MintSettings({
  formData,
  onUpdate,
  onNext,
  onBack,
  onDeploy,
  isLastStep,
}: MintSettingsProps) {
  const makeDefaultPublicPhase = () => ({
    id: Math.random().toString(36).slice(2),
    name: 'Public',
    price: 0,
    maxPerWallet: 1,
    startDate: '',
    endDate: '',
    allowlist: [] as string[],
  })

  const [mintSettings, setMintSettings] = useState({
    price: formData.mintSettings?.price ?? 0,
    itemsAvailable: formData.mintSettings?.itemsAvailable || formData.assets?.length || 0,
    sellerFeeBasisPoints: formData.mintSettings?.sellerFeeBasisPoints || 500,
    network: formData.mintSettings?.network || 'mainnet-beta',
    isMutable: formData.mintSettings?.isMutable || true,
    standard: formData.mintSettings?.standard || 'legacy',
    phases: (Array.isArray(formData.mintSettings?.phases) && (formData.mintSettings?.phases as any[]).length > 0)
      ? formData.mintSettings!.phases
      : [makeDefaultPublicPhase()],
    shuffleItems: formData.mintSettings?.shuffleItems || false,
    merkleTreeAddress: formData.mintSettings?.merkleTreeAddress || '',
  })

  const [phaseErrors, setPhaseErrors] = useState<Record<number, { [k: string]: string }>>({})
  const [showPhaseHelp, setShowPhaseHelp] = useState(false)

  const handleInputChange = (field: string, value: any) => {
    const updatedSettings = { ...mintSettings, [field]: value }
    setMintSettings(updatedSettings)
    onUpdate({ mintSettings: updatedSettings })
  }

  const handleNext = () => {
    const errs: Record<number, { [k: string]: string }> = {}
    let hasError = false
    if (mintSettings.itemsAvailable <= 0) {
      toast.error('Total supply must be greater than 0')
      hasError = true
    }
    if (mintSettings.price < 0) {
      toast.error('Price cannot be negative')
      hasError = true
    }
    // Validate phases (optional but if provided, validate fields)
    ;(mintSettings.phases || []).forEach((p: any, idx: number) => {
      const pe: { [k: string]: string } = {}
      if (!p.name || String(p.name).trim().length === 0) pe.name = 'Name required'
      if (p.price == null || String(p.price) === '') pe.price = 'Price required'
      if (p.price != null && Number(p.price) < 0) pe.price = 'Price cannot be negative'
      if (p.maxPerWallet == null || String(p.maxPerWallet) === '' || Number(p.maxPerWallet) <= 0) pe.maxPerWallet = 'Max per wallet must be > 0'
      const s = p.startDate ? new Date(p.startDate).getTime() : NaN
      const e = p.endDate ? new Date(p.endDate).getTime() : NaN
      if (isNaN(s) || isNaN(e)) pe.date = 'Start & end required'
      if (!isNaN(s) && !isNaN(e) && e < s) pe.date = 'End date must be after start date'
      if (p.maxSupply && Number(p.maxSupply) > (mintSettings.itemsAvailable || 0)) pe.maxSupply = 'Phase cap exceeds total supply'
      // Enforce allowlist: first phase must be public (no allowlist). Additional phases require allowlist
      if (idx === 0) {
        if (Array.isArray(p.allowlist) && p.allowlist.length > 0) {
          pe.allowlist = 'Public phase cannot have an allowlist'
        }
        if (String(p.name).trim().toLowerCase() !== 'public') {
          // Normalize silently
          p.name = 'Public'
        }
      } else {
        if (!Array.isArray(p.allowlist) || p.allowlist.length === 0) {
          pe.allowlist = 'Allowlist is required for non‑public phases'
        }
      }
      if (Object.keys(pe).length) {
        errs[idx] = pe
        hasError = true
      }
    })
    setPhaseErrors(errs)
    if (hasError) {
      toast.error('Please fix highlighted fields')
      return
    }
    onNext()
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-2xl font-bold text-white">Mint Settings</h2>
        <p className="text-gray-300">Configure your Candy Machine v3 settings.</p>
      </div>

      <div className="grid gap-4 md:gap-6 md:grid-cols-2">
        {/* Metadata Standard */}
        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-medium text-gray-300">
            Metadata Standard
          </label>
          <div className="flex items-center space-x-6">
            <label className="inline-flex cursor-pointer items-center space-x-2">
              <input
                type="radio"
                name="standard"
                value="core"
                checked={mintSettings.standard === 'core'}
                onChange={() => handleInputChange('standard', 'core')}
                className="h-4 w-4 border-[hsl(var(--border))] text-primary-500 focus:ring-primary-500"
              />
              <span className="text-sm text-white">Metaplex Core (Lower fees)</span>
            </label>
            <label className="inline-flex cursor-pointer items-center space-x-2">
              <input
                type="radio"
                name="standard"
                value="legacy"
                checked={mintSettings.standard === 'legacy'}
                onChange={() => handleInputChange('standard', 'legacy')}
                className="h-4 w-4 border-[hsl(var(--border))] text-primary-500 focus:ring-primary-500"
              />
              <span className="text-sm text-white">Metaplex Legacy</span>
            </label>
            <label className="inline-flex cursor-pointer items-center space-x-2">
              <input
                type="radio"
                name="standard"
                value="cnft"
                checked={mintSettings.standard === 'cnft'}
                onChange={() => handleInputChange('standard', 'cnft')}
                className="h-4 w-4 border-[hsl(var(--border))] text-primary-500 focus:ring-primary-500"
              />
              <span className="text-sm text-white">Compressed NFT (Lowest fees)</span>
            </label>
          </div>
        </div>
        {mintSettings.standard === 'cnft' && (
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              cNFT Merkle Tree Address
            </label>
            <input
              type="text"
              value={mintSettings.merkleTreeAddress}
              onChange={(e) => handleInputChange('merkleTreeAddress', e.target.value.trim())}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Enter tree address created via Init cNFT Tree"
            />
            <p className="text-xs text-gray-500 mt-1">This tree will be used when standard is set to cNFT.</p>
          </div>
        )}
        {/* Removed global Mint Price: price is set per phase below */}

        {/* Supply */}
        <div>
          <div className="mb-1 flex items-center gap-2">
            <label className="block text-sm font-medium text-gray-300">Total Supply *</label>
            <InfoTooltip text="Collection-wide supply. This is the maximum number of NFTs across all phases." />
          </div>
          <div className="relative">
            <Users className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-300" />
            <input
              type="number"
              value={mintSettings.itemsAvailable}
              onChange={(e) => handleInputChange('itemsAvailable', parseInt(e.target.value) || 0)}
              min="1"
              max={formData.assets?.length || 10000}
              className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-10 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="1000"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Max: {formData.assets?.length || 10000} (based on uploaded assets)
          </p>
        </div>

        {/* Global dates removed; configure per phase below */}

        {/* Network */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-300">
            Network
          </label>
          <select
            value={mintSettings.network}
            onChange={(e) => handleInputChange('network', e.target.value)}
            className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            disabled
          >
            <option value="mainnet-beta">Mainnet</option>
          </select>
        </div>

        {/* Seller Fee */}
        <div>
          <div className="mb-1 flex items-center gap-2">
            <label className="block text-sm font-medium text-gray-300">Seller Fee Basis Points</label>
            <InfoTooltip text="Secondary-sale royalty in basis points (bps). Example: 500 = 5% royalty. Not charged on primary mint." />
          </div>
          <input
            type="number"
            value={mintSettings.sellerFeeBasisPoints}
            onChange={(e) => handleInputChange('sellerFeeBasisPoints', parseInt(e.target.value) || 0)}
            min="0"
            max="10000"
            className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="500"
          />
          <p className="text-xs text-gray-500 mt-1">
            {mintSettings.sellerFeeBasisPoints / 100}% fee
          </p>
        </div>
      </div>

      {/* Phases */}
        <div className="space-y-4 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Mint Phases (optional)</h3>
            <Button
              onClick={() => {
                const newPhase = {
                  id: Math.random().toString(36).slice(2),
                  name: `WL Phase ${Math.max(1, mintSettings.phases.length)}`,
                  price: 0,
                  maxPerWallet: 1,
                  startDate: '',
                  endDate: '',
                  allowlist: [] as string[],
                }
                const updated = { ...mintSettings, phases: [...mintSettings.phases, newPhase] }
                setMintSettings(updated)
                onUpdate({ mintSettings: updated })
                toast.success('Added new allowlist phase')
              }}
            >
              Add Allowlist Phase
            </Button>
            {/* Public phase pre-created; no auto-fill button */}
        </div>
        {/* Help accordion */}
        <button type="button" className="flex w-full items-center justify-between rounded-md bg-white/5 p-2 text-left text-sm text-gray-300 ring-1 ring-inset ring-white/10 hover:bg-white/10" onClick={() => setShowPhaseHelp(!showPhaseHelp)}>
          <span className="inline-flex items-center gap-2"><HelpCircle className="h-4 w-4" /> Best practices for phases & allowlists</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${showPhaseHelp ? 'rotate-180' : ''}`} />
        </button>
        {showPhaseHelp && (
          <div className="rounded-md bg-white/5 p-3 text-xs text-gray-300 ring-1 ring-inset ring-white/10">
            <ul className="ml-4 list-disc space-y-1">
              <li>Keep allowlists small; use CSV import for larger lists.</li>
              <li>Set start/end windows clearly; avoid overlaps.</li>
              <li>Use per-wallet caps to prevent botting.</li>
              <li>Phase max supply should not exceed total supply.</li>
            </ul>
          </div>
        )}

          {/* Column headers with hints (aligned with inputs) */}
          <div className="hidden md:grid md:grid-cols-6 gap-2 px-1 mt-2 text-xs text-gray-400">
            <div className="md:col-span-2 inline-flex items-center gap-1">Phase Name<InfoTooltip text="Label shown on the mint page (e.g., Public, WL)." /></div>
            <div className="inline-flex items-center gap-1">Price (SOL)<InfoTooltip text="Price for this phase in SOL. Use 0 for free mint." /></div>
            <div className="inline-flex items-center gap-1">Max/Wallet<InfoTooltip text="Maximum number each wallet can mint in this phase." /></div>
            <div className="inline-flex items-center gap-1">Phase Cap<InfoTooltip text="Optional cap for this phase; must be ≤ Total Supply." /></div>
            <div className="inline-flex items-center gap-1">Start<InfoTooltip text="Phase start time (local). Leave empty to start immediately." /></div>
            <div className="inline-flex items-center gap-1">End<InfoTooltip text="Phase end time (local). Leave empty to keep open." /></div>
          </div>

        {mintSettings.phases.map((phase: any, idx: number) => (
          <div key={phase.id} className="grid gap-3 rounded-md border border-white/10 bg-black/10 p-3 md:grid-cols-6">
            <div className="relative md:col-span-2" title="Phase label (visible in UI). 32 characters max.">
              <input
                className={`w-full rounded px-2 py-2 text-white placeholder:text-gray-500 ring-1 ring-inset ${phaseErrors[idx]?.name ? 'ring-red-500' : 'ring-white/10'} bg-[hsl(var(--card))]`}
              value={phase.name}
              onChange={(e) => {
                const phases = [...mintSettings.phases]
                phases[idx] = { ...phase, name: e.target.value }
                handleInputChange('phases', phases)
              }}
              placeholder="Phase name (Team, WL, OG)"
                maxLength={32}
                disabled={idx === 0}
              />
              <div className="pointer-events-none absolute -bottom-5 right-1 text-[11px] text-gray-400">{(phase.name || '').length}/32</div>
              {phaseErrors[idx]?.name && (
                <p className="col-span-6 mt-5 text-xs text-red-400">{phaseErrors[idx]?.name}</p>
              )}
            </div>
            <input
              type="number"
              title="Per-phase mint price (SOL)."
              className={`rounded px-2 py-2 text-white placeholder:text-gray-500 ring-1 ring-inset ${phaseErrors[idx]?.price ? 'ring-red-500' : 'ring-white/10'} bg-[hsl(var(--card))]`}
              value={phase.price}
              min={0}
              step="0.01"
              onChange={(e) => {
                const phases = [...mintSettings.phases]
                phases[idx] = { ...phase, price: isNaN(parseFloat(e.target.value)) ? 0 : parseFloat(e.target.value) }
                handleInputChange('phases', phases)
              }}
              placeholder="Price (SOL)"
            />
            {phaseErrors[idx]?.price && (
              <p className="-mt-2 text-xs text-red-400 md:col-span-1">{phaseErrors[idx]?.price}</p>
            )}
            <input
              type="number"
              title="Per-wallet mint cap within this phase."
              className={`rounded px-2 py-2 text-white placeholder:text-gray-500 ring-1 ring-inset ${phaseErrors[idx]?.maxPerWallet ? 'ring-red-500' : 'ring-white/10'} bg-[hsl(var(--card))]`}
              value={phase.maxPerWallet}
              min={1}
              onChange={(e) => {
                const phases = [...mintSettings.phases]
                phases[idx] = { ...phase, maxPerWallet: parseInt(e.target.value) || 1 }
                handleInputChange('phases', phases)
              }}
              placeholder="Max per wallet"
            />
            {phaseErrors[idx]?.maxPerWallet && (
              <p className="-mt-2 text-xs text-red-400 md:col-span-1">{phaseErrors[idx]?.maxPerWallet}</p>
            )}
            <input
              type="number"
              title="Optional phase cap (must be ≤ total supply)."
              className={`rounded px-2 py-2 text-white placeholder:text-gray-500 ring-1 ring-inset ${phaseErrors[idx]?.maxSupply ? 'ring-red-500' : 'ring-white/10'} bg-[hsl(var(--card))]`}
              value={phase.maxSupply ?? ''}
              min={0}
              onChange={(e) => {
                const phases = [...mintSettings.phases]
                phases[idx] = { ...phase, maxSupply: parseInt(e.target.value) || 0 }
                handleInputChange('phases', phases)
              }}
              placeholder="Phase max supply"
            />
            {phaseErrors[idx]?.maxSupply && (
              <p className="-mt-2 text-xs text-red-400 md:col-span-1">{phaseErrors[idx]?.maxSupply}</p>
            )}
            <input
              type="datetime-local"
              title="Phase start time (inclusive)."
              className={`rounded px-2 py-2 text-white ring-1 ring-inset ${phaseErrors[idx]?.date ? 'ring-red-500' : 'ring-white/10'} bg-[hsl(var(--card))]`}
              value={phase.startDate as any}
              onChange={(e) => {
                const phases = [...mintSettings.phases]
                phases[idx] = { ...phase, startDate: e.target.value }
                handleInputChange('phases', phases)
              }}
            />
            <input
              type="datetime-local"
              title="Phase end time (inclusive). Must be after start."
              className={`rounded px-2 py-2 text-white ring-1 ring-inset ${phaseErrors[idx]?.date ? 'ring-red-500' : 'ring-white/10'} bg-[hsl(var(--card))]`}
              value={phase.endDate as any}
              onChange={(e) => {
                const phases = [...mintSettings.phases]
                phases[idx] = { ...phase, endDate: e.target.value }
                handleInputChange('phases', phases)
              }}
            />
            {phaseErrors[idx]?.date && (
              <p className="md:col-span-2 -mt-2 text-xs text-red-400">{phaseErrors[idx]?.date}</p>
            )}
            {idx === 0 ? (
              <div className="md:col-span-6 text-xs text-gray-400">Public phase is open to everyone; no allowlist required or allowed.</div>
            ) : (
              <>
                <textarea
                  title="One wallet address per line for allowlist (required)"
                  className={`md:col-span-6 rounded px-2 py-2 text-white placeholder:text-gray-500 ring-1 ring-inset ${phaseErrors[idx]?.allowlist ? 'ring-red-500' : 'ring-white/10'} bg-[hsl(var(--card))]`}
                  rows={2}
                  value={(phase as any)._allowlistRaw ?? (phase.allowlist || []).join('\n')}
                  onChange={(e) => {
                    const raw = e.target.value
                    const list = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
                    const phases = [...mintSettings.phases]
                    phases[idx] = { ...phase, allowlist: list, _allowlistRaw: raw }
                    handleInputChange('phases', phases)
                  }}
                  placeholder="One wallet address per line (required)"
                />
                <div className="md:col-span-6 text-xs text-gray-400">Paste one wallet address per line. CSV import/export has been removed.</div>
              </>
            )}
            {/* Freeze (optional) */}
            <input
              title="Optional: charge SOL and freeze minted NFTs."
              type="number"
              className="rounded px-2 py-2 text-white ring-1 ring-inset ring-white/10 bg-[hsl(var(--card))]"
              value={phase.freezeSolPaymentLamports || ''}
              onChange={(e) => {
                const phases = [...mintSettings.phases]
                phases[idx] = { ...phase, freezeSolPaymentLamports: parseInt(e.target.value) || 0 }
                handleInputChange('phases', phases)
              }}
              placeholder="Freeze SOL (lamports)"
            />
            <input
              type="datetime-local"
              title="Optional thaw date for frozen NFTs."
              className="rounded px-2 py-2 text-white ring-1 ring-inset ring-white/10 bg-[hsl(var(--card))]"
              value={(phase.freezeUntil as any) || ''}
              onChange={(e) => {
                const phases = [...mintSettings.phases]
                phases[idx] = { ...phase, freezeUntil: e.target.value ? new Date(e.target.value) : undefined }
                handleInputChange('phases', phases)
              }}
              placeholder="Freeze Until"
            />
            <div className="col-span-6 text-[11px] text-gray-500">Freeze fields are optional: charge SOL and freeze minted NFTs until the thaw date.</div>
            <div className="md:col-span-6 text-right">
              <div className="inline-flex gap-2">
                {idx > 0 && (
                  <Button variant="outline" onClick={() => {
                    const cloned = { ...phase, id: Math.random().toString(36).slice(2), name: `${phase.name || 'Phase'} Copy` }
                    const phases = [...mintSettings.phases]
                    phases.splice(idx + 1, 0, cloned)
                    handleInputChange('phases', phases)
                  }}>Duplicate</Button>
                )}
                <Button variant="outline" onClick={() => {
                  if (idx === 0) { toast.error('Public phase cannot be removed'); return }
                  const phases = mintSettings.phases.filter((_: any, i: number) => i !== idx)
                  handleInputChange('phases', phases)
                }}>Remove</Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Additional Settings */}
      <div className="space-y-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
        <div className="flex items-center">
          <input
            type="checkbox"
            id="isMutable"
            checked={mintSettings.isMutable}
            onChange={(e) => handleInputChange('isMutable', e.target.checked)}
            className="h-4 w-4 rounded border-[hsl(var(--border))] text-primary-500 focus:ring-primary-500"
          />
          <label htmlFor="isMutable" className="ml-2 block text-sm text-white">
            Mutable NFTs (can be updated after mint)
          </label>
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="shuffleItems"
            checked={mintSettings.shuffleItems}
            onChange={(e) => handleInputChange('shuffleItems', e.target.checked)}
            className="h-4 w-4 rounded border-[hsl(var(--border))] text-primary-500 focus:ring-primary-500"
          />
          <label htmlFor="shuffleItems" className="ml-2 block text-sm text-white">
            Shuffle item order before inserting into Candy Machine
          </label>
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
        <h3 className="mb-2 text-lg font-semibold text-white">Summary</h3>
        <div className="grid grid-cols-2 gap-4 text-sm text-gray-300">
          <div>
            <span>Price:</span>
            <span className="ml-2 font-medium text-white">{mintSettings.price} SOL</span>
          </div>
          <div>
            <span>Supply:</span>
            <span className="ml-2 font-medium text-white">{mintSettings.itemsAvailable}</span>
          </div>
          <div>
            <span>Network:</span>
            <span className="ml-2 font-medium text-white">{mintSettings.network}</span>
          </div>
          <div>
            <span>Fee:</span>
            <span className="ml-2 font-medium text-white">{mintSettings.sellerFeeBasisPoints / 100}%</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-6">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleNext}>
          Next: Preview & Deploy
        </Button>
      </div>
    </div>
  )
}


