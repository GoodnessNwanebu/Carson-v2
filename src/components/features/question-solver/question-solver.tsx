"use client"

import React, { useState, useEffect, useRef } from 'react';
import { Question, QuestionBank, QuestionBankSession, QuestionResponse, CarsonQuestionInteraction } from '@/types/questionBank';
import { QuestionDisplay } from './question-display';
import { CarsonQuestionChat } from './carson-question-chat';
import { QuestionBankSelector } from './question-bank-selector';
import { SessionProgress } from './session-progress';
import { ResultsReview } from './results-review';
import { useQuestionBank } from './question-bank-context';
import { ResizablePanel } from '@/components/ui/resizable-panel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  FileText, 
  Timer, 
  BarChart3, 
  ArrowLeft, 
  ArrowRight, 
  Pause, 
  Play,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Brain
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Simplified Card components
const QuestionCard = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white border border-gray-200 rounded-xl ${className || ''}`}>
    {children}
  </div>
);

const QuestionCardHeader = ({ children }: { children: React.ReactNode }) => (
  <div className="px-8 py-6 border-b border-gray-100">
    {children}
  </div>
);

const QuestionCardTitle = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <h3 className={`text-xl font-semibold ${className || ''}`}>
    {children}
  </h3>
);

const QuestionCardContent = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={`px-8 py-6 ${className || ''}`}>
    {children}
  </div>
);

export interface QuestionSolverProps {
  className?: string;
}

export function QuestionSolver({ className }: QuestionSolverProps) {
  const {
    selectedBank,
    currentSession,
    sessions,
    selectBank,
    startSession,
    endSession,
    resetSession
  } = useQuestionBank();

  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [currentResponse, setCurrentResponse] = useState<QuestionResponse | null>(null);
  const [carsonInteraction, setCarsonInteraction] = useState<CarsonQuestionInteraction | null>(null);
  const [leftPanelWidth, setLeftPanelWidth] = useState(50);
  const [sessionTime, setSessionTime] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Timer effect
  useEffect(() => {
    if (currentSession && !isPaused && currentSession.status === 'active') {
      timerRef.current = setInterval(() => {
        setSessionTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [currentSession, isPaused]);

  const currentQuestion = currentSession?.questions[currentSession.currentQuestionIndex];

  const handleBankSelect = (bank: QuestionBank) => {
    selectBank(bank);
  };

  const handleStartSession = (mode: 'practice' | 'timed' | 'collaborative') => {
    if (!selectedBank) return;
    startSession(mode);
    setSelectedAnswer('');
    setIsAnswerSubmitted(false);
    setCurrentResponse(null);
    setCarsonInteraction(null);
    setSessionTime(0);
  };

  const handleAnswerSelect = (answer: string) => {
    if (!isAnswerSubmitted) {
      setSelectedAnswer(answer);
    }
  };

  const handleAnswerSubmit = () => {
    if (!currentQuestion || !currentSession) return;

    const response: QuestionResponse = {
      questionId: currentQuestion.id,
      selectedAnswer,
      isCorrect: selectedAnswer === currentQuestion.correctAnswer,
      timeSpent: sessionTime,
      timestamp: new Date()
    };

    setCurrentResponse(response);
    setIsAnswerSubmitted(true);

    // Initialize Carson interaction for collaborative mode
    if (currentSession.mode === 'collaborative') {
      const interaction: CarsonQuestionInteraction = {
        questionId: currentQuestion.id,
        reasoningDiscussion: [],
        explanationProvided: false,
        additionalTopicsExplored: [],
        knowledgeGapsIdentified: [],
        masteryLevel: 'unassessed'
      };
      setCarsonInteraction(interaction);
    }
  };

  const handleNextQuestion = () => {
    if (!currentSession) return;

    setSelectedAnswer('');
    setIsAnswerSubmitted(false);
    setCurrentResponse(null);
    setCarsonInteraction(null);

    // This would typically call a context method to advance to next question
    // For now, we'll just reset the current state
  };

  const handlePauseResume = () => {
    setIsPaused(!isPaused);
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return hours > 0 
      ? `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      : `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Show bank selector if no bank selected
  if (!selectedBank) {
    return <QuestionBankSelector />;
  }

  // Show session complete screen
  if (currentSession?.status === 'completed') {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 p-4 sm:p-6">
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-200 max-w-2xl mx-auto p-6 sm:p-8">
          <div className="text-center mb-6 sm:mb-8">
            <div className="inline-flex items-center gap-3 mb-4">
              <div className="p-3 bg-green-100 rounded-full">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Session Complete!</h2>
            <p className="text-gray-600">Great work on completing the question set.</p>
          </div>
          
          <ResultsReview session={currentSession} />
          
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-6 sm:mt-8">
            <Button onClick={resetSession} variant="outline" className="flex-1 h-12 sm:h-14 border-gray-200 hover:border-gray-300">
              <RotateCcw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
            <Button onClick={() => selectBank(null)} className="flex-1 h-12 sm:h-14 bg-blue-600 hover:bg-blue-700">
              Choose Different Bank
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Show session setup if no active session
  if (!currentSession) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 p-4 sm:p-6">
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-200 max-w-2xl mx-auto p-6 sm:p-8">
          <div className="text-center mb-6 sm:mb-8">
            <div className="inline-flex items-center gap-3 mb-4">
              <div className="p-3 bg-blue-100 rounded-full">
                <FileText className="w-8 h-8 text-blue-600" />
              </div>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{selectedBank.name}</h2>
            <p className="text-gray-600 leading-relaxed">{selectedBank.description}</p>
          </div>
          
          <div className="grid grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
            <div className="text-center p-4 bg-gray-50 rounded-xl">
              <div className="text-xl sm:text-2xl font-bold text-gray-900">{selectedBank.totalQuestions}</div>
              <div className="text-sm text-gray-500">Questions</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-xl">
              <div className="text-xl sm:text-2xl font-bold text-gray-900">~{selectedBank.estimatedTimeMinutes}</div>
              <div className="text-sm text-gray-500">Minutes</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-xl">
              <div className={`text-xl sm:text-2xl font-bold capitalize ${
                selectedBank.difficulty === 'easy' ? 'text-green-600' :
                selectedBank.difficulty === 'medium' ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {selectedBank.difficulty}
              </div>
              <div className="text-sm text-gray-500">Difficulty</div>
            </div>
          </div>

          <div className="space-y-3 sm:space-y-4">
            <Button 
              onClick={() => handleStartSession('practice')} 
              className="w-full h-12 sm:h-14 text-base bg-blue-600 hover:bg-blue-700"
            >
              <FileText className="w-5 h-5 mr-3" />
              Practice Mode
            </Button>
            <Button 
              onClick={() => handleStartSession('timed')} 
              variant="outline" 
              className="w-full h-12 sm:h-14 text-base border-gray-200 hover:border-gray-300"
            >
              <Timer className="w-5 h-5 mr-3" />
              Timed Mode
            </Button>
            <Button 
              onClick={() => handleStartSession('collaborative')} 
              variant="outline" 
              className="w-full h-12 sm:h-14 text-base border-gray-200 hover:border-gray-300"
            >
              <Brain className="w-5 h-5 mr-3" />
              Collaborative with Carson
            </Button>
          </div>

          <Button 
            onClick={() => selectBank(null)} 
            variant="ghost" 
            className="w-full mt-6 sm:mt-8 text-gray-600 hover:text-gray-700"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Choose Different Bank
          </Button>
        </div>
      </div>
    );
  }

  // Main question solving interface
  if (currentSession.mode === 'collaborative') {
    return (
      <div className="h-full flex flex-col bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-semibold">{selectedBank.name}</h1>
              <div className="text-sm text-gray-500">
                Question {currentSession.currentQuestionIndex + 1} of {currentSession.questions.length}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-lg font-mono">{formatTime(sessionTime)}</div>
              <Button variant="outline" size="sm" onClick={handlePauseResume}>
                {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Split View */}
        <div className="flex-1 flex">
          <ResizablePanel
            defaultWidth={leftPanelWidth}
            onResize={setLeftPanelWidth}
            className="border-r border-gray-200"
          >
            <div className="h-full bg-white">
              {currentQuestion && (
                <QuestionDisplay
                  question={currentQuestion}
                  selectedAnswer={selectedAnswer}
                  onAnswerSelect={handleAnswerSelect}
                  onSubmit={handleAnswerSubmit}
                  isSubmitted={isAnswerSubmitted}
                  showExplanation={isAnswerSubmitted}
                />
              )}
            </div>
          </ResizablePanel>

          <div className="flex-1 bg-white">
            {currentQuestion && (
              <CarsonQuestionChat
                question={currentQuestion}
                selectedAnswer={selectedAnswer}
                isAnswerSubmitted={isAnswerSubmitted}
                interaction={carsonInteraction}
                onInteractionUpdate={setCarsonInteraction}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  // Single panel mode for practice/timed
  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold">{selectedBank.name}</h1>
            <div className="text-sm text-gray-500">
              Question {currentSession.currentQuestionIndex + 1} of {currentSession.questions.length}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-lg font-mono">{formatTime(sessionTime)}</div>
            <Button variant="outline" size="sm" onClick={handlePauseResume}>
              {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Question Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-4xl w-full">
          {currentQuestion && (
            <QuestionDisplay
              question={currentQuestion}
              selectedAnswer={selectedAnswer}
              onAnswerSelect={handleAnswerSelect}
              onSubmit={handleAnswerSubmit}
              isSubmitted={isAnswerSubmitted}
              showExplanation={isAnswerSubmitted}
            />
          )}
        </div>
      </div>

      {/* Footer Navigation */}
      {isAnswerSubmitted && (
        <div className="bg-white border-t border-gray-200 px-6 py-4">
          <div className="flex justify-between items-center">
            <Button variant="outline" disabled>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>
            <div className="text-sm text-gray-500">
              {currentResponse?.isCorrect ? 'Correct!' : 'Incorrect'}
            </div>
            <Button onClick={handleNextQuestion}>
              Next Question
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
} 