"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "@/contexts/theme-context"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ThemeToggleProps {
  collapsed?: boolean
}

export function ThemeToggle({ collapsed }: ThemeToggleProps) {
  const { theme, toggleTheme, isTransitioning } = useTheme()

  const getIcon = () => {
    if (theme === "light") {
      return <Sun size={16} className={cn("transition-transform duration-200", isTransitioning && "animate-pulse")} />
    }
    return <Moon size={16} className={cn("transition-transform duration-200", isTransitioning && "animate-pulse")} />
  }

  const getLabel = () => {
    return theme === "light" ? "Light" : "Dark"
  }

  return (
    <Button
      variant="ghost"
      className={cn(
        "text-gray-300 hover:text-white hover:bg-gray-800 dark:hover:bg-gray-800 transition-all duration-200",
        "w-full justify-start gap-3 py-3 md:w-auto",
        collapsed && "md:w-10 md:h-10 md:p-0 md:mx-auto md:justify-center",
        isTransitioning && "pointer-events-none opacity-70"
      )}
      onClick={toggleTheme}
      disabled={isTransitioning}
      title={isTransitioning ? "Switching theme..." : `Switch to ${theme === "light" ? "dark" : "light"} mode`}
    >
      <div className="relative">
        {getIcon()}
      </div>
      <span className={cn("text-base", collapsed && "md:hidden")}>{getLabel()}</span>
    </Button>
  )
} 