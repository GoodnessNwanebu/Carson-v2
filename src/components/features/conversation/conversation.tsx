"use client"

import type React from "react"
import { useState, createContext, useContext } from "react"
import { cn } from "@/lib/utils"
import { ArrowUp, Mic, MicOff } from "lucide-react"

// Simple scroll context for UI shell
interface ScrollContextType {
  isScrolled: boolean;
  showStickyHeader: boolean;
}

const ScrollContext = createContext<ScrollContextType>({ 
  isScrolled: false, 
  showStickyHeader: false 
});

export const useScrollContext = () => useContext(ScrollContext);

export function Conversation() {
  const [input, setInput] = useState("")
  const [messages] = useState<Array<{id: string, role: "user" | "assistant", content: string}>>([])

  const scrollContextValue = {
    isScrolled: false,
    showStickyHeader: false
  };

  return (
    <ScrollContext.Provider value={scrollContextValue}>
      <div className="flex flex-col h-full bg-white">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <h2 className="text-xl font-semibold mb-2">Welcome to Carson V3</h2>
                <p>UI Shell - Backend functionality coming soon!</p>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex w-full",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-3 shadow-sm",
                    message.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-900"
                  )}
                >
                  {message.content}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-200 bg-white px-4 py-4">
          <form className="flex items-end space-x-3">
            <div className="flex-1 relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Carson about any medical topic..."
                className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 pr-12 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                style={{ minHeight: '48px' }}
              />
              
              <button
                type="button"
                className="absolute right-3 top-1/2 transform -translate-y-1/2 p-2 rounded-full transition-colors bg-gray-100 text-gray-600 hover:bg-gray-200"
              >
                <Mic className="h-4 w-4" />
              </button>
            </div>
            
            <button
              type="submit"
              disabled={!input.trim()}
              className={cn(
                "flex items-center justify-center w-12 h-12 rounded-xl transition-colors",
                input.trim()
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              )}
            >
              <ArrowUp className="h-5 w-5" />
            </button>
          </form>
        </div>
      </div>
    </ScrollContext.Provider>
  );
} 