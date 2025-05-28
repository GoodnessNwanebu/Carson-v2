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
  const [collapsed, setCollapsed] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const isMobile = useMediaQuery("(max-width: 768px)")

  // Close sidebar by default on mobile
  useEffect(() => {
    if (isMobile) {
      setCollapsed(true)
      setSidebarOpen(false)
    } else {
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
