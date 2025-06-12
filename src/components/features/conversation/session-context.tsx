"use client"

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react"
import { CarsonSessionContext, Message } from "@/lib/prompts/carsonTypes"
import { v4 as uuidv4 } from 'uuid';

interface SessionContextType {
  session: CarsonSessionContext | null
  startSession: (topic: string, sessionId?: string, loadExisting?: boolean) => Promise<void>
  addMessage: (message: Message) => void
  updateSession: (updates: Partial<CarsonSessionContext>) => void
  moveToNextSubtopic: () => boolean
  updateSubtopicStatus: (subtopicIndex: number, status: 'gap' | 'shaky' | 'understood') => void
  checkSubtopicCompletion: (subtopicIndex: number) => boolean
  isSessionComplete: () => boolean
  clearSession: () => void
  resetSession: () => Promise<void>
  completeSessionAndGenerateNotes: () => Promise<any>
}

const SessionContext = createContext<SessionContextType | null>(null)

export function useSession() {
  const context = useContext(SessionContext)
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider")
  }
  return context
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<CarsonSessionContext | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSavedSessionRef = useRef<string | null>(null)

  // **ENHANCED FIX**: Load session from localStorage with validation to prevent corruption
  useEffect(() => {
    const savedSession = localStorage.getItem('carsonSession')
    if (savedSession) {
      try {
        const parsedSession = JSON.parse(savedSession)
        
        // **VALIDATE SESSION INTEGRITY** before restoring
        const isValidSession = (
          parsedSession.sessionId && 
          parsedSession.sessionId !== 'unknown' &&
          parsedSession.topic && 
          parsedSession.topic !== 'undefined' &&
          Array.isArray(parsedSession.subtopics) &&
          typeof parsedSession.currentSubtopicIndex === 'number' &&
          Array.isArray(parsedSession.history)
        );
        
        if (isValidSession) {
          console.log('✅ [SessionProvider] Restoring valid session from localStorage:', { 
            sessionId: parsedSession.sessionId, 
            topic: parsedSession.topic,
            subtopicsCount: parsedSession.subtopics?.length || 0
          })
          setSession(parsedSession)
          
          // **NEW**: Reset the last saved session hash to prevent immediate duplicate saves
          const sessionHash = JSON.stringify({
            sessionId: parsedSession.sessionId,
            topic: parsedSession.topic,
            subtopicsCount: parsedSession.subtopics?.length || 0,
            historyLength: parsedSession.history?.length || 0,
            currentSubtopicIndex: parsedSession.currentSubtopicIndex,
            isComplete: parsedSession.isComplete
          })
          lastSavedSessionRef.current = sessionHash
        } else {
          console.warn('❌ [SessionProvider] Invalid session detected in localStorage, clearing:', {
            sessionId: parsedSession.sessionId,
            topic: parsedSession.topic,
            hasValidId: !!parsedSession.sessionId,
            hasValidTopic: !!parsedSession.topic
          })
          localStorage.removeItem('carsonSession')
        }
      } catch (error) {
        console.error('❌ [SessionProvider] Failed to restore session from localStorage:', error)
        localStorage.removeItem('carsonSession')
      }
    }
  }, [])
  
  // Save session to localStorage on every update
  useEffect(() => {
    if (session) {
      localStorage.setItem('carsonSession', JSON.stringify(session));
    }
  }, [session]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  const startSession = async (topic: string, sessionId?: string, loadExisting: boolean = true) => {
    // If sessionId is provided AND we want to load existing, try to load from database
    if (sessionId && loadExisting) {
      try {
        console.log('🔄 [SessionProvider] Loading existing session:', sessionId)
        const response = await fetch(`/api/sessions/load?sessionId=${sessionId}`)
        
        if (response.ok) {
          const { session: existingSession } = await response.json()
          console.log('📡 [SessionProvider] API response:', existingSession)
          
          if (existingSession && existingSession.session_data) {
            console.log('✅ [SessionProvider] Loaded existing session from database')
            console.log('📋 [SessionProvider] Session data:', {
              sessionId: existingSession.session_data.sessionId,
              topic: existingSession.session_data.topic,
              historyLength: existingSession.session_data.history?.length || 0,
              subtopicsCount: existingSession.session_data.subtopics?.length || 0,
              isComplete: existingSession.session_data.isComplete
            })
            setSession(existingSession.session_data)
            return
          } else {
            console.warn('⚠️ [SessionProvider] Session data structure invalid:', existingSession)
          }
        } else {
          console.warn('⚠️ [SessionProvider] API request failed:', response.status, response.statusText)
        }
        
        console.warn('⚠️ [SessionProvider] Could not load existing session, creating new one')
      } catch (error) {
        console.error('❌ [SessionProvider] Error loading session:', error)
      }
    }

    // Create new session (either no sessionId provided, loadExisting=false, or loading failed)
    console.log('🆕 [SessionProvider] Creating new session')
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
      isComplete: false,
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
      
      // **VALIDATE UPDATES** to prevent corruption
      const validatedUpdates = { ...updates };
      
      // Ensure core fields never become undefined/invalid
      if ('sessionId' in updates && (!updates.sessionId || updates.sessionId === 'unknown')) {
        console.warn('❌ [SessionProvider] Preventing sessionId corruption:', updates.sessionId)
        delete validatedUpdates.sessionId
      }
      
      if ('topic' in updates && (!updates.topic || updates.topic === 'undefined')) {
        console.warn('❌ [SessionProvider] Preventing topic corruption:', updates.topic)
        delete validatedUpdates.topic
      }
      
      if ('currentSubtopicIndex' in updates && typeof updates.currentSubtopicIndex !== 'number') {
        console.warn('❌ [SessionProvider] Preventing currentSubtopicIndex corruption:', updates.currentSubtopicIndex)
        delete validatedUpdates.currentSubtopicIndex
      }
      
      const newSession = { ...prev, ...validatedUpdates }
      
      // **FINAL VALIDATION**: Ensure session integrity
      if (!newSession.sessionId || !newSession.topic || newSession.sessionId === 'unknown' || newSession.topic === 'undefined') {
        console.error('❌ [SessionProvider] Session corruption detected, preserving original:', {
          originalSessionId: prev.sessionId,
          originalTopic: prev.topic,
          updatedSessionId: newSession.sessionId,
          updatedTopic: newSession.topic
        })
        return prev // Return original session if corruption detected
      }
      
      // **NEW**: Debounced auto-save to database when session updates
      debouncedSaveToDatabase(newSession)
      
      return newSession
    })
  }

  // **NEW**: Debounced save to prevent duplicate database calls
  const debouncedSaveToDatabase = (sessionData: CarsonSessionContext) => {
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Create session hash to detect if session actually changed
    const sessionHash = JSON.stringify({
      sessionId: sessionData.sessionId,
      topic: sessionData.topic,
      subtopicsCount: sessionData.subtopics?.length || 0,
      historyLength: sessionData.history?.length || 0,
      currentSubtopicIndex: sessionData.currentSubtopicIndex,
      isComplete: sessionData.isComplete
    })

    // Skip save if session hasn't actually changed
    if (lastSavedSessionRef.current === sessionHash) {
      console.log('⏭️ [SessionProvider] Session unchanged, skipping database save')
      return
    }

    // Set new timeout for debounced save
    saveTimeoutRef.current = setTimeout(() => {
      saveSessionToDatabase(sessionData, sessionHash)
    }, 1000) // 1 second debounce
  }

  // **NEW**: Save session to database with duplicate prevention
  const saveSessionToDatabase = async (sessionData: CarsonSessionContext, sessionHash: string) => {
    // Prevent concurrent saves
    if (isSaving) {
      console.log('⏳ [SessionProvider] Save already in progress, skipping')
      return
    }

    setIsSaving(true)
    
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save session')
      }

      // Update last saved session hash
      lastSavedSessionRef.current = sessionHash
      console.log('✅ [SessionProvider] Session auto-saved to database')
    } catch (error) {
      console.error('❌ [SessionProvider] Database save failed:', error)
      // Don't throw - continue with local session management
    } finally {
      setIsSaving(false)
    }
  }

  // **NEW**: Generate study notes when session completes
  const completeSessionAndGenerateNotes = async () => {
    if (!session) return null
    
    try {
      // 1. Mark session as complete and save
      const completedSession = { ...session, isComplete: true }
      const sessionHash = JSON.stringify({
        sessionId: completedSession.sessionId,
        topic: completedSession.topic,
        subtopicsCount: completedSession.subtopics?.length || 0,
        historyLength: completedSession.history?.length || 0,
        currentSubtopicIndex: completedSession.currentSubtopicIndex,
        isComplete: completedSession.isComplete
      })
      await saveSessionToDatabase(completedSession, sessionHash)
      
      // 2. Generate study notes
      console.log('📝 [SessionProvider] Generating study notes for session:', session.sessionId)
      const response = await fetch('/api/study-notes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.sessionId })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate study notes')
      }

      const { notes } = await response.json()
      console.log('✅ [SessionProvider] Study notes generated successfully')
      
      return notes
    } catch (error) {
      console.error('❌ [SessionProvider] Failed to generate study notes:', error)
      return null
    }
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
    console.log('🧹 [SessionProvider] Clearing session')
    setSession(null)
    localStorage.removeItem('carsonSession')
  }

  const resetSession = async () => {
    const topicToReset = session?.topic || ''
    const sessionIdToReset = session?.sessionId
    clearSession()
    await startSession(topicToReset, sessionIdToReset)
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
        clearSession,
        resetSession,
        completeSessionAndGenerateNotes
      }}
    >
      {children}
    </SessionContext.Provider>
  )
} 