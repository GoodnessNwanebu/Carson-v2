"use client"

import type React from "react"
import { Button } from "@/components/ui/button"
import { BookOpen, Clock, FileText, LogOut, Menu, MessageSquarePlus, Route, Settings, User, X, HelpCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { useSidebarState } from "./sidebar-context"
import { useRouter, usePathname } from "next/navigation"
import { ThemeToggle } from "@/components/ui/theme-toggle"

interface SidebarProps {
  onNewChat?: () => void
}

export function Sidebar({ onNewChat }: SidebarProps) {
  const { collapsed, setCollapsed, sidebarOpen, setSidebarOpen } = useSidebarState()
  const router = useRouter()
  const pathname = usePathname()

  const handleNavigation = (path: string) => {
    router.push(path)
    // Sidebar stays open - user controls when to close it
  }

  return (
    <>
      {/* Mobile menu button - only visible on mobile when sidebar is closed */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "fixed top-4 left-4 z-50 h-10 w-10 flex items-center justify-center bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 shadow-sm border border-gray-200 dark:border-gray-600 transition-opacity duration-200",
          // Show only on mobile when sidebar is closed
          "md:hidden",
          sidebarOpen ? "opacity-0 pointer-events-none" : "opacity-100"
        )}
        onClick={() => setSidebarOpen(true)}
      >
        <Menu size={24} />
      </Button>

      {/* Mobile backdrop overlay */}
      <div 
        className={cn(
          "fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity duration-200",
          sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col bg-gray-900 text-white sidebar-transition",
          "bg-gray-900 dark:bg-gray-950 border-r border-gray-800 dark:border-gray-700",
          // Mobile: full width, slide in/out
          "w-[280px] md:w-auto",
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          // Desktop: collapsed/expanded width
          collapsed ? "md:w-[60px]" : "md:w-[260px]"
        )}
      >
        {/* Top section with logo and new chat */}
        <div className="p-4 border-b border-gray-800 dark:border-gray-700">
          <div className={cn("flex items-center mb-6", collapsed ? "md:justify-center justify-between" : "justify-between")}>
            {/* Logo - always show on mobile, show on desktop when not collapsed */}
            <div className={cn("flex items-center gap-3", collapsed && "md:hidden")}>
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <div className="w-4 h-4 bg-white rounded-full"></div>
              </div>
              <span className="text-xl font-bold text-white">Carson</span>
            </div>

            {/* Close button for mobile */}
            <button
              className={cn(
                "h-10 w-10 bg-white dark:bg-gray-800 rounded-md flex items-center justify-center text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors",
                "md:hidden",
                sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
              )}
              onClick={() => setSidebarOpen(false)}
            >
              <X size={20} />
            </button>

            {/* Collapse toggle for desktop only */}
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-8 w-8 rounded-md text-gray-400 hover:text-white hover:bg-gray-800 dark:hover:bg-gray-800 hidden md:flex",
                collapsed && "mx-auto",
              )}
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? "→" : "←"}
            </Button>
          </div>
          <div className="mb-6">
            {/* New conversation button - clean responsive design */}
            <Button
              className={cn(
                "w-full transition-all duration-200 font-medium px-4 py-3 justify-start gap-3 text-white rounded-xl shadow-lg hover:shadow-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800",
                // Desktop collapsed: override to icon-only style
                collapsed && "md:w-10 md:h-10 md:mx-auto md:p-0 md:text-gray-300 md:hover:text-white md:hover:bg-gray-800 md:justify-center md:bg-none md:from-transparent md:to-transparent md:hover:from-transparent md:hover:to-transparent md:shadow-none md:rounded-md"
              )}
              onClick={() => {
                onNewChat?.()
                handleNavigation('/')
              }}
            >
              <MessageSquarePlus size={collapsed ? 16 : 18} className="flex-shrink-0" />
              <span className={cn("text-[15px]", collapsed && "md:hidden")}>New conversation</span>
              
              {/* Subtle shine effect - hide when collapsed on desktop */}
              <div className={cn("absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none", collapsed && "md:hidden")} />
            </Button>
          </div>
        </div>

        {/* Middle section with main navigation */}
        <div className="flex-1 overflow-auto px-4">
          <div className="space-y-3">
            <NavItem 
              icon={Clock} 
              label="Recents" 
              collapsed={collapsed} 
              active={pathname === '/recents'}
              onClick={() => handleNavigation('/recents')} 
            />
            <NavItem 
              icon={FileText} 
              label="Journal" 
              collapsed={collapsed} 
              active={pathname === '/journal'}
              onClick={() => handleNavigation('/journal')} 
            />
            <NavItem 
              icon={Route} 
              label="Knowledge Journey" 
              collapsed={collapsed} 
              active={pathname === '/journey'}
              onClick={() => handleNavigation('/journey')} 
            />
            <div className="relative">
              <NavItem 
                icon={BookOpen} 
                label="Explorations" 
                collapsed={collapsed} 
                active={pathname === '/explorations'}
                onClick={() => handleNavigation('/explorations')} 
              />
              
              {/* Explorations submenu when expanded */}
              {!collapsed && (
                <div className="ml-6 mt-2 space-y-2">
                  <NavSubItem
                    icon={HelpCircle}
                    label="Past Questions"
                    collapsed={collapsed}
                    active={pathname === '/question-solver'}
                    onClick={() => handleNavigation('/question-solver')}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom section with settings and profile */}
        <div className="border-t border-gray-800 dark:border-gray-700 p-4">
          <div className="space-y-3">
            <NavItem 
              icon={Settings} 
              label="Settings" 
              collapsed={collapsed} 
              onClick={() => handleNavigation('/settings')} 
            />
            <ThemeToggle collapsed={collapsed} />
            <NavItem 
              icon={User} 
              label="Profile" 
              collapsed={collapsed} 
              onClick={() => handleNavigation('/profile')} 
            />
            <NavItem 
              icon={LogOut} 
              label="Logout" 
              collapsed={collapsed} 
              onClick={() => {}} 
            />
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
  active?: boolean
  onClick?: () => void
}

function NavItem({ icon: Icon, label, collapsed, active, onClick }: NavItemProps) {
  return (
    <Button
      variant="ghost"
      className={cn(
        "text-gray-300 hover:text-white hover:bg-gray-800 dark:hover:bg-gray-800",
        active && "bg-gray-800 dark:bg-gray-800 text-white",
        // Mobile: always full width, Desktop: collapsed/expanded based on state
        "w-full justify-start gap-3 py-3 md:w-auto",
        collapsed && "md:w-10 md:h-10 md:p-0 md:mx-auto md:justify-center"
      )}
      onClick={onClick}
    >
      <Icon size={16} />
      <span className={cn("text-base", collapsed && "md:hidden")}>{label}</span>
    </Button>
  )
}

interface NavSubItemProps {
  icon: React.ElementType
  label: string
  collapsed: boolean
  active?: boolean
  onClick?: () => void
}

function NavSubItem({ icon: Icon, label, collapsed, active, onClick }: NavSubItemProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "text-gray-400 hover:text-white hover:bg-gray-800 dark:hover:bg-gray-800 text-sm",
        active && "bg-gray-800 dark:bg-gray-800 text-white",
        "w-full justify-start gap-2 py-2 px-3",
      )}
      onClick={onClick}
    >
      <Icon size={14} />
      <span>{label}</span>
    </Button>
  )
}
