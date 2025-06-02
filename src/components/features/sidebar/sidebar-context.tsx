"use client"

import type React from "react"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { useMediaQuery } from "@/hooks/use-mobile"

type SidebarContextType = {
  collapsed: boolean
  setCollapsed: React.Dispatch<React.SetStateAction<boolean>>
  sidebarOpen: boolean
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>
  isMobile: boolean
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined)

export function useSidebarState() {
  const context = useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebarState must be used within a SidebarProvider")
  }
  return context
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const isMobile = useMediaQuery("(max-width: 768px)")
  
  // Set initial state based on screen size to prevent flash
  const [collapsed, setCollapsed] = useState(() => {
    // On server-side, assume desktop (will be corrected on client)
    if (typeof window === 'undefined') return false
    // On mobile, always start collapsed
    return window.innerWidth <= 768
  })
  
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    // On server-side, assume closed to prevent flicker
    if (typeof window === 'undefined') return false
    // On mobile, always start closed; on desktop, start closed to prevent flicker
    return false
  })

  // Update state when screen size changes
  useEffect(() => {
    if (isMobile) {
      setCollapsed(true)
      setSidebarOpen(false)
    } else {
      setCollapsed(false)
      setSidebarOpen(true)
    }
  }, [isMobile])

  return (
    <SidebarContext.Provider
      value={{
        collapsed,
        setCollapsed,
        sidebarOpen,
        setSidebarOpen,
        isMobile,
      }}
    >
      {children}
    </SidebarContext.Provider>
  )
}
