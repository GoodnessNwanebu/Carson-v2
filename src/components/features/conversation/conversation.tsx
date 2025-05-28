"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { useKnowledgeMap } from "../knowledge-map/knowledge-map-context"
import { useSession } from "./session-context"
import { cn } from "@/lib/utils"
import { Plus, Paperclip, ArrowUp, AlertCircle, RefreshCw } from "lucide-react"
import { useSidebarState } from "../sidebar/sidebar-context"
import { callLLM } from "@/lib/prompts/llm-service"
import { CarsonSessionContext } from "@/lib/prompts/carsonTypes"
import { v4 as uuidv4 } from 'uuid';
import { assessUserResponse, updateSessionAfterAssessment } from "@/lib/prompts/assessmentEngine";
import { CompletionCelebration } from "../knowledge-map/knowledge-map-animations";

// Accept initialTopic and onInitialTopicUsed as props
export function Conversation({ initialTopic, onInitialTopicUsed }: { initialTopic?: string | null, onInitialTopicUsed?: () => void }) {
  console.log("[Conversation] Component rendered");
  const [input, setInput] = useState("")
  const { updateTopicStatus, updateTopicProgress, setTopics, setCurrentTopicName, isLoading, setIsLoading, setCurrentSubtopicIndex } = useKnowledgeMap()
  const { session, startSession, addMessage, updateSession, moveToNextSubtopic, checkSubtopicCompletion, isSessionComplete } = useSession()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const { isMobile } = useSidebarState()
  const [isScrolled, setIsScrolled] = useState(false)
  const [initialTopicSubmitted, setInitialTopicSubmitted] = useState(false);
  const hasSubmittedInitialTopic = useRef(false);
  const [lastCarsonQuestion, setLastCarsonQuestion] = useState<string>("");
  const [showCelebration, setShowCelebration] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Extracted message submission logic
  const submitMessage = async (messageContent: string) => {
    if (!messageContent.trim() || isLoading) return;

    setInput("");
    setIsLoading(true);
    setError(null); // Clear any existing errors

    if (isMobile) {
      inputRef.current?.blur();
    }

    try {
      if (!session) {
        // First message: start session, call LLM for intro/subtopics
        const newSessionId = uuidv4();
        startSession(messageContent, newSessionId);
        setCurrentTopicName(messageContent);

        const userMessage = { id: uuidv4(), role: "user" as const, content: messageContent };
        // Don't add message optimistically here - wait for successful response

        const response = await callLLM({
          sessionId: newSessionId,
          topic: messageContent,
          subtopics: [],
          currentSubtopicIndex: 0,
          history: [userMessage],
          currentQuestionType: 'parent',
          questionsAskedInCurrentSubtopic: 0,
          correctAnswersInCurrentSubtopic: 0,
          currentSubtopicState: 'assessing',
          shouldTransition: false,
        });

        const assistantMessage = { id: uuidv4(), role: "assistant" as const, content: response.content };
        setLastCarsonQuestion(response.content); // Store Carson's question for assessment

        // Update session with complete conversation and subtopics
        const sessionUpdate: Partial<CarsonSessionContext> = {
          history: [userMessage, assistantMessage]
        };

        if (response.subtopics) {
          setTopics(
            response.subtopics.map((sub) => ({
              id: sub.id,
              name: sub.title,
              status: "unassessed",
            }))
          );
          
          sessionUpdate.subtopics = response.subtopics.map((sub) => ({
            id: sub.id,
            title: sub.title,
            status: "unassessed" as const,
            history: [],
            questionsAsked: 0,
            correctAnswers: 0,
            needsExplanation: false,
          }));
        }

        updateSession(sessionUpdate);
      } else {
        // Ongoing conversation - assess user response and update session
        const userMessage = { id: uuidv4(), role: "user" as const, content: messageContent };
        // Don't add message optimistically here - wait for successful response

        // Assess the user's response if we have subtopics and a previous question
        let sessionUpdates: Partial<CarsonSessionContext> = {};
        let assessmentResult = null;
        
        if (session.subtopics.length > 0 && lastCarsonQuestion) {
          assessmentResult = assessUserResponse(messageContent, session);
          sessionUpdates = updateSessionAfterAssessment(session, assessmentResult);
          
          console.log("[Conversation] Assessment result:", assessmentResult);
          
          // Update knowledge map progress and status based on assessment
          const currentSubtopic = session.subtopics[session.currentSubtopicIndex];
          if (currentSubtopic) {
            // Update progress tracking
            updateTopicProgress(currentSubtopic.id, {
              questionsAnswered: (sessionUpdates.questionsAskedInCurrentSubtopic ?? session.questionsAskedInCurrentSubtopic) + 1,
              totalQuestions: 3, // Assuming 3 questions per subtopic
              currentQuestionType: sessionUpdates.currentQuestionType ?? session.currentQuestionType
            });
            
            // Update status based on assessment
            switch (assessmentResult.answerQuality) {
              case 'excellent':
              case 'good':
                updateTopicStatus(currentSubtopic.id, "green");
                // Show celebration for excellent performance
                if (assessmentResult.answerQuality === 'excellent') {
                  setShowCelebration(true);
                }
                break;
              case 'partial':
                updateTopicStatus(currentSubtopic.id, "yellow");
                break;
              case 'incorrect':
              case 'confused':
                updateTopicStatus(currentSubtopic.id, "red");
                break;
            }
          }
        }

        // Build the session for LLM with the new user message and assessment context
        const updatedSession = {
          ...session,
          ...sessionUpdates,
          history: [...session.history, userMessage],
          lastAssessment: assessmentResult ? {
            answerQuality: assessmentResult.answerQuality,
            nextAction: assessmentResult.nextAction,
            reasoning: assessmentResult.reasoning
          } : undefined
        };

        // Only generate subtopics if they haven't been generated yet
        let response;
        if (!session.subtopics || session.subtopics.length === 0) {
          response = await callLLM({
            ...updatedSession,
            subtopics: [],
            currentSubtopicIndex: 0,
          });
          if (response.subtopics) {
            setTopics(
              response.subtopics.map((sub) => ({
                id: sub.id,
                name: sub.title,
                status: "unassessed",
              }))
            );
          }
        } else {
          // Socratic Q&A with assessment-driven responses
          response = await callLLM(updatedSession);
        }

        const assistantMessage = { id: uuidv4(), role: "assistant" as const, content: response.content };
        setLastCarsonQuestion(response.content); // Store Carson's new question/response
        
        // Update the session with the complete conversation including the new assistant message
        updateSession({
          ...sessionUpdates,
          history: [...session.history, userMessage, assistantMessage]
        });
        
        // Check if current subtopic should be completed and trigger transition
        if (session && session.subtopics.length > 0) {
          const currentSubtopicIndex = session.currentSubtopicIndex;
          const shouldComplete = checkSubtopicCompletion(currentSubtopicIndex);
          
          if (shouldComplete) {
            // Mark for transition on next message
            updateSession({ shouldTransition: true });
            
            // Update knowledge map status
            updateTopicStatus(session.subtopics[currentSubtopicIndex].id, "green");
          }
        }
        
        // Handle subtopic transition if marked for transition
        if (session && session.shouldTransition) {
          const moved = moveToNextSubtopic();
          if (moved) {
            // Update knowledge map to show new current subtopic
            setCurrentSubtopicIndex(session.currentSubtopicIndex + 1);
          } else if (isSessionComplete()) {
            // Session is complete - all subtopics finished
            console.log("[Conversation] Session completed! All subtopics mastered.");
          }
        }
      }
    } catch (error) {
      console.error("Error in conversation:", error);
      setError(
        error instanceof Error 
          ? `Failed to send message: ${error.message}` 
          : "Failed to send message. Please check your connection and try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [session?.history])

  // Handle initial topic handoff from home screen
  useEffect(() => {
    console.log("[Conversation] useEffect for initialTopic fired", {
      initialTopic,
      initialTopicSubmitted,
      hasSubmittedInitialTopic: hasSubmittedInitialTopic.current,
      messagesLength: session?.history?.length,
      isLoading,
      session,
    });
    if (
      initialTopic &&
      !hasSubmittedInitialTopic.current &&
      !session && // Only if no session exists yet
      !isLoading
    ) {
      hasSubmittedInitialTopic.current = true;
      setInitialTopicSubmitted(true);
      console.log("[Conversation] Submitting initial topic:", initialTopic);
      submitMessage(initialTopic);
      if (onInitialTopicUsed) onInitialTopicUsed();
    }
    // eslint-disable-next-line
  }, [initialTopic, isLoading, session, initialTopicSubmitted]);

  // Handle scroll detection for sticky header
  useEffect(() => {
    const handleScroll = () => {
      if (scrollContainerRef.current) {
        setIsScrolled(scrollContainerRef.current.scrollTop > 50)
      }
    }

    const container = scrollContainerRef.current
    if (container) {
      container.addEventListener("scroll", handleScroll)
      return () => container.removeEventListener("scroll", handleScroll)
    }
  }, [])

  // Auto-resize textarea based on content
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target
    setInput(textarea.value)

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = "auto"
    // Set the height to scrollHeight to fit the content
    textarea.style.height = `${Math.min(textarea.scrollHeight, isMobile ? 100 : 120)}px`
  }

  // Focus the input field when clicking anywhere in the input container
  const handleContainerClick = () => {
    inputRef.current?.focus()
  }

  // Update handleSubmit to use submitMessage
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitMessage(input);
  };

  useEffect(() => {
    console.log("[Conversation] Messages updated:", session?.history);
  }, [session?.history]);

  // iOS keyboard handling
  useEffect(() => {
    const handleViewportChange = () => {
      // Force scroll to bottom when keyboard appears/disappears on iOS
      if (messagesEndRef.current) {
    setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      }
    };

    // Listen for viewport changes (keyboard show/hide)
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('orientationchange', handleViewportChange);

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('orientationchange', handleViewportChange);
    };
  }, []);

  // Retry function for failed requests
  const retryLastAction = () => {
    setError(null);
    submitMessage(input);
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Completion celebration */}
      <CompletionCelebration 
        isVisible={showCelebration} 
        onComplete={() => setShowCelebration(false)} 
      />
      
      {/* Sticky header for mobile */}
      {isMobile && (
        <div
          className={cn(
            "fixed top-0 left-0 right-0 h-16 bg-white shadow-sm transition-all duration-300 z-10",
            isScrolled ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-full",
          )}
        />
      )}

      {/* Messages container - with scroll detection */}
      <div
        ref={scrollContainerRef}
        className={cn("flex-1 overflow-y-auto pt-16 md:pt-20 pb-4 md:pb-6", isMobile ? "px-[5px]" : "px-4")}
        data-conversation-scroll
      >
        <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
          {(session?.history ?? []).map((message) => (
            <div
              key={message.id}
              className={cn("flex", message.role === "assistant" ? "justify-start" : "justify-end")}
            >
              <div
                className={cn(
                  "px-4 md:px-5 py-2.5 md:py-3 rounded-2xl",
                  message.role === "assistant"
                    ? "bg-gray-100 text-gray-800 max-w-full md:max-w-3xl"
                    : "bg-blue-500 text-white max-w-[80%] sm:max-w-[75%] md:max-w-[65%] lg:max-w-[60%] min-w-0",
                  message.role === "user" && "rounded-br-none",
                  message.role === "assistant" && "rounded-bl-none",
                )}
              >
                <div className="whitespace-pre-line leading-relaxed text-sm md:text-base break-words overflow-wrap-anywhere">
                  {message.content}
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-800 rounded-2xl rounded-bl-none px-4 md:px-5 py-2.5 md:py-3">
                <div className="flex space-x-2 items-center h-6">
                  <div
                    className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  ></div>
                  <div
                    className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  ></div>
                  <div
                    className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  ></div>
                </div>
              </div>
            </div>
          )}
          
          {error && (
            <div className="flex justify-center">
              <div className="bg-red-50 border border-red-200 rounded-2xl px-4 md:px-5 py-3 md:py-4 max-w-md">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-red-800 mb-3">{error}</p>
                    <button
                      onClick={retryLastAction}
                      className="inline-flex items-center gap-2 bg-red-500 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-red-600 transition-colors"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Try Again
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Responsive input form - improved mobile behavior */}
      <div className={cn("border-t border-gray-200 bg-gray-50", isMobile ? "p-3 px-[5px]" : "p-4")}>
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          <div
            className="relative flex items-end bg-white border border-gray-300 rounded-xl md:rounded-2xl shadow-sm hover:border-gray-400 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-200 transition-all duration-200"
            onClick={handleContainerClick}
          >
            {/* Left side icons - responsive */}
            <div className="flex items-center pl-3 md:pl-4 pb-2 md:pb-3">
              <button
                type="button"
                className="p-1.5 md:p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors mr-1"
              >
                <Plus size={isMobile ? 18 : 20} />
              </button>
              <button
                type="button"
                className="p-1.5 md:p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Paperclip size={isMobile ? 18 : 20} />
              </button>
            </div>

            {/* Textarea input - improved mobile behavior */}
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInput}
              placeholder="Reply to Carson..."
              name="carson-message"
              className="flex-1 max-h-[100px] md:max-h-[200px] py-3 md:py-4 px-2 bg-transparent border-0 focus:ring-0 focus:outline-none resize-none text-base placeholder-gray-500"
              style={{ fontSize: "16px" }} // Prevents zoom on iOS Safari
              rows={1}
              disabled={isLoading}
              autoComplete="off"
              autoCorrect="on"
              spellCheck="true"
              enterKeyHint="send"
              inputMode="text"
              autoCapitalize="sentences"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  if (input.trim() && !isLoading) {
                    handleSubmit(e)
                  }
                }
              }}
              onFocus={() => {
                // Scroll to bottom when keyboard appears on iOS
                if (isMobile) {
                  setTimeout(() => {
                    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
                  }, 300);
                }
              }}
            />

            {/* Right side - send button - responsive */}
            <div className="flex items-center pr-2 md:pr-3 pb-2 md:pb-3">
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className={cn(
                  "p-1.5 md:p-2 rounded-lg transition-all duration-200",
                  input.trim() && !isLoading
                    ? "bg-blue-500 text-white hover:bg-blue-600"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed",
                )}
              >
                {isLoading ? (
                  <div className="h-4 w-4 md:h-5 md:w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <ArrowUp size={isMobile ? 18 : 20} />
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
