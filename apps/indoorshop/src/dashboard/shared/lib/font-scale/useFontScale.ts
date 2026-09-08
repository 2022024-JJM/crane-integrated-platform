import { useContext } from 'react'
import { FontScaleContext, type FontScaleContextType } from './context'

export function useFontScale(): FontScaleContextType {
  const context = useContext(FontScaleContext)
  if (context === undefined) {
    throw new Error('useFontScale must be used within a FontScaleProvider')
  }
  return context
}
