"use client"

import React, { useState } from 'react';
import { QuestionDisplay } from './question-display';
import { QuestionBankSelector } from './question-bank-selector';
import { useQuestionBank } from './question-bank-context';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  CheckCircle2,
  RotateCcw,
  ArrowLeft, 
  ArrowRight,
  Brain
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface QuestionSolverProps {
  className?: string;
}

export function QuestionSolver({ className }: QuestionSolverProps) {
  const {
    selectedBank,
    currentSession,
    selectBank,
    startSession,
    resetSession,
    nextQuestion
  } = useQuestionBank();

  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [userAnswers, setUserAnswers] = useState<Record<string, { answer: string; isCorrect: boolean }>>({});

  const currentQuestion = currentSession && selectedBank
    ? selectedBank.questions[currentSession.currentQuestionIndex]
    : null;

  const handleAnswerSelect = (answer: string) => {
    if (!isAnswerSubmitted) {
      setSelectedAnswer(answer);
    }
  };

  const handleAnswerSubmit = () => {
    if (!currentQuestion || !selectedAnswer) return;

    const isCorrect = selectedAnswer === currentQuestion.correctAnswer;
    setUserAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: { answer: selectedAnswer, isCorrect }
    }));
    setIsAnswerSubmitted(true);
  };

  const handleNextQuestion = () => {
    if (!currentSession || !selectedBank) return;

    // Check if this was the last question
    if (currentSession.currentQuestionIndex >= selectedBank.questions.length - 1) {
      // Complete the session
      return;
    }

    // Move to next question
    nextQuestion();
    setSelectedAnswer('');
    setIsAnswerSubmitted(false);
  };

  const calculateResults = () => {
    if (!selectedBank) return { correct: 0, total: 0, percentage: 0 };
    
    const correct = Object.values(userAnswers).filter(a => a.isCorrect).length;
    const total = selectedBank.questions.length;
    return { correct, total, percentage: Math.round((correct / total) * 100) };
  };

  // Show bank selector if no bank selected
  if (!selectedBank) {
    return <QuestionBankSelector />;
  }

  // Show session setup if no active session
  if (!currentSession) {
    return (
      <div className="h-full flex flex-col bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
        <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
          <div className="w-full max-w-2xl mx-auto">
            <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 sm:p-8 relative overflow-hidden">
              {/* Carson Brand Decorative Elements */}
              <div className="absolute top-0 right-0 w-24 h-24 sm:w-32 sm:h-32 bg-blue-50 dark:bg-blue-900/20 rounded-full -translate-y-12 translate-x-12 sm:-translate-y-16 sm:translate-x-16"></div>
              <div className="absolute bottom-0 left-0 w-16 h-16 sm:w-24 sm:h-24 bg-blue-50 dark:bg-blue-900/20 rounded-full translate-y-8 -translate-x-8 sm:translate-y-12 sm:-translate-x-12"></div>
              
              <div className="relative">
                {/* Carson Header */}
                <div className="text-center mb-6 sm:mb-8">
                  <div className="inline-flex items-center gap-3 sm:gap-4 bg-blue-600 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-full shadow-sm mb-6 sm:mb-8">
                    <Brain className="w-5 h-5 sm:w-6 sm:h-6" />
                    <span className="text-lg sm:text-xl font-bold">Carson Practice</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">{selectedBank.name}</h2>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-base sm:text-lg">{selectedBank.description}</p>
                </div>
                
                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
                  <div className="text-center p-4 sm:p-6 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-100 dark:border-gray-600">
                    <div className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">{selectedBank.totalQuestions}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">Questions</div>
                  </div>
                  <div className="text-center p-4 sm:p-6 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-100 dark:border-gray-600">
                    <div className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">~{selectedBank.estimatedTimeMinutes}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">Minutes</div>
                  </div>
                  <div className="text-center p-4 sm:p-6 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-100 dark:border-gray-600">
                    <div className={cn(
                      "text-xl sm:text-2xl font-bold capitalize",
                      selectedBank.difficulty === 'easy' ? 'text-green-600 dark:text-green-400' :
                      selectedBank.difficulty === 'medium' ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-red-600 dark:text-red-400'
                    )}>
                      {selectedBank.difficulty}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">Difficulty</div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3 sm:space-y-4">
                  <Button 
                    onClick={() => startSession('practice')} 
                    className="w-full h-12 sm:h-14 text-base bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 shadow-sm transition-all duration-200"
                  >
                    <Brain className="w-5 h-5 mr-3" />
                    Start Practice with Carson
                  </Button>
                </div>

                <Button 
                  onClick={() => selectBank(null)} 
                  variant="ghost" 
                  className="w-full mt-6 sm:mt-8 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-200"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Choose Different Bank
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show session complete screen
  const isSessionComplete = currentSession && currentSession.currentQuestionIndex >= selectedBank.questions.length;
  if (isSessionComplete) {
    const results = calculateResults();
    
    return (
      <div className="h-full flex flex-col bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
        <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
          <div className="w-full max-w-2xl mx-auto">
            <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 sm:p-8 relative overflow-hidden">
              {/* Carson Brand Decorative Elements */}
              <div className="absolute top-0 right-0 w-24 h-24 sm:w-32 sm:h-32 bg-green-50 dark:bg-green-900/20 rounded-full -translate-y-12 translate-x-12 sm:-translate-y-16 sm:translate-x-16"></div>
              <div className="absolute bottom-0 left-0 w-16 h-16 sm:w-24 sm:h-24 bg-green-50 dark:bg-green-900/20 rounded-full translate-y-8 -translate-x-8 sm:translate-y-12 sm:-translate-x-12"></div>
              
              <div className="relative">
                {/* Carson Success Header */}
                <div className="text-center mb-6 sm:mb-8">
                  <div className="inline-flex items-center gap-3 sm:gap-4 bg-green-600 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-full shadow-sm mb-6 sm:mb-8">
                    <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
                    <span className="text-lg sm:text-xl font-bold">Session Complete!</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">Great work!</h2>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed">You've completed the question set. Carson is proud of your progress!</p>
                </div>
                
                {/* Results Grid */}
                <div className="bg-gradient-to-br from-blue-50 to-green-50 dark:from-blue-900/20 dark:to-green-900/20 rounded-xl p-6 sm:p-8 mb-6 sm:mb-8 border border-blue-100 dark:border-blue-800">
                  <div className="grid grid-cols-3 gap-4 sm:gap-6 text-center">
                    <div>
                      <div className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400">{results.correct}</div>
                      <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Correct</div>
                    </div>
                    <div>
                      <div className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400">{results.total}</div>
                      <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Total</div>
                    </div>
                    <div>
                      <div className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400">{results.percentage}%</div>
                      <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Score</div>
                    </div>
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                  <Button 
                    onClick={resetSession} 
                    variant="outline" 
                    className="flex-1 h-12 sm:h-14 border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Try Again
                  </Button>
                  <Button 
                    onClick={() => selectBank(null)} 
                    className="flex-1 h-12 sm:h-14 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 shadow-sm transition-all duration-200"
                  >
                    Choose Different Bank
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main question interface
  return (
    <div className="flex flex-col bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 overflow-y-auto"
         style={{ minHeight: '100vh' }}>
      {/* Carson Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4 shadow-sm">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Carson Logo */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-600 rounded-full flex items-center justify-center">
                <div className="w-3 h-3 sm:w-4 sm:h-4 bg-white rounded-full"></div>
              </div>
              <span className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Carson</span>
            </div>
            <div className="w-px h-6 bg-gray-300 dark:bg-gray-600"></div>
            <h1 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">{selectedBank.name}</h1>
          </div>
          
          {/* Progress */}
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Question {currentSession.currentQuestionIndex + 1} of {selectedBank.questions.length}
            </div>
            <div className="w-24 sm:w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${((currentSession.currentQuestionIndex + 1) / selectedBank.questions.length) * 100}%` 
                }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex" style={{ minHeight: 0 }}>
        <QuestionDisplay
          question={currentQuestion!}
          selectedAnswer={selectedAnswer}
          onAnswerSelect={handleAnswerSelect}
          onSubmit={handleAnswerSubmit}
          isSubmitted={isAnswerSubmitted}
          showExplanation={isAnswerSubmitted}
        />
      </div>
      
      {/* Footer Navigation */}
      {isAnswerSubmitted && (
        <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4 shadow-sm">
          <div className="flex justify-between items-center">
            <div className="text-sm font-medium">
              {userAnswers[currentQuestion?.id || '']?.isCorrect ? (
                <span className="text-green-600 dark:text-green-400">✓ Correct!</span>
              ) : (
                <span className="text-red-600 dark:text-red-400">✗ Incorrect</span>
              )}
            </div>
            <Button 
              onClick={handleNextQuestion}
              className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 shadow-sm transition-all duration-200"
            >
              {currentSession.currentQuestionIndex >= selectedBank.questions.length - 1 ? 'Finish' : 'Next Question'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
