"use client"

import React, { createContext, useContext, useState } from 'react';
import { QuestionSolverMode, QuestionBank, QuestionBankSession, Question, QuestionResponse } from '@/types/questionBank';

// **DEMO DATA**: Hardcoded question bank for testing
const DEMO_QUESTION_BANK: QuestionBank = {
  id: 'demo-bank-1',
  name: 'Cardiology Basics',
  description: 'Essential cardiology concepts for medical students',
  source: 'Carson Demo',
  subject: 'Cardiology',
  questions: [
    {
      id: 'q1',
      questionText: 'Which of the following is the most common cause of chest pain in young adults?',
      questionType: 'multiple_choice',
      options: [
        { id: 'a', text: 'Myocardial infarction', isCorrect: false },
        { id: 'b', text: 'Costochondritis', isCorrect: true },
        { id: 'c', text: 'Pulmonary embolism', isCorrect: false },
        { id: 'd', text: 'Aortic dissection', isCorrect: false }
      ],
      correctAnswer: 'b',
      explanation: 'Costochondritis (inflammation of chest wall cartilage) is the most common cause of chest pain in young, healthy adults. MI and PE are rare in this population without risk factors.',
      topic: 'Chest Pain',
      difficulty: 'easy',
      source: 'Carson Demo',
      tags: ['chest-pain', 'differential-diagnosis']
    },
    {
      id: 'q2',
      questionText: 'Normal resting heart rate for a healthy adult is typically:',
      questionType: 'multiple_choice',
      options: [
        { id: 'a', text: '40-60 bpm', isCorrect: false },
        { id: 'b', text: '60-100 bpm', isCorrect: true },
        { id: 'c', text: '100-120 bpm', isCorrect: false },
        { id: 'd', text: '120-140 bpm', isCorrect: false }
      ],
      correctAnswer: 'b',
      explanation: 'Normal resting heart rate for adults is 60-100 bpm. Below 60 is bradycardia, above 100 is tachycardia.',
      topic: 'Vital Signs',
      difficulty: 'easy',
      source: 'Carson Demo',
      tags: ['vital-signs', 'normal-values']
    },
    {
      id: 'q3',
      questionText: 'Which ECG finding is most characteristic of acute MI?',
      questionType: 'multiple_choice',
      options: [
        { id: 'a', text: 'ST elevation', isCorrect: true },
        { id: 'b', text: 'Prolonged PR interval', isCorrect: false },
        { id: 'c', text: 'Wide QRS complex', isCorrect: false },
        { id: 'd', text: 'Shortened QT interval', isCorrect: false }
      ],
      correctAnswer: 'a',
      explanation: 'ST elevation in contiguous leads is the hallmark finding of acute STEMI (ST-elevation myocardial infarction).',
      topic: 'ECG Interpretation',
      difficulty: 'medium',
      source: 'Carson Demo',
      tags: ['ecg', 'myocardial-infarction']
    }
  ],
  totalQuestions: 3,
  estimatedTimeMinutes: 5,
  difficulty: 'easy',
  createdAt: new Date()
};

interface QuestionBankContextType {
  currentMode: QuestionSolverMode;
  setMode: (mode: QuestionSolverMode) => void;
  selectedBank: QuestionBank | null;
  selectBank: (bank: QuestionBank | null) => void;
  availableBanks: QuestionBank[];
  addQuestionBank: (bank: QuestionBank) => void;
  currentSession: QuestionBankSession | null;
  sessions: QuestionBankSession[];
  currentQuestion: Question | null;
  startSession: (mode: 'practice' | 'timed' | 'collaborative') => void;
  nextQuestion: () => void;
  previousQuestion: () => void;
  submitAnswer: (response: QuestionResponse) => Promise<void>;
  pauseSession: () => void;
  resumeSession: () => void;
  endSession: () => void;
  resetSession: () => void;
}

const QuestionBankContext = createContext<QuestionBankContextType | undefined>(undefined);

export function QuestionBankProvider({ children }: { children: React.ReactNode }) {
  const [currentMode, setCurrentMode] = useState<QuestionSolverMode>('browse');
  const [selectedBank, setSelectedBank] = useState<QuestionBank | null>(null);
  const [currentSession, setCurrentSession] = useState<QuestionBankSession | null>(null);
  const [sessions, setSessions] = useState<QuestionBankSession[]>([]);
  const [availableBanks, setAvailableBanks] = useState<QuestionBank[]>([DEMO_QUESTION_BANK]);

  const currentQuestion = currentSession && selectedBank 
    ? selectedBank.questions[currentSession.currentQuestionIndex] || null
    : null;

  // Updated to match component usage pattern
  const startSession = (mode: 'practice' | 'timed' | 'collaborative') => {
    if (!selectedBank) return; // Guard clause
    
    const session: QuestionBankSession = {
      id: Date.now().toString(),
      questionBankId: selectedBank.id,
      currentQuestionIndex: 0,
      startedAt: new Date(),
      status: 'in_progress',
      responses: [],
      score: { correct: 0, total: 0, percentage: 0 },
      timeSpent: 0,
      mode
    };
    setCurrentSession(session);
    setCurrentMode('solving');
  };

  // Renamed to match component usage
  const selectBank = (bank: QuestionBank | null) => {
    setSelectedBank(bank);
    if (!bank) {
      setCurrentSession(null); // Clear session when bank is cleared
      setCurrentMode('browse');
    }
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
    const completedSession = {
      ...currentSession,
      status: 'completed' as const,
      completedAt: new Date()
    };
    setCurrentSession(completedSession);
    setSessions(prev => [...prev, completedSession]); // Save to sessions history
    setCurrentMode('review');
  };

  // Added missing methods to match interface
  const endSession = completeSession; // Alias for completeSession
  
  const resetSession = () => {
    setCurrentSession(null);
    setCurrentMode('browse');
  };

  const addQuestionBank = (bank: QuestionBank) => {
    setAvailableBanks(prev => [bank, ...prev]);
  };

  return (
    <QuestionBankContext.Provider value={{
      currentMode,
      setMode: setCurrentMode,
      selectedBank,
      selectBank,
      availableBanks, // Added availableBanks
      addQuestionBank,
      currentSession,
      sessions,
      currentQuestion,
      startSession,
      nextQuestion,
      previousQuestion,
      submitAnswer,
      pauseSession,
      resumeSession,
      endSession,
      resetSession
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