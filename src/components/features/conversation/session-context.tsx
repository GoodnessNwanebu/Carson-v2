"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { CarsonSessionContext, Message } from "@/lib/prompts/carsonTypes"
import { v4 as uuidv4 } from 'uuid';

interface SessionContextType {
  session: CarsonSessionContext | null
  startSession: (topic: string, sessionId?: string) => void
  addMessage: (message: Message) => void
  updateSession: (updates: Partial<CarsonSessionContext>) => void
  moveToNextSubtopic: () => boolean
  updateSubtopicStatus: (subtopicIndex: number, status: 'gap' | 'shaky' | 'understood') => void
  checkSubtopicCompletion: (subtopicIndex: number) => boolean
  isSessionComplete: () => boolean
  clearSession: () => void
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
      // NEW: Initialize progression tracking
      currentQuestionType: 'parent',
      questionsAskedInCurrentSubtopic: 0,
      correctAnswersInCurrentSubtopic: 0,
      currentSubtopicState: 'assessing',
      shouldTransition: false,
    })
  }

  const addMessage = (message: Message) => {
    setSession((prev) => {
      if (!prev) return null
      return {
        ...prev,
        history: [...prev.history, message],
      }
    })
  }

  const updateSession = (updates: Partial<CarsonSessionContext>) => {
    setSession((prev) => {
      if (!prev) return null
      return { ...prev, ...updates }
    })
  }

  const updateSubtopicStatus = (subtopicIndex: number, status: 'gap' | 'shaky' | 'understood') => {
    setSession((prev) => {
      if (!prev) return null
      const updatedSubtopics = [...prev.subtopics]
      if (updatedSubtopics[subtopicIndex]) {
        updatedSubtopics[subtopicIndex] = {
          ...updatedSubtopics[subtopicIndex],
          status
        }
      }
      return {
        ...prev,
        subtopics: updatedSubtopics
      }
    })
  }

  const checkSubtopicCompletion = (subtopicIndex: number): boolean => {
    if (!session || !session.subtopics[subtopicIndex]) return false
    
    const subtopic = session.subtopics[subtopicIndex]
    
    // A subtopic is complete when:
    // 1. User has answered 2-3 questions correctly, OR
    // 2. User struggled but completed explanation + check-in questions
    const hasEnoughCorrectAnswers = subtopic.correctAnswers >= 2
    const completedAfterExplanation = subtopic.needsExplanation && subtopic.questionsAsked >= 2
    
    return hasEnoughCorrectAnswers || completedAfterExplanation
  }

  const moveToNextSubtopic = (): boolean => {
    if (!session) return false
    
    const currentSubtopic = session.subtopics[session.currentSubtopicIndex]
    if (!currentSubtopic) return false
    
    // Mark current subtopic as understood if complete
    if (checkSubtopicCompletion(session.currentSubtopicIndex)) {
      updateSubtopicStatus(session.currentSubtopicIndex, 'understood')
    }
    
    // Check if there are more subtopics
    if (session.currentSubtopicIndex < session.subtopics.length - 1) {
      updateSession({
        currentSubtopicIndex: session.currentSubtopicIndex + 1,
        questionsAskedInCurrentSubtopic: 0,
        correctAnswersInCurrentSubtopic: 0,
        currentSubtopicState: 'assessing',
        currentQuestionType: 'parent',
        shouldTransition: false
      })
      return true
    }
    
    return false // No more subtopics
  }

  const isSessionComplete = (): boolean => {
    if (!session || session.subtopics.length === 0) return false
    
    // Session is complete when all subtopics are understood
    return session.subtopics.every(subtopic => subtopic.status === 'understood')
  }

  const clearSession = () => {
    setSession(null)
    localStorage.removeItem('carsonSession')
  }

  return (
    <SessionContext.Provider 
      value={{ 
        session, 
        startSession, 
        addMessage, 
        updateSession,
        moveToNextSubtopic,
        updateSubtopicStatus,
        checkSubtopicCompletion,
        isSessionComplete,
        clearSession
      }}
    >
      {children}
    </SessionContext.Provider>
  )
} 