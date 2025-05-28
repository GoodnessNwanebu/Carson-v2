"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Sidebar } from "./features/sidebar/sidebar"
import { SidebarProvider, useSidebarState } from "./features/sidebar/sidebar-context"
import { KnowledgeMapProvider } from "./features/knowledge-map/knowledge-map-context"
import { KnowledgeMapPanel } from "./features/knowledge-map/knowledge-map-panel"
import { Conversation } from "./features/conversation/conversation"
import { PenLine, GraduationCap, Code, Coffee, Sparkles, Plus, SendHorizonal, Telescope } from "lucide-react"

export default function CarsonUI() {
  // Add viewport meta tag for better mobile behavior
  useEffect(() => {
    // Add viewport meta tag to prevent scaling
    const meta = document.createElement("meta")
    meta.name = "viewport"
    meta.content = "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
    document.head.appendChild(meta)

    // Add class to body to prevent overscroll
    document.body.classList.add("overflow-hidden", "touch-manipulation")

    return () => {
      document.head.removeChild(meta)
      document.body.classList.remove("overflow-hidden", "touch-manipulation")
    }
  }, [])

  return (
    <SidebarProvider>
      <KnowledgeMapProvider>
        <CarsonUIContent />
      </KnowledgeMapProvider>
    </SidebarProvider>
  )
}

