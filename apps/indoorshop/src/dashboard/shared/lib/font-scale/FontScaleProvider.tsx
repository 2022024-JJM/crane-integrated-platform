import { useEffect, useMemo, useState } from 'react'
import { applyFontScale, getInitialFontScale, type FontScale } from './storage'
import { FontScaleContext } from './context'

interface FontScaleProviderProps {
  children: React.ReactNode
}

export function FontScaleProvider({ children }: FontScaleProviderProps) {
  const [fontScale, setFontScale] = useState<FontScale>(() => getInitialFontScale())

  useEffect(() => {
    applyFontScale(fontScale)
  }, [fontScale])

  const value = useMemo(() => ({ fontScale, setFontScale }), [fontScale])

  return <FontScaleContext.Provider value={value}>{children}</FontScaleContext.Provider>
}
