"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { useSidebarState } from "@/components/features/sidebar/sidebar-context"

export function StickyHeader() {
  const [isScrolled, setIsScrolled] = useState(false)
  const { isMobile } = useSidebarState()

  useEffect(() => {
    const handleScroll = () => {
      // Show sticky header after scrolling down 50px
      setIsScrolled(window.scrollY > 50)
    }

    // Add scroll listener
    window.addEventListener("scroll", handleScroll)

    // Also listen for scroll events on the conversation container
    const conversationContainer = document.querySelector("[data-conversation-scroll]")
    if (conversationContainer) {
      conversationContainer.addEventListener("scroll", () => {
        setIsScrolled(conversationContainer.scrollTop > 50)
      })
    }

    return () => {
      window.removeEventListener("scroll", handleScroll)
      if (conversationContainer) {
        conversationContainer.removeEventListener("scroll", handleScroll)
      }
    }
  }, [])

  // Only show on mobile
  if (!isMobile) return null

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 h-16 bg-white shadow-sm transition-all duration-300 z-10",
        isScrolled ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-full",
      )}
    />
  )
}
