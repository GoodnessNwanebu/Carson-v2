"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

type Theme = "dark" | "light"

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  isDarkMode: boolean
  toggleTheme: () => void
  isTransitioning: boolean
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light")
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)

  useEffect(() => {
    // Load theme from localStorage or default to light
    const savedTheme = localStorage.getItem("theme") as Theme
    if (savedTheme === "dark" || savedTheme === "light") {
      setTheme(savedTheme)
    } else {
      // If no saved theme or invalid theme, check system preference
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
      setTheme(systemTheme)
    }
  }, [])

  useEffect(() => {
    const root = window.document.documentElement
    
    // Remove previous theme classes
    root.classList.remove("light", "dark")
    
    // Add new theme class
    root.classList.add(theme)
    setIsDarkMode(theme === "dark")
    
    // Save to localStorage
    localStorage.setItem("theme", theme)
  }, [theme])

  const toggleTheme = () => {
    setIsTransitioning(true)
    
    // Create fade overlay
    const overlay = document.createElement('div')
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: ${theme === 'light' ? '#000' : '#fff'};
      opacity: 0;
      z-index: 9999;
      pointer-events: none;
      transition: opacity 0.3s ease-in-out;
    `
    document.body.appendChild(overlay)
    
    // Trigger fade in
    requestAnimationFrame(() => {
      overlay.style.opacity = '0.4'
    })
    
    // Switch theme at peak of fade
    setTimeout(() => {
      setTheme(prev => prev === "light" ? "dark" : "light")
      
      // Fade out
      overlay.style.opacity = '0'
      
      // Clean up and finish transition
      setTimeout(() => {
        if (document.body.contains(overlay)) {
          document.body.removeChild(overlay)
        }
        setIsTransitioning(false)
      }, 300)
    }, 250)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDarkMode, toggleTheme, isTransitioning }}>
      {children}
    </ThemeContext.Provider>
  )
} 