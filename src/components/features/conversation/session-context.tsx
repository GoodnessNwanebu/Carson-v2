"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { CarsonSessionContext, Subtopic, Message } from "@/lib/prompts/carsonTypes"
import { v4 as uuidv4 } from 'uuid';

interface SessionContextType {
  session: CarsonSessionContext | null
  startSession: (topic: string, sessionId?: string) => void
  addMessage: (message: Message) => void
  updateSubtopicStatus: (subtopicId: string, status: Subtopic["status"]) => void
}

const SessionContext = createContext<SessionContextType | undefined>(undefined)

export function useSession() {
  const context = useContext(SessionContext)
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider")
  }
  return context
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<CarsonSessionContext | null>(null)

  // Load session from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('carsonSession');
    if (saved) {
      setSession(JSON.parse(saved));
    }
  }, []);

  // Save session to localStorage on every update
  useEffect(() => {
    if (session) {
      localStorage.setItem('carsonSession', JSON.stringify(session));
    }
  }, [session]);

  const startSession = (topic: string, sessionId?: string) => {
    setSession({
      sessionId: sessionId || uuidv4(),
      topic,
      subtopics: [], // Will be populated by LLM
      currentSubtopicIndex: 0,
      history: [],
    })
  }

  const addMessage = (message: Message) => {
    setSession((prev) => {
      if (!prev) return null
      // Add to current subtopic history if subtopics exist
      const updatedSubtopics = prev.subtopics.map((subtopic, index) =>
        index === prev.currentSubtopicIndex
          ? { ...subtopic, history: [...(subtopic.history || []), message] }
          : subtopic
      )
      return {
        ...prev,
        subtopics: updatedSubtopics,
        history: [...(prev.history || []), message],
      }
    })
  }

  const updateSubtopicStatus = (subtopicId: string, status: Subtopic["status"]) => {
    if (!session) return

    setSession((prev) => {
      if (!prev) return null

      return {
        ...prev,
        subtopics: prev.subtopics.map((subtopic) =>
          subtopic.id === subtopicId ? { ...subtopic, status } : subtopic
        ),
      }
    })
  }

  return (
    <SessionContext.Provider value={{ session, startSession, addMessage, updateSubtopicStatus }}>
      {children}
    </SessionContext.Provider>
  )
} 