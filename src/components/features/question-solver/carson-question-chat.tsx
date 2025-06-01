"use client"

import React, { useState, useRef, useEffect } from 'react';
import { Question, CarsonQuestionInteraction, ConversationMessage } from '@/types/questionBank';
import { Button } from '@/components/ui/button';
import { Send, Brain, Lightbulb, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CarsonQuestionChatProps {
  question: Question;
  selectedAnswer: string;
  isAnswerSubmitted: boolean;
  interaction: CarsonQuestionInteraction | null;
  onInteractionUpdate: (interaction: CarsonQuestionInteraction) => void;
}

export function CarsonQuestionChat({
  question,
  selectedAnswer,
  isAnswerSubmitted,
  interaction,
  onInteractionUpdate
}: CarsonQuestionChatProps) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Fix hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [interaction?.reasoningDiscussion]);

  // Initialize conversation when answer is submitted
  useEffect(() => {
    if (isAnswerSubmitted && !interaction?.reasoningDiscussion.length) {
      initializeConversation();
    }
  }, [isAnswerSubmitted, interaction]);

  const initializeConversation = async () => {
    if (!interaction) return;

    const isCorrect = selectedAnswer === question.correctAnswer;
    
    let initialMessage: string;
    if (isCorrect) {
      initialMessage = "Great job! You got that right. I'd love to understand your reasoning - what made you choose that answer? Walk me through your thought process.";
    } else {
      initialMessage = "I see you selected a different answer than expected. No worries at all - this is a great learning opportunity! Can you tell me what your reasoning was for choosing that option?";
    }

    const carsonMessage: ConversationMessage = {
      id: Date.now().toString(),
      role: 'carson',
      content: initialMessage,
      timestamp: new Date()
    };

    const updatedInteraction: CarsonQuestionInteraction = {
      ...interaction,
      reasoningDiscussion: [carsonMessage]
    };

    onInteractionUpdate(updatedInteraction);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !interaction) return;

    setIsLoading(true);

    // Add user message
    const userMessage: ConversationMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    const updatedMessages = [...interaction.reasoningDiscussion, userMessage];
    setInput('');

    // Get Carson's response
    try {
      const carsonResponse = await generateCarsonResponse(
        question,
        selectedAnswer,
        updatedMessages,
        interaction
      );

      const carsonMessage: ConversationMessage = {
        id: (Date.now() + 1).toString(),
        role: 'carson',
        content: carsonResponse.content,
        timestamp: new Date()
      };

      const finalMessages = [...updatedMessages, carsonMessage];

      const finalInteraction: CarsonQuestionInteraction = {
        ...interaction,
        reasoningDiscussion: finalMessages,
        explanationProvided: carsonResponse.explanationProvided || interaction.explanationProvided,
        additionalTopicsExplored: [
          ...interaction.additionalTopicsExplored,
          ...carsonResponse.additionalTopics
        ],
        knowledgeGapsIdentified: [
          ...interaction.knowledgeGapsIdentified,
          ...carsonResponse.knowledgeGaps
        ],
        masteryLevel: carsonResponse.masteryLevel || interaction.masteryLevel
      };

      onInteractionUpdate(finalInteraction);
    } catch (error) {
      console.error('Error generating Carson response:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as React.FormEvent);
    }
  };

  const renderMessage = (message: ConversationMessage) => {
    const isCarson = message.role === 'carson';
    
    return (
      <div
        key={message.id}
        className={cn(
          "flex gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg",
          isCarson ? "bg-blue-50" : "bg-gray-50"
        )}
      >
        <div className={cn(
          "flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-white",
          isCarson ? "bg-blue-600" : "bg-gray-600"
        )}>
          {isCarson ? (
            <Brain className="w-3 h-3 sm:w-4 sm:h-4" />
          ) : (
            <MessageSquare className="w-3 h-3 sm:w-4 sm:h-4" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-xs sm:text-sm">
              {isCarson ? 'Carson' : 'You'}
            </span>
            <span className="text-xs text-muted-foreground" suppressHydrationWarning>
              {isMounted ? message.timestamp.toLocaleTimeString() : '--:--'}
            </span>
          </div>
          <div className="text-xs sm:text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
            {message.content}
          </div>
        </div>
      </div>
    );
  };

  const suggestQuestions = () => {
    const isCorrect = selectedAnswer === question.correctAnswer;
    
    if (isCorrect) {
      return [
        "Can you explain why the other options were incorrect?",
        "How would you teach this concept to a classmate?",
        "What similar questions might I encounter on exams?"
      ];
    } else {
      return [
        "I'm not sure why I got this wrong. Can you explain?",
        "What should I have looked for in the question?",
        "Help me understand the correct reasoning."
      ];
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Messages area */}
      <ChatScrollArea className="flex-1 p-3 sm:p-4">
        <div className="space-y-3 sm:space-y-4">
          {!interaction?.reasoningDiscussion.length && !isAnswerSubmitted && (
            <div className="text-center py-6 sm:py-8 text-muted-foreground">
              <Brain className="w-8 h-8 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 text-blue-400" />
              <p className="text-sm sm:text-base">Submit your answer to start discussing with Carson!</p>
            </div>
          )}
          
          {interaction?.reasoningDiscussion.map(renderMessage)}
          
          {isLoading && (
            <div className="flex gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg bg-blue-50">
              <div className="flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-blue-600 flex items-center justify-center text-white">
                <Brain className="w-3 h-3 sm:w-4 sm:h-4" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-xs sm:text-sm mb-1">Carson</div>
                <div className="text-xs sm:text-sm text-gray-700">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin w-3 h-3 sm:w-4 sm:h-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                    Thinking...
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        <div ref={messagesEndRef} />
      </ChatScrollArea>

      {/* Input area */}
      {isAnswerSubmitted && (
        <div className="border-t p-3 sm:p-4 bg-background">
          {!interaction?.reasoningDiscussion.length && (
            <div className="mb-3 sm:mb-4">
              <p className="text-xs sm:text-sm text-muted-foreground mb-2">Quick start:</p>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {suggestQuestions().map((suggestion, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => setInput(suggestion)}
                    className="text-xs h-8 px-2 sm:px-3"
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="flex gap-2">
            <ChatTextarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask Carson about your reasoning, request explanations, or explore related concepts..."
              className="flex-1 resize-none text-sm sm:text-base min-h-[80px] sm:min-h-[80px]"
              rows={3}
            />
            <Button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="self-end h-10 w-10 sm:h-12 sm:w-12 p-0"
            >
              <Send className="w-3 h-3 sm:w-4 sm:h-4" />
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}

// Helper function to generate Carson's responses
async function generateCarsonResponse(
  question: Question,
  selectedAnswer: string,
  messages: ConversationMessage[],
  interaction: CarsonQuestionInteraction
): Promise<{
  content: string;
  explanationProvided: boolean;
  additionalTopics: string[];
  knowledgeGaps: string[];
  masteryLevel: CarsonQuestionInteraction['masteryLevel'];
}> {
  // This would integrate with the existing Carson LLM service
  // For now, return a mock response
  const isCorrect = selectedAnswer === question.correctAnswer;
  const lastUserMessage = messages[messages.length - 1]?.content || '';

  // Simple mock logic - in reality this would call the Carson LLM service
  let content = '';
  
  if (lastUserMessage.toLowerCase().includes('explain') || lastUserMessage.toLowerCase().includes('why')) {
    content = isCorrect 
      ? `Excellent reasoning! Let me break down why your answer was correct: ${question.explanation}\n\nThe key insight here is understanding the underlying mechanism. Would you like me to explain why the other options were incorrect as well?`
      : `Great question! Let me explain the correct reasoning: ${question.explanation}\n\nThe mistake in your reasoning was likely [specific gap]. Does this help clarify the concept?`;
  } else if (lastUserMessage.toLowerCase().includes('other options')) {
    const wrongExplanations = question.wrongAnswerExplanations 
      ? Object.entries(question.wrongAnswerExplanations)
          .map(([opt, exp]) => `Option ${opt.toUpperCase()}: ${exp}`)
          .join('\n\n')
      : 'Let me explain why each incorrect option doesn\'t work...';
    content = `Here's why the other options are incorrect:\n\n${wrongExplanations}`;
  } else {
    content = isCorrect
      ? "That's a thoughtful approach! Your reasoning shows good understanding. What aspect would you like to explore further?"
      : "I can see your thought process. Let's work through this together - what part of the question do you think was most challenging?";
  }

  return {
    content,
    explanationProvided: lastUserMessage.toLowerCase().includes('explain'),
    additionalTopics: [question.topic].filter(Boolean),
    knowledgeGaps: isCorrect ? [] : ['conceptual understanding'],
    masteryLevel: isCorrect ? 'good' : 'needs_review'
  };
}

// Temporary placeholder components for chat interface
const ChatScrollArea = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("overflow-auto", className)}>
    {children}
  </div>
);

const ChatTextarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { className?: string }
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  />
));
ChatTextarea.displayName = "ChatTextarea"; 