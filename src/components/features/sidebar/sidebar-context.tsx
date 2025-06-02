"use client"

import type React from "react"

import { createContext, useContext, useState, type ReactNode } from "react"

type SidebarContextType = {
  collapsed: boolean
  setCollapsed: React.Dispatch<React.SetStateAction<boolean>>
  sidebarOpen: boolean
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>
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
  // Start closed, let user control manually
  const [collapsed, setCollapsed] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <SidebarContext.Provider
      value={{
        collapsed,
        setCollapsed,
        sidebarOpen,
        setSidebarOpen,
      }}
    >
      {children}
    </SidebarContext.Provider>
  )
}
