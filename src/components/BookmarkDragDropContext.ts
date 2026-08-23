import { createContext, useContext } from 'react'

export const MovePendingContext = createContext(false)

export function useMovePending() {
  return useContext(MovePendingContext)
}
