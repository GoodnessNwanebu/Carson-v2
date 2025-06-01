"use client"

import React from 'react';
import { Question } from '@/types/questionBank';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Clock, Tag } from 'lucide-react';
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
    <div className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Question Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-4 sm:mb-6">
            {question.topic && (
              <span className="inline-flex items-center gap-1 px-2 sm:px-3 py-1 bg-blue-50 text-blue-700 text-xs sm:text-sm font-medium rounded-full">
                <Tag className="w-3 h-3" />
                {question.topic}
              </span>
            )}
            {question.difficulty && (
              <span className={cn(
                "px-2 sm:px-3 py-1 text-xs sm:text-sm font-medium rounded-full",
                question.difficulty === 'easy' && "bg-green-50 text-green-700",
                question.difficulty === 'medium' && "bg-yellow-50 text-yellow-700",
                question.difficulty === 'hard' && "bg-red-50 text-red-700"
              )}>
                {question.difficulty}
              </span>
            )}
            {question.timeLimit && (
              <span className="inline-flex items-center gap-1 px-2 sm:px-3 py-1 bg-gray-50 text-gray-600 text-xs sm:text-sm font-medium rounded-full">
                <Clock className="w-3 h-3" />
                {question.timeLimit}s
              </span>
            )}
          </div>

          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 leading-relaxed">
            {question.questionText || question.question}
          </h1>
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
                  "w-full text-left p-4 sm:p-6 rounded-lg sm:rounded-xl border-2 transition-all duration-200",
                  "hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                  "active:scale-[0.98] sm:active:scale-100", // Mobile touch feedback
                  !isSubmitted && "cursor-pointer",
                  isSubmitted && "cursor-default",
                  status === 'default' && !isSelected && "border-gray-200 bg-white hover:border-gray-300",
                  status === 'default' && isSelected && "border-blue-500 bg-blue-50",
                  status === 'correct' && "border-green-500 bg-green-50",
                  status === 'incorrect' && "border-red-500 bg-red-50",
                  status === 'disabled' && "border-gray-200 bg-gray-50 opacity-60"
                )}
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className={cn(
                    "flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold",
                    status === 'default' && !isSelected && "bg-gray-100 text-gray-600",
                    status === 'default' && isSelected && "bg-blue-500 text-white",
                    status === 'correct' && "bg-green-500 text-white",
                    status === 'incorrect' && "bg-red-500 text-white",
                    status === 'disabled' && "bg-gray-200 text-gray-500"
                  )}>
                    {status === 'correct' ? <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4" /> :
                     status === 'incorrect' ? <XCircle className="w-3 h-3 sm:w-4 sm:h-4" /> :
                     optionLetter}
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-900 leading-relaxed text-sm sm:text-base">
                      {typeof option === 'string' ? option : option.text}
                    </p>
                    {isSubmitted && optionLetter === selectedAnswer && optionLetter !== question.correctAnswer && question.wrongAnswerExplanations?.[optionLetter] && (
                      <div className="mt-2 sm:mt-3 p-2 sm:p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-xs sm:text-sm text-red-800">
                          <strong>Why this is incorrect:</strong> {question.wrongAnswerExplanations[optionLetter]}
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
              className="w-full h-12 sm:h-16 text-sm sm:text-lg font-semibold bg-blue-600 hover:bg-blue-700 text-white border-0"
            >
              Submit Answer
            </Button>
          </div>
        )}

        {/* Explanation */}
        {showExplanation && question.explanation && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg sm:rounded-xl p-4 sm:p-6">
            <div className="flex items-start gap-2 sm:gap-3">
              <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-1 sm:mb-2 text-sm sm:text-base">Explanation</h3>
                <p className="text-blue-800 leading-relaxed text-sm sm:text-base">{question.explanation}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 