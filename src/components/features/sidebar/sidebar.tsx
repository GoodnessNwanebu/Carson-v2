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
  const { collapsed, setCollapsed, sidebarOpen, setSidebarOpen, isMobile } = useSidebarState()
  const router = useRouter()
  const pathname = usePathname()

  const handleNavigation = (path: string) => {
    router.push(path)
    // Close sidebar on mobile after navigation
    if (isMobile) {
      setSidebarOpen(false)
    }
  }

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

      {/* Mobile backdrop overlay */}
      {isMobile && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col bg-gray-900 text-white sidebar-transition",
          "bg-gray-900 dark:bg-gray-950 border-r border-gray-800 dark:border-gray-700",
          isMobile 
            ? cn("w-[280px]", sidebarOpen ? "translate-x-0" : "-translate-x-full")
            : collapsed 
              ? "w-[60px]" 
              : "w-[260px]",
        )}
      >
        {/* Top section with logo and new chat */}
        <div className="p-4 border-b border-gray-800 dark:border-gray-700">
          <div className={cn("flex items-center mb-6", collapsed && !isMobile ? "justify-center" : "justify-between")}>
            {/* Logo - only show when not collapsed or on mobile */}
            {(!collapsed || isMobile) && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <div className="w-4 h-4 bg-white rounded-full"></div>
                </div>
                <span className="text-xl font-bold text-white">Carson</span>
              </div>
            )}

            {/* Close button for mobile - positioned opposite to logo */}
            {isMobile && sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(false)}
                className="h-10 w-10 bg-white dark:bg-gray-800 rounded-md flex items-center justify-center text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
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
                  "h-8 w-8 rounded-md text-gray-400 hover:text-white hover:bg-gray-800 dark:hover:bg-gray-800",
                  collapsed && "mx-auto",
                )}
                onClick={() => setCollapsed(!collapsed)}
              >
                {collapsed ? "→" : "←"}
              </Button>
            )}
          </div>
          <div className="mb-6">
            {collapsed && !isMobile ? (
              // Collapsed state - just icon button like other nav items
              <Button
                variant="ghost"
                size="icon"
                className="w-10 h-10 mx-auto text-gray-300 hover:text-white hover:bg-gray-800 transition-all duration-200"
                onClick={() => {
                  onNewChat?.()
                  handleNavigation('/')
                }}
              >
                <MessageSquarePlus size={16} />
              </Button>
            ) : (
              // Expanded state - full gradient button
              <div
                className="relative group bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 overflow-hidden cursor-pointer"
                onClick={() => {
                  onNewChat?.()
                  handleNavigation('/')
                }}
              >
                <Button
                  className="w-full h-full bg-transparent hover:bg-white/10 border-0 shadow-none text-white font-medium px-4 py-3 justify-start gap-3 transition-all duration-200"
                  onClick={(e) => {
                    e.stopPropagation()
                    onNewChat?.()
                    handleNavigation('/')
                  }}
              >
                <MessageSquarePlus size={isMobile ? 20 : 18} className="flex-shrink-0" />
                <span className="text-[15px]">New conversation</span>
              </Button>
            
                {/* Subtle shine effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none"></div>
              </div>
            )}
          </div>
        </div>

        {/* Middle section with main navigation */}
        <div className="flex-1 overflow-auto px-4">
          <div className="space-y-3">
            <NavItem 
              icon={Clock} 
              label="Recents" 
              collapsed={collapsed} 
              isMobile={isMobile}
              active={pathname === '/recents'}
              onClick={() => handleNavigation('/recents')} 
            />
            <NavItem 
              icon={FileText} 
              label="Journal" 
              collapsed={collapsed} 
              isMobile={isMobile}
              active={pathname === '/journal'}
              onClick={() => handleNavigation('/journal')} 
            />
            <NavItem 
              icon={Route} 
              label="Knowledge Journey" 
              collapsed={collapsed} 
              isMobile={isMobile}
              active={pathname === '/journey'}
              onClick={() => handleNavigation('/journey')} 
            />
            <div className="relative">
              <NavItem 
                icon={BookOpen} 
                label="Explorations" 
                collapsed={collapsed} 
                isMobile={isMobile}
                active={pathname === '/explorations'}
                onClick={() => handleNavigation('/explorations')} 
              />
              
              {/* Explorations submenu when expanded */}
              {(!collapsed || isMobile) && (
                <div className="ml-6 mt-2 space-y-2">
                  <NavSubItem
                    icon={HelpCircle}
                    label="Past Questions"
                    collapsed={collapsed}
                    isMobile={isMobile}
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
              isMobile={isMobile}
              onClick={() => handleNavigation('/settings')} 
            />
            <ThemeToggle collapsed={collapsed} isMobile={isMobile} />
            <NavItem 
              icon={User} 
              label="Profile" 
              collapsed={collapsed} 
              isMobile={isMobile}
              onClick={() => handleNavigation('/profile')} 
            />
            <NavItem 
              icon={LogOut} 
              label="Logout" 
              collapsed={collapsed} 
              isMobile={isMobile}
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
  isMobile: boolean
  active?: boolean
  onClick?: () => void
}

function NavItem({ icon: Icon, label, collapsed, isMobile, active, onClick }: NavItemProps) {
  return (
    <Button
      variant="ghost"
      className={cn(
        "text-gray-300 hover:text-white hover:bg-gray-800 dark:hover:bg-gray-800",
        active && "bg-gray-800 dark:bg-gray-800 text-white",
        collapsed && !isMobile ? "w-10 h-10 p-0 mx-auto justify-center" : "w-full justify-start gap-3 py-3",
      )}
      onClick={onClick}
    >
      <Icon size={isMobile ? 22 : 16} />
      {(!collapsed || isMobile) && <span className="text-base">{label}</span>}
    </Button>
  )
}

interface NavSubItemProps {
  icon: React.ElementType
  label: string
  collapsed: boolean
  isMobile: boolean
  active?: boolean
  onClick?: () => void
}

function NavSubItem({ icon: Icon, label, collapsed, isMobile, active, onClick }: NavSubItemProps) {
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