function CarsonUIContent() {
  const [query, setQuery] = useState("")
  const [deepDive, setDeepDive] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [inConversation, setInConversation] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [initialTopic, setInitialTopic] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const { collapsed, isMobile } = useSidebarState()
  const [contentWidth, setContentWidth] = useState("max-w-2xl")

  // Update content width when sidebar state changes
  useEffect(() => {
    if (isMobile) {
      setContentWidth("max-w-xl")
    } else {
      setContentWidth(collapsed ? "max-w-3xl" : "max-w-2xl")
    }
  }, [collapsed, isMobile])

  // Calculate the left margin based on sidebar state
  const getMainContentMargin = () => {
    if (isMobile) {
      return "ml-0" // No margin on mobile
    } else {
      return collapsed ? "ml-[60px]" : "ml-[260px]" // Adjust based on sidebar width
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim() || isLoading) return

    setIsLoading(true)
    setTimeout(() => {
      setIsTransitioning(true)
    }, 300)
    setTimeout(() => {
      setIsLoading(false)
      setInitialTopic(query)
      setInConversation(true)
    }, 1000)
    setTimeout(() => {
      setIsTransitioning(false)
    }, 1200)
  }

  // Reset to home screen (new chat)
  const handleNewChat = () => {
    setQuery("")
    setInConversation(false)
    setIsTransitioning(false)
    setIsLoading(false)
    setInitialTopic(null)
  }

  // Auto-resize textarea based on content
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target
    setQuery(textarea.value)

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = "auto"
    // Set the height to scrollHeight to fit the content
    textarea.style.height = `${Math.min(textarea.scrollHeight, isMobile ? 100 : 120)}px`
  }

  // Focus the input field when clicking anywhere in the input container
  const handleContainerClick = () => {
    inputRef.current?.focus()
  }

  return (
    <div className="fixed inset-0 flex bg-gray-50 overflow-hidden">
      <Sidebar onNewChat={handleNewChat} />

      {/* Only show knowledge map when in conversation */}
      {inConversation && <KnowledgeMapPanel />}

      <div
        className={cn(
          "flex-1 flex flex-col transition-all duration-700 ease-in-out",
          getMainContentMargin(),
          isTransitioning && "opacity-20 scale-98 blur-sm",
        )}
      >
        {inConversation ? (
          // Conversation mode
          <div className="flex flex-col h-full animate-in fade-in duration-500">
            <Conversation initialTopic={initialTopic} onInitialTopicUsed={() => setInitialTopic(null)} />
          </div>
        ) : (
          // Initial input mode
          <div className="flex flex-col justify-center items-center h-full p-4 md:p-6 pt-16 md:pt-20 pb-6 md:pb-16 overflow-auto">
            <div className={cn("w-full transition-all duration-300 flex flex-col items-center", contentWidth)}>
              <h1 className="mb-6 md:mb-8 text-[28px] md:text-[38px] font-medium text-center text-gray-800">Carson</h1>

              <div className="w-full mb-8 md:mb-12">
                <h2 className="text-[22px] md:text-[35px] font-normal text-gray-800 mb-6 md:mb-10 leading-tight mx-auto text-center">
                  Hey, I'm Carson. I'll help you understand medicine like a kind senior would.
                </h2>

                <div className="mt-8 md:mt-12 w-full max-w-3xl mx-auto">
                  <form onSubmit={handleSubmit} className="w-full">
                    <div
                      className="relative rounded-xl bg-white border border-gray-300 shadow-sm hover:border-gray-400 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-200 transition-all duration-200"
                      onClick={handleContainerClick}
                    >
                      {/* Textarea input */}
                      <textarea
                        ref={inputRef}
                        value={query}
                        onChange={handleInput}
                        placeholder="What would you like to understand better?"
                        className="w-full px-3 md:px-4 py-3 md:py-4 min-h-[50px] md:min-h-[60px] max-h-[150px] md:max-h-[200px] text-base md:text-lg bg-transparent border-0 focus:ring-0 focus:outline-none resize-none"
                        style={{ fontSize: "16px" }}
                        rows={1}
                        disabled={isLoading || isTransitioning}
                      />

                      {/* Bottom toolbar */}
                      <div className="flex items-center justify-between border-t border-gray-200 p-1.5 md:p-2 px-2 md:px-3">
                        {/* Left side tools */}
                        <div className="flex items-center space-x-1">
                          <button
                            type="button"
                            className="p-1.5 md:p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                            disabled={isLoading || isTransitioning}
                          >
                            <Plus size={isMobile ? 16 : 18} />
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeepDive(!deepDive)}
                            disabled={isLoading || isTransitioning}
                            className={cn(
                              "p-1.5 md:p-2 rounded-md transition-all duration-200 flex items-center gap-1.5",
                              deepDive
                                ? "bg-blue-100 text-blue-600"
                                : "text-gray-500 hover:text-gray-700 hover:bg-gray-100",
                            )}
                            title={deepDive ? "Deep dive enabled" : "Enable deep dive for detailed explanations"}
                          >
                            <Telescope size={isMobile ? 16 : 18} />
                            {deepDive && <span className="text-xs md:text-sm font-medium">Deep dive</span>}
                          </button>
                        </div>

                        {/* Right side submit */}
                        <button
                          type="submit"
                          disabled={!query.trim() || isLoading || isTransitioning}
                          className={cn(
                            "p-1.5 md:p-2 rounded-full transition-all duration-200",
                            query.trim() && !isLoading && !isTransitioning
                              ? "bg-blue-500 text-white hover:bg-blue-600"
                              : "bg-gray-200 text-gray-400 cursor-not-allowed",
                          )}
                        >
                          {isLoading || isTransitioning ? (
                            <div className="h-4 w-4 md:h-5 md:w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <SendHorizonal size={isMobile ? 16 : 18} />
                          )}
                        </button>
                      </div>
                    </div>
                  </form>

                  {/* Quick action buttons - responsive */}
                  <div className="flex flex-wrap justify-center gap-1.5 md:gap-2 mt-3 md:mt-4">
                    <QuickActionButton icon={<PenLine size={isMobile ? 14 : 16} />} label="Explain" />
                    <QuickActionButton icon={<GraduationCap size={isMobile ? 14 : 16} />} label="Learn" />
                    <QuickActionButton icon={<Code size={isMobile ? 14 : 16} />} label="Mechanisms" />
                    <QuickActionButton icon={<Coffee size={isMobile ? 14 : 16} />} label="Simplify" />
                    <QuickActionButton icon={<Sparkles size={isMobile ? 14 : 16} />} label="Carson's choice" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

interface QuickActionButtonProps {
  icon: React.ReactNode
  label: string
}

function QuickActionButton({ icon, label }: QuickActionButtonProps) {
  const { isMobile } = useSidebarState()

  return (
    <button className="flex items-center gap-1.5 px-2.5 md:px-4 py-1.5 md:py-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700 text-xs md:text-sm font-medium transition-colors">
      {icon}
      {label}
    </button>
  )
}

// Helper function to conditionally join class names
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ")
}
