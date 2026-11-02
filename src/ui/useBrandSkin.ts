import { useEffect, useState } from 'react'
import { getResolvedSkin, subscribeBrand, type ResolvedBrand } from '../game/commercial/runtime'

export function useBrandSkin(): ResolvedBrand {
  const [skin, setSkin] = useState(getResolvedSkin)
  useEffect(() => subscribeBrand(() => setSkin(getResolvedSkin())), [])
  return skin
}
