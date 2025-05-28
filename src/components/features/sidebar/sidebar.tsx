"use client"

import type React from "react"
import { Button } from "@/components/ui/button"
import { BookOpen, Clock, FileText, Home, LogOut, Menu, Plus, Route, Settings, User, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useSidebarState } from "./sidebar-context"

interface SidebarProps {
  onNewChat?: () => void
}

export function Sidebar({ onNewChat }: SidebarProps) {
  const { collapsed, setCollapsed, sidebarOpen, setSidebarOpen, isMobile } = useSidebarState()

  return (
    <>
      {/* Mobile menu button - only visible on mobile when sidebar is closed */}
      {isMobile && !sidebarOpen && (
        <Button
          variant="ghost"
          size="icon"
          className="fixed top-4 left-4 z-50 md:hidden h-10 w-10 flex items-center justify-center"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu size={24} />
        </Button>
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col bg-gray-900 text-white transition-all duration-300",
          collapsed && !isMobile ? "w-[60px]" : "w-[260px]", // Always expanded on mobile
          isMobile && !sidebarOpen ? "-translate-x-full" : "translate-x-0",
          isMobile && "shadow-lg",
        )}
      >
        {/* Top section with logo and new chat */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-6">
            {(!collapsed || isMobile) && <h1 className="text-xl font-semibold">Carson</h1>}

            {/* Close button for mobile - positioned opposite to logo */}
            {isMobile && sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(false)}
                className="h-10 w-10 bg-white rounded-md flex items-center justify-center text-gray-900 hover:bg-gray-100 transition-colors"
              >
                <X size={20} />
              </button>
            )}

            {/* Collapse toggle for desktop */}
            {!isMobile && (
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8 rounded-md text-gray-400 hover:text-white hover:bg-gray-800",
                  collapsed && "mx-auto",
                )}
                onClick={() => setCollapsed(!collapsed)}
              >
                {collapsed ? "→" : "←"}
              </Button>
            )}
          </div>
          <Button
            className={cn(
              "bg-gray-800 hover:bg-gray-700 text-white gap-3 mb-6 w-full justify-start",
              collapsed && !isMobile && "w-10 h-10 p-0 mx-auto justify-center",
            )}
            onClick={onNewChat}
          >
            <Plus size={isMobile ? 20 : 16} />
            {(!collapsed || isMobile) && <span>New chat</span>}
          </Button>
        </div>

        {/* Middle section with main navigation */}
        <div className="flex-1 overflow-auto px-4">
          <div className="space-y-3">
            <NavItem icon={Home} label="Home" collapsed={collapsed} isMobile={isMobile} />
            <NavItem icon={Clock} label="Recents" collapsed={collapsed} isMobile={isMobile} />
            <NavItem icon={FileText} label="Journal" collapsed={collapsed} isMobile={isMobile} />
            <NavItem icon={Route} label="Knowledge Journey" collapsed={collapsed} isMobile={isMobile} />
            <NavItem icon={BookOpen} label="Explorations" collapsed={collapsed} isMobile={isMobile} />
          </div>
        </div>

        {/* Bottom section with settings and profile */}
        <div className="border-t border-gray-800 p-4">
          <div className="space-y-3">
            <NavItem icon={Settings} label="Settings" collapsed={collapsed} isMobile={isMobile} />
            <NavItem icon={User} label="Profile" collapsed={collapsed} isMobile={isMobile} />
            <NavItem icon={LogOut} label="Logout" collapsed={collapsed} isMobile={isMobile} />
          </div>
        </div>
      </div>
    </>
  )
}

interface NavItemProps {
  icon: React.ElementType
  label: string
  collapsed: boolean
  isMobile: boolean
  active?: boolean
}

function NavItem({ icon: Icon, label, collapsed, isMobile, active }: NavItemProps) {
  return (
    <Button
      variant="ghost"
      className={cn(
        "text-gray-300 hover:text-white hover:bg-gray-800",
        active && "bg-gray-800 text-white",
        collapsed && !isMobile ? "w-10 h-10 p-0 mx-auto justify-center" : "w-full justify-start gap-3 py-3",
      )}
    >
      <Icon size={isMobile ? 22 : 16} />
      {(!collapsed || isMobile) && <span className="text-base">{label}</span>}
    </Button>
  )
}
