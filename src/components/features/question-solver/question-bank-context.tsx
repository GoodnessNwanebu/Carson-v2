"use client"

import React, { createContext, useContext, useState } from 'react';
import { QuestionSolverMode, QuestionBank, QuestionBankSession, Question, QuestionResponse } from '@/types/questionBank';

interface QuestionBankContextType {
  currentMode: QuestionSolverMode;
  setMode: (mode: QuestionSolverMode) => void;
  selectedBank: QuestionBank | null;
  setSelectedBank: (bank: QuestionBank | null) => void;
  currentSession: QuestionBankSession | null;
  currentQuestion: Question | null;
  startSession: (bank: QuestionBank, mode: 'practice' | 'timed' | 'collaborative') => void;
  nextQuestion: () => void;
  previousQuestion: () => void;
  submitAnswer: (response: QuestionResponse) => Promise<void>;
  pauseSession: () => void;
  resumeSession: () => void;
  completeSession: () => void;
}

const QuestionBankContext = createContext<QuestionBankContextType | undefined>(undefined);

export function QuestionBankProvider({ children }: { children: React.ReactNode }) {
  const [currentMode, setCurrentMode] = useState<QuestionSolverMode>('browse');
  const [selectedBank, setSelectedBank] = useState<QuestionBank | null>(null);
  const [currentSession, setCurrentSession] = useState<QuestionBankSession | null>(null);

  const currentQuestion = currentSession && selectedBank 
    ? selectedBank.questions[currentSession.currentQuestionIndex] || null
    : null;

  const startSession = (bank: QuestionBank, mode: 'practice' | 'timed' | 'collaborative') => {
    const session: QuestionBankSession = {
      id: Date.now().toString(),
      questionBankId: bank.id,
      currentQuestionIndex: 0,
      startedAt: new Date(),
      status: 'in_progress',
      responses: [],
      score: { correct: 0, total: 0, percentage: 0 },
      timeSpent: 0,
      mode
    };
    setCurrentSession(session);
    setSelectedBank(bank);
    setCurrentMode('solving');
  };

  const nextQuestion = () => {
    if (!currentSession || !selectedBank) return;
    const nextIndex = currentSession.currentQuestionIndex + 1;
    if (nextIndex < selectedBank.questions.length) {
      setCurrentSession({
        ...currentSession,
        currentQuestionIndex: nextIndex
      });
    }
  };

  const previousQuestion = () => {
    if (!currentSession) return;
    const prevIndex = currentSession.currentQuestionIndex - 1;
    if (prevIndex >= 0) {
      setCurrentSession({
        ...currentSession,
        currentQuestionIndex: prevIndex
      });
    }
  };

  const submitAnswer = async (response: QuestionResponse) => {
    if (!currentSession) return;
    
    const updatedResponses = [...currentSession.responses, response];
    const correct = updatedResponses.filter(r => r.isCorrect).length;
    const total = updatedResponses.length;
    
    setCurrentSession({
      ...currentSession,
      responses: updatedResponses,
      score: {
        correct,
        total,
        percentage: Math.round((correct / total) * 100)
      }
    });
  };

  const pauseSession = () => {
    if (!currentSession) return;
    setCurrentSession({
      ...currentSession,
      status: 'paused'
    });
  };

  const resumeSession = () => {
    if (!currentSession) return;
    setCurrentSession({
      ...currentSession,
      status: 'in_progress'
    });
  };

  const completeSession = () => {
    if (!currentSession) return;
    setCurrentSession({
      ...currentSession,
      status: 'completed',
      completedAt: new Date()
    });
    setCurrentMode('review');
  };

  return (
    <QuestionBankContext.Provider value={{
      currentMode,
      setMode: setCurrentMode,
      selectedBank,
      setSelectedBank,
      currentSession,
      currentQuestion,
      startSession,
      nextQuestion,
      previousQuestion,
      submitAnswer,
      pauseSession,
      resumeSession,
      completeSession
    }}>
      {children}
    </QuestionBankContext.Provider>
  );
}

export function useQuestionBank() {
  const context = useContext(QuestionBankContext);
  if (context === undefined) {
    throw new Error('useQuestionBank must be used within a QuestionBankProvider');
  }
  return context;
} 