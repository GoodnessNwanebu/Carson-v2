"use client"

import React, { createContext, useContext } from 'react';

// Minimal session context for UI shell
interface SessionContextType {
  session: { 
    sessionId: string; 
    history: Array<any>;
  } | null;
  addMessage: () => void;
  updateSession: () => void;
  clearSession: () => void;
  startSession: () => void;
  moveToNextSubtopic: () => void;
  checkSubtopicCompletion: () => boolean;
  isSessionComplete: () => boolean;
  completeSessionAndGenerateNotes: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const mockContext: SessionContextType = {
    session: null,
    addMessage: () => {},
    updateSession: () => {},
    clearSession: () => {},
    startSession: () => {},
    moveToNextSubtopic: () => {},
    checkSubtopicCompletion: () => false,
    isSessionComplete: () => false,
    completeSessionAndGenerateNotes: async () => {},
  };

  return (
    <SessionContext.Provider value={mockContext}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
} 