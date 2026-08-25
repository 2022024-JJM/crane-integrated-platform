import { useMemo, useState } from 'react'
import { FixedViewportContext } from './context'

interface FixedViewportProviderProps {
  children: React.ReactNode
}

export function FixedViewportProvider({ children }: FixedViewportProviderProps) {
  const [fixed, setFixed] = useState(false)
  const value = useMemo(() => ({ fixed, setFixed }), [fixed])

  return <FixedViewportContext.Provider value={value}>{children}</FixedViewportContext.Provider>
}
