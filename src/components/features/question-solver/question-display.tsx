"use client"

import React from 'react';
import { Question } from '@/types/questionBank';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Clock, Tag, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';

// Temporary placeholder components until actual UI components are created
const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)}>
    {children}
  </div>
);

const CardContent = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("p-6", className)}>
    {children}
  </div>
);

const Badge = ({ children, variant = "default", className }: { 
  children: React.ReactNode; 
  variant?: "default" | "secondary" | "outline"; 
  className?: string 
}) => (
  <span className={cn(
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
    variant === "default" && "bg-primary text-primary-foreground",
    variant === "secondary" && "bg-secondary text-secondary-foreground",
    variant === "outline" && "border border-input bg-background",
    className
  )}>
    {children}
  </span>
);

export interface QuestionDisplayProps {
  question: Question;
  selectedAnswer: string;
  onAnswerSelect: (answer: string) => void;
  onSubmit: () => void;
  isSubmitted: boolean;
  showExplanation: boolean;
}

export function QuestionDisplay({
  question,
  selectedAnswer,
  onAnswerSelect,
  onSubmit,
  isSubmitted,
  showExplanation
}: QuestionDisplayProps) {
  const getOptionLetter = (index: number) => String.fromCharCode(65 + index);

  const getOptionStatus = (option: string) => {
    if (!isSubmitted) return 'default';
    if (option === question.correctAnswer) return 'correct';
    if (option === selectedAnswer && option !== question.correctAnswer) return 'incorrect';
    return 'disabled';
  };

  return (
    <div className="flex flex-col bg-white dark:bg-gray-900 overflow-y-auto"
         style={{ minHeight: '100vh' }}>
      <div className="flex-1">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {/* Question Header Card */}
          <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 sm:p-8 mb-6 sm:mb-8 relative overflow-hidden">
            {/* Carson Brand Decorative Element */}
            <div className="absolute top-0 right-0 w-16 h-16 sm:w-24 sm:h-24 bg-blue-50 dark:bg-blue-900/20 rounded-full -translate-y-8 translate-x-8 sm:-translate-y-12 sm:translate-x-12"></div>
            
            <div className="relative">
              {/* Question Meta Tags */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                {question.topic && (
                  <span className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs sm:text-sm font-medium rounded-full border border-blue-100 dark:border-blue-800">
                    <Tag className="w-3 h-3 sm:w-4 sm:h-4" />
                    {question.topic}
                  </span>
                )}
                {question.difficulty && (
                  <span className={cn(
                    "px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-full border",
                    question.difficulty === 'easy' && "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-100 dark:border-green-800",
                    question.difficulty === 'medium' && "bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-100 dark:border-yellow-800",
                    question.difficulty === 'hard' && "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-100 dark:border-red-800"
                  )}>
                    {question.difficulty}
                  </span>
                )}
                {question.timeLimit && (
                  <span className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs sm:text-sm font-medium rounded-full border border-gray-100 dark:border-gray-700">
                    <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                    {question.timeLimit}s
                  </span>
                )}
              </div>

              {/* Question Text */}
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white leading-relaxed mb-2">
                {question.questionText}
              </h1>
              
              {/* Carson Practice Indicator */}
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-sm font-medium">
                <Brain className="w-4 h-4" />
                <span>Think through this with Carson</span>
              </div>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
            {question.options?.map((option, index) => {
              const optionLetter = getOptionLetter(index);
              const status = getOptionStatus(optionLetter);
              const isSelected = selectedAnswer === optionLetter;

              return (
                <button
                  key={optionLetter}
                  onClick={() => !isSubmitted && onAnswerSelect(optionLetter)}
                  disabled={isSubmitted}
                  className={cn(
                    "w-full text-left p-4 sm:p-6 rounded-xl sm:rounded-2xl border-2 transition-all duration-200 shadow-sm",
                    "hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900",
                    "active:scale-[0.98] sm:active:scale-[0.99]", // Mobile touch feedback
                    !isSubmitted && "cursor-pointer",
                    isSubmitted && "cursor-default",
                    status === 'default' && !isSelected && "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-200 dark:hover:border-blue-700 hover:bg-blue-50/50 dark:hover:bg-blue-900/10",
                    status === 'default' && isSelected && "border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20",
                    status === 'correct' && "border-green-500 dark:border-green-400 bg-green-50 dark:bg-green-900/20",
                    status === 'incorrect' && "border-red-500 dark:border-red-400 bg-red-50 dark:bg-red-900/20",
                    status === 'disabled' && "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 opacity-60"
                  )}
                >
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className={cn(
                      "flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-sm sm:text-base font-bold transition-all duration-200",
                      status === 'default' && !isSelected && "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400",
                      status === 'default' && isSelected && "bg-blue-500 dark:bg-blue-600 text-white",
                      status === 'correct' && "bg-green-500 dark:bg-green-600 text-white",
                      status === 'incorrect' && "bg-red-500 dark:bg-red-600 text-white",
                      status === 'disabled' && "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-500"
                    )}>
                      {status === 'correct' ? <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" /> :
                       status === 'incorrect' ? <XCircle className="w-4 h-4 sm:w-5 sm:h-5" /> :
                       optionLetter}
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-900 dark:text-white leading-relaxed text-sm sm:text-base lg:text-lg font-medium">
                        {typeof option === 'string' ? option : option.text}
                      </p>
                      {isSubmitted && optionLetter === selectedAnswer && optionLetter !== question.correctAnswer && question.wrongAnswerExplanations?.[optionLetter] && (
                        <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                          <p className="text-sm sm:text-base text-red-800 dark:text-red-300 leading-relaxed">
                            <strong className="font-semibold">Why this is incorrect:</strong> {question.wrongAnswerExplanations[optionLetter]}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Submit Button */}
          {!isSubmitted && selectedAnswer && (
            <div className="mb-6 sm:mb-8">
              <Button 
                onClick={onSubmit}
                size="lg" 
                className="w-full h-14 sm:h-16 text-base sm:text-lg font-semibold bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white border-0 shadow-sm transition-all duration-200 rounded-xl"
              >
                <Brain className="w-5 h-5 sm:w-6 sm:h-6 mr-3" />
                Submit Answer to Carson
              </Button>
            </div>
          )}

          {/* Explanation */}
          {showExplanation && question.explanation && (
            <div className="bg-gradient-to-br from-blue-50 to-green-50 dark:from-blue-900/20 dark:to-green-900/20 border border-blue-200 dark:border-blue-800 rounded-xl sm:rounded-2xl p-6 sm:p-8 relative overflow-hidden">
              {/* Carson Brand Decorative Element */}
              <div className="absolute top-0 right-0 w-16 h-16 bg-white/20 rounded-full -translate-y-8 translate-x-8"></div>
              
              <div className="relative flex items-start gap-3 sm:gap-4">
                <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-blue-600 dark:bg-blue-500 rounded-full flex items-center justify-center">
                  <Brain className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-blue-900 dark:text-blue-100 mb-2 sm:mb-3 text-base sm:text-lg">Carson's Explanation</h3>
                  <p className="text-blue-800 dark:text-blue-200 leading-relaxed text-sm sm:text-base">{question.explanation}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 