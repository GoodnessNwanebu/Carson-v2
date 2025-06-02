"use client"

import { useEffect, type ReactNode } from "react"
import { Sidebar } from "./features/sidebar/sidebar"
import { useSidebarState } from "./features/sidebar/sidebar-context"
import { KnowledgeMapPanel } from "./features/knowledge-map/knowledge-map-panel"
import { useKnowledgeMap } from "./features/knowledge-map/knowledge-map-context"
import { useSession } from "./features/conversation/session-context"
import { cn } from "@/lib/utils"
import { usePathname, useRouter } from "next/navigation"

interface AppLayoutProps {
  children: ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const { collapsed, setSidebarOpen } = useSidebarState()
  const { isMapOpen, clearKnowledgeMap } = useKnowledgeMap()
  const { clearSession } = useSession()
  const pathname = usePathname()
  const router = useRouter()

  // Add viewport meta tag for better mobile behavior
  useEffect(() => {
    // Add viewport meta tag to prevent scaling and improve mobile rendering
    const meta = document.createElement("meta")
    meta.name = "viewport"
    meta.content = "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content"
    document.head.appendChild(meta)

    // Add class to body to prevent overscroll and optimize touch
    document.body.classList.add("touch-manipulation")
    
    // Add CSS for hover media queries and smooth transitions
    const style = document.createElement("style")
    style.textContent = `
      @media (hover: none) and (pointer: coarse) {
        .hover\\:bg-gray-50:hover { background-color: inherit !important; }
        .hover\\:text-blue-600:hover { color: inherit !important; }
        .hover\\:bg-blue-50:hover { background-color: inherit !important; }
        .hover\\:border-blue-200:hover { border-color: inherit !important; }
        .hover\\:shadow-md:hover { box-shadow: inherit !important; }
        .hover\\:bg-blue-700:hover { background-color: inherit !important; }
        .hover\\:bg-red-600:hover { background-color: inherit !important; }
      }
      
      /* Enhanced sidebar transitions */
      .sidebar-transition {
        transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
      
      .content-transition {
        transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
      
      /* Allow natural scrolling on mobile */
      body {
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
      }
    `
    document.head.appendChild(style)

    return () => {
      if (document.head.contains(meta)) document.head.removeChild(meta)
      if (document.head.contains(style)) document.head.removeChild(style)
      document.body.classList.remove("touch-manipulation")
    }
  }, [])

  // Handle browser refresh detection and clear session on home page
  useEffect(() => {
    const SESSION_KEY = 'carson-app-session'
    
    // Check if this is a fresh browser session (refresh or new tab)
    const sessionExists = sessionStorage.getItem(SESSION_KEY)
    
    if (!sessionExists) {
      // This is a fresh session (browser refresh or new tab)
      // Set the session flag for future navigation
      sessionStorage.setItem(SESSION_KEY, 'active')
      
      // If we're on the home/conversation page, clear the session for a fresh start
      if (pathname === '/') {
        console.log('Conversation page refresh detected, clearing session for fresh start...')
        clearSession()
        clearKnowledgeMap()
      }
      
      // All other pages behave normally (no redirect)
    }
    
    // For normal navigation, the session flag already exists
    // so we don't clear anything
  }, [pathname, clearSession, clearKnowledgeMap])

  // Handle new chat (reset to home) - user controls sidebar manually
  const handleNewChat = () => {
    // Clear session and knowledge map data
    clearSession()
    clearKnowledgeMap()
  }

  // Determine if we should show knowledge map (only on main conversation page)
  const shouldShowKnowledgeMap = pathname === "/"

  return (
    <div className="fixed inset-0 flex bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <Sidebar onNewChat={handleNewChat} />

      {/* Only show knowledge map on main page */}
      {shouldShowKnowledgeMap && <KnowledgeMapPanel />}

      <div
        className={cn(
          "flex-1 flex flex-col content-transition",
          // Responsive margins: no margin on mobile, responsive margin on desktop based on sidebar state
          "ml-0 md:ml-[60px]",
          !collapsed && "md:ml-[260px]"
        )}
      >
        {children}
      </div>
    </div>
  )
} 