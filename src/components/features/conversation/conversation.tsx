"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { useKnowledgeMap } from "../knowledge-map/knowledge-map-context"
import { useSession } from "./session-context"
import { cn } from "@/lib/utils"
import { Plus, Paperclip, ArrowUp, AlertCircle, RefreshCw, Camera, FileText, Image, Menu, Route, Mic, MicOff, Copy, Edit3, X } from "lucide-react"
import { useSidebarState } from "../sidebar/sidebar-context"
import { callLLM } from "@/lib/prompts/llm-service"
import { CarsonSessionContext } from "@/lib/prompts/carsonTypes"
import { v4 as uuidv4 } from 'uuid';
import { assessUserResponseV3, AssessmentResult, updateSessionAfterAssessment, NextAction, AssessmentPhase } from "@/lib/prompts/assessmentEngine";
import { generateSubtopicRequirements, SubtopicRequirements } from "@/lib/prompts/triagingOrchestrator";
import { detectConversationalIntent } from "@/lib/prompts/conversational-intelligence";
import { CompletionCelebration } from "../knowledge-map/knowledge-map-animations";
import { Button } from "@/components/ui/button"
import { useNotifications } from "@/hooks/use-notifications"

// Create a context for scroll state sharing
import { createContext, useContext } from "react"

interface ScrollContextType {
  isScrolled: boolean;
  showStickyHeader: boolean;
}

const ScrollContext = createContext<ScrollContextType>({ 
  isScrolled: false, 
  showStickyHeader: false 
});

export const useScrollContext = () => useContext(ScrollContext);

// Simple markdown processor for Carson's responses
const processMarkdown = (text: string): React.ReactNode[] => {
  return text.split('\n').map((line, index) => {
    let processedLine = line;
    
    // Process headers
    if (line.startsWith('### ')) {
      processedLine = line.replace(/### (.*)/, '<strong>$1</strong>');
    } else if (line.startsWith('## ')) {
      processedLine = line.replace(/## (.*)/, '<strong>$1</strong>');
    } else if (line.startsWith('# ')) {
      processedLine = line.replace(/# (.*)/, '<strong>$1</strong>');
    }
    
    // Process emphasis
    processedLine = processedLine.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    processedLine = processedLine.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    return (
      <span key={index}>
        {processedLine.includes('<') ? (
          <span dangerouslySetInnerHTML={{ __html: processedLine }} />
        ) : (
          processedLine
        )}
        {index < text.split('\n').length - 1 && <br />}
      </span>
    );
  });
};

// Simple topic extraction as fallback
const extractTopicFromInput = (input: string): string => {
  // Common patterns for topic extraction
  const patterns = [
    /(?:test|learn|understand|know|study)\s+(?:about|on|more about)\s+(.+?)(?:\?|$|\.)/i,
    /(?:what is|explain|tell me about)\s+(.+?)(?:\?|$|\.)/i,
    /(?:help me with|teach me)\s+(.+?)(?:\?|$|\.)/i,
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  // If no pattern matches, return the original input
  return input;
};

/**
 * PRIORITY 1 FIX: Calculate sophisticated subtopic status based on assessment phase and progress
 * Uses actual assessment engine logic instead of oversimplified answer quality mapping
 */
const calculateSubtopicStatus = (
  assessmentResult: AssessmentResult, 
  requirements: SubtopicRequirements, 
  sessionUpdates: any
): "red" | "yellow" | "green" | "unassessed" => {
  const { currentPhase, nextAction, answerQuality } = assessmentResult;
  const questionsUsed = sessionUpdates.questionsAskedInCurrentSubtopic || 0;
  
  // If we're completing the subtopic, it's mastered
  if (nextAction === 'complete_subtopic') {
    return "green";
  }
  
  // If we're still in initial assessment phase with good answers, it's progressing well
  if (currentPhase === 'initial_assessment' && ['excellent', 'good'].includes(answerQuality)) {
    return "yellow"; // Making progress
  }
  
  // If we're in targeted remediation but making progress
  if (currentPhase === 'targeted_remediation' && ['excellent', 'good'].includes(answerQuality)) {
    return "yellow"; // Addressing gaps
  }
  
  // If we're struggling or have used many questions without progress
  if (answerQuality === 'confused' || 
      (questionsUsed >= requirements.maxQuestions - 1 && currentPhase !== 'complete')) {
    return "red"; // Needs help
  }
  
  // Default to yellow for active assessment
  return "yellow";
};

// Accept initialTopic and onInitialTopicUsed as props
export function Conversation({ 
  initialTopic, 
  onInitialTopicUsed,
  isRecording,
  mediaRecorder,
  audioChunks,
  isTranscribing,
  toggleVoiceRecording,
  inputRef,
  onVoiceTranscript
}: { 
  initialTopic?: string | null, 
  onInitialTopicUsed?: () => void,
  isRecording?: boolean,
  mediaRecorder?: MediaRecorder | null,
  audioChunks?: Blob[],
  isTranscribing?: boolean,
  toggleVoiceRecording?: () => void,
  inputRef?: React.RefObject<HTMLTextAreaElement | null>,
  onVoiceTranscript?: React.MutableRefObject<((transcript: string) => void) | null>
}) {
  console.log("[Conversation] Component rendered");
  const { session, addMessage, updateSession, clearSession, startSession, moveToNextSubtopic, checkSubtopicCompletion, isSessionComplete, completeSessionAndGenerateNotes } = useSession()
  const { setSidebarOpen } = useSidebarState()
  const { success: showSuccessNotification, error: showErrorNotification } = useNotifications()
  
  const [input, setInput] = useState("")
  const { updateTopicStatus, updateTopicProgress, setTopics, setCurrentTopicName, setIsLoading: setKnowledgeMapLoading, setCurrentSubtopicIndex, topics, currentTopicName } = useKnowledgeMap()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const { isMapOpen, toggleMap } = useKnowledgeMap()
  const [isScrolled, setIsScrolled] = useState(false)
  const [initialTopicSubmitted, setInitialTopicSubmitted] = useState(false);
  const hasSubmittedInitialTopic = useRef(false);
  const [lastCarsonQuestion, setLastCarsonQuestion] = useState<string>("");
  const [showCelebration, setShowCelebration] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConversationLoading, setIsConversationLoading] = useState(false); // Separate loading state for conversation
  const [showStickyHeader, setShowStickyHeader] = useState(false); // Explicit control for sticky header
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [longPressedMessageId, setLongPressedMessageId] = useState<string | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Attachment modal state
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);

  // Auto-resize textarea with universal best practices
  const resizeTextarea = (textarea: HTMLTextAreaElement) => {
    // Reset height to auto to get accurate scrollHeight measurement
    textarea.style.height = "auto"
    
    // Calculate content height
    const scrollHeight = textarea.scrollHeight
    
    // Set responsive max heights based on device
    const isMobile = window.innerWidth < 768
    const maxHeight = isMobile ? 80 : 120 // 3-4 lines mobile, 4-5 lines desktop
    const minHeight = 48 // Single line minimum
    
    // Calculate final height within bounds
    const finalHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight)
    
    // Apply height with smooth transition
    textarea.style.height = `${finalHeight}px`
    
    // Enable internal scrolling only when at max height
    textarea.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden'
  };

  // Extracted message submission logic
  const submitMessage = async (messageContent: string) => {
    if (!messageContent.trim() || isConversationLoading) return;

    setInput("");
    setIsConversationLoading(true);
    setError(null); // Clear any existing errors

    try {
      // **SIMPLIFIED**: Just check if session exists or not
      if (!session) {
        console.log('🚀 [Conversation] Starting new session - no existing session')
        // First message: start session, call LLM for intro/subtopics
        const newSessionId = uuidv4();
        await startSession(messageContent, newSessionId, false); // false = don't try to load from DB
        setCurrentTopicName(messageContent);
        
        // Show knowledge map loading only for initial subtopic generation
        setKnowledgeMapLoading(true);

        const userMessage = { id: uuidv4(), role: "user" as const, content: messageContent };
        // Add user message immediately to show in conversation
        addMessage(userMessage);

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
          isComplete: false
        });

        console.log("[Conversation] LLM Response:", response);
        console.log("[Conversation] Has subtopics?", !!response.subtopics);
        console.log("[Conversation] Subtopics count:", response.subtopics?.length || 0);

        // Use clean topic name from LLM response, fallback to regex extraction, or use original input
        const finalTopicName = response.cleanTopic || extractTopicFromInput(messageContent) || messageContent;
        setCurrentTopicName(finalTopicName);

        const assistantMessage = { id: uuidv4(), role: "assistant" as const, content: response.content };
        setLastCarsonQuestion(response.content); // Store Carson's question for assessment

        // Update session with complete conversation and subtopics
        const sessionUpdate: Partial<CarsonSessionContext> = {
          history: [userMessage, assistantMessage]
        };

        if (response.subtopics) {
          console.log("[Conversation] Setting topics in knowledge map:", response.subtopics);
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
        } else {
          console.log("[Conversation] No subtopics in response - this is the problem!");
        }

        updateSession(sessionUpdate);
        
        // Stop knowledge map loading after subtopics are generated
        setKnowledgeMapLoading(false);
      } else if (session) {
        console.log('💬 [Conversation] Continuing existing session:', {
          sessionId: session.sessionId,
          historyLength: session.history?.length || 0,
          hasSubtopics: !!session.subtopics?.length,
          currentState: session.currentSubtopicState
        })
        // Ongoing conversation - assess user response and update session
        const userMessage = { id: uuidv4(), role: "user" as const, content: messageContent };
        
        // Add user message immediately to show in conversation
        addMessage(userMessage);

        // **NEW**: Handle completion choice responses
        if (session.currentSubtopicState === 'completion_choice') {
          const lowerMessage = messageContent.toLowerCase();
          
          // Check if student wants notes
          if (lowerMessage.includes('note') || lowerMessage.includes('journal') || lowerMessage.includes('save') || 
              lowerMessage.includes('yes') || lowerMessage.includes('sure')) {
            // 1. Immediately send an encouraging message about note saving
            const savingNoteMessage = {
              id: uuidv4(),
              role: "assistant" as const,
              content: `Great! You'll have a note of this session saved to your journals shortly. Congrats again on reviewing ${currentTopicName} successfully. I wish you the best!`
            };
            addMessage(savingNoteMessage);

            // 2. Generate study notes after Carson responds
            setTimeout(async () => {
              try {
                console.log('📝 [Conversation] Generating study notes after user choice...');
                const notes = await completeSessionAndGenerateNotes();
                if (notes) {
                  console.log('✅ [Conversation] Study notes generated and saved!');
                  setError(null); // Clear any existing errors
                  const notesSuccessMessage = { 
                    id: uuidv4(), 
                    role: "assistant" as const, 
                    content: "✅ Perfect! Your study notes have been saved to your journal. You can find them in the Journal tab where you can edit, search, and export them. Happy to make that note for you. You've done really well today, until next time." 
                  };
                  addMessage(notesSuccessMessage);
                  updateSession({ 
                    isComplete: true,
                    currentSubtopicState: 'complete'
                  });
                } else {
                  console.error('❌ [Conversation] Failed to generate study notes');
                  setError("Sorry, there was an issue generating your study notes. Please try again.");
                }
              } catch (error) {
                console.error('❌ [Conversation] Failed to generate study notes:', error);
                setError("Sorry, there was an issue generating your study notes. Please try again.");
              }
            }, 2000); // Wait 2 seconds for Carson's response to show first
          } else if (
            lowerMessage.includes('new topic') ||
            lowerMessage.includes('another topic') ||
            lowerMessage.includes('start over') ||
            lowerMessage.includes('fresh') ||
            lowerMessage.includes('new conversation')
          ) {
            // Explicit, friendly response for starting a new topic
            const newTopicMessage = {
              id: uuidv4(),
              role: "assistant" as const,
              content: `Cool, start a new topic by clicking the 'New conversation' button in the sidebar. Looking forward to learning something new with you!`
            };
            addMessage(newTopicMessage);
            // Optionally, update session state if needed (not marking complete here)
          }
          
          // Continue with normal LLM call to let Carson respond appropriately
        }

        // Assess the user's response if we have subtopics and a previous question
        let sessionUpdates: Partial<CarsonSessionContext> = {};
        let assessmentResult = null;
        
        if (session.subtopics.length > 0 && lastCarsonQuestion && session.currentSubtopicState !== 'completion_choice') {
          // **NEW**: First check if this is a conversational question
          const conversationalIntent = detectConversationalIntent(messageContent, session);
          
          console.log("[Conversation] Conversational intent detected:", {
            type: conversationalIntent.type,
            confidence: conversationalIntent.confidence,
            shouldReturnToFlow: conversationalIntent.shouldReturnToFlow
          });
          
          // If it's a conversational question (not an assessment response), skip assessment
          if (conversationalIntent.type !== 'assessment_response' && conversationalIntent.confidence > 0.8) {
            console.log("[Conversation] Handling as conversational question - skipping assessment");
            // The LLM will handle this conversationally via the prompt engine
            // No assessment needed, just continue to LLM call
          } else {
            // Normal assessment flow for medical responses
            assessmentResult = await assessUserResponseV3(messageContent, session);
            
            // Only update session if we got an actual assessment (not null for conversational responses)
            if (assessmentResult) {
              sessionUpdates = updateSessionAfterAssessment(session, assessmentResult);
              
              console.log("[Conversation] Assessment result:", assessmentResult);
              
              // Update knowledge map progress and status based on assessment
              const currentSubtopic = session.subtopics[session.currentSubtopicIndex];
              if (currentSubtopic) {
                // Update progress tracking using actual assessment engine requirements
                const requirements = generateSubtopicRequirements(currentSubtopic.title, session.topic || "Medical Topic");
                const triagingStatus = currentSubtopic.triagingStatus;
                
                // **CRITICAL FIX**: Apply statusUpdate from assessment engine to subtopic
                // Initialize triaging status if it doesn't exist
                const currentTriagingStatus = triagingStatus || {
                  hasInitialAssessment: false,
                  addressedGaps: [],
                  acknowledgedGaps: [],
                  questionsUsed: 0,
                  hasTestedApplication: false
                };
                
                let updatedTriagingStatus = currentTriagingStatus;
                if (assessmentResult.statusUpdate) {
                  // Update the subtopic's triagingStatus with the assessment engine's updates
                  updatedTriagingStatus = {
                    ...currentTriagingStatus,
                    ...assessmentResult.statusUpdate
                  };
                  
                  // Update the subtopic in the session with the new triaging status
                  const updatedSubtopics = [...session.subtopics];
                  updatedSubtopics[session.currentSubtopicIndex] = {
                    ...currentSubtopic,
                    triagingStatus: updatedTriagingStatus
                  };
                  
                  // Add this to session updates so it gets persisted
                  sessionUpdates.subtopics = updatedSubtopics;
                }
                
                updateTopicProgress(currentSubtopic.id, {
                  questionsAnswered: (sessionUpdates.questionsAskedInCurrentSubtopic ?? session.questionsAskedInCurrentSubtopic) + 1,
                  totalQuestions: requirements.maxQuestions, // Use actual max questions from assessment engine
                  currentQuestionType: sessionUpdates.currentQuestionType ?? session.currentQuestionType,
                  // Progress dots information - confidence building phases - USE UPDATED STATUS
                  questionsUsed: updatedTriagingStatus.questionsUsed,
                  currentPhase: assessmentResult.currentPhase
                });
                
                // Update status based on sophisticated assessment phase and progress
                const newStatus = calculateSubtopicStatus(assessmentResult, requirements, sessionUpdates);
                updateTopicStatus(currentSubtopic.id, newStatus);
              }
            } else {
              console.log("[Conversation] No assessment - conversational response detected");
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
            reasoning: assessmentResult.reasoning,
            isStruggling: assessmentResult.isStruggling
          } : undefined
        };

        // **CRITICAL FIX**: Ensure all required fields are present for callLLM
        const safeSessionForLLM = {
          sessionId: updatedSession.sessionId || session.sessionId || 'unknown',
          topic: updatedSession.topic || session.topic || 'undefined',
          subtopics: updatedSession.subtopics || session.subtopics || [],
          currentSubtopicIndex: typeof updatedSession.currentSubtopicIndex === 'number' ? updatedSession.currentSubtopicIndex : (session.currentSubtopicIndex || 0),
          history: updatedSession.history || [],
          currentSubtopicState: updatedSession.currentSubtopicState || session.currentSubtopicState || 'assessing',
          currentQuestionType: (updatedSession.currentQuestionType || session.currentQuestionType || 'parent') as 'parent' | 'child' | 'checkin',
          questionsAskedInCurrentSubtopic: typeof updatedSession.questionsAskedInCurrentSubtopic === 'number' ? updatedSession.questionsAskedInCurrentSubtopic : (session.questionsAskedInCurrentSubtopic || 0),
          correctAnswersInCurrentSubtopic: typeof updatedSession.correctAnswersInCurrentSubtopic === 'number' ? updatedSession.correctAnswersInCurrentSubtopic : (session.correctAnswersInCurrentSubtopic || 0),
          shouldTransition: Boolean(updatedSession.shouldTransition),
          isComplete: Boolean(updatedSession.isComplete),
          lastAssessment: updatedSession.lastAssessment
        };

        // **ADDITIONAL VALIDATION**: Don't call LLM if session data is invalid
        if (safeSessionForLLM.sessionId === 'unknown' || safeSessionForLLM.topic === 'undefined') {
          console.error("[Conversation] Invalid session data detected:", {
            sessionId: safeSessionForLLM.sessionId,
            topic: safeSessionForLLM.topic,
            hasSession: !!session
          });
          throw new Error("Session not properly initialized. Please refresh and try again.");
        }

        // Only generate subtopics if they haven't been generated yet
        let response;
        if (!session.subtopics || session.subtopics.length === 0) {
          // Show knowledge map loading only if we're actually generating subtopics
          setKnowledgeMapLoading(true);
          
          response = await callLLM({
            ...safeSessionForLLM,
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
          
          // Stop knowledge map loading after subtopics are generated
          setKnowledgeMapLoading(false);
        } else {
          // Socratic Q&A with assessment-driven responses - no knowledge map loading needed
          response = await callLLM(safeSessionForLLM);
        }

        const assistantMessage = { id: uuidv4(), role: "assistant" as const, content: response.content };
        setLastCarsonQuestion(response.content); // Store Carson's new question/response
        
        // **ATOMIC SESSION UPDATE**: Combine all updates into single call to prevent racing
        const finalSessionUpdates = {
          ...sessionUpdates,
                      history: [...session.history, userMessage, assistantMessage]
        };
        
        // Check if current subtopic should be completed and add transition flag
        if (session && session.subtopics.length > 0) {
          const currentSubtopicIndex = session.currentSubtopicIndex;
          const shouldComplete = checkSubtopicCompletion(currentSubtopicIndex);
          
          if (shouldComplete) {
            finalSessionUpdates.shouldTransition = true;
            // Update knowledge map status
            updateTopicStatus(session.subtopics[currentSubtopicIndex].id, "green");
          }
        }
        
        // **SINGLE ATOMIC UPDATE** to prevent race conditions
        updateSession(finalSessionUpdates);
        
        // Trigger celebration after successful API call
        if (assessmentResult && assessmentResult.answerQuality === 'excellent') {
          setTimeout(() => setShowCelebration(true), 100);
        }
        
        // Handle subtopic transition if marked (use the value we just set)
        if (finalSessionUpdates.shouldTransition) {
          const moved = moveToNextSubtopic();
          if (moved) {
            // Update knowledge map to show new current subtopic  
            setCurrentSubtopicIndex(session.currentSubtopicIndex + 1);
          } else if (isSessionComplete()) {
            console.log("[Conversation] Session completed! All subtopics mastered.");
            // **NEW**: Set session to completion state - Carson will offer options
            updateSession({ 
              isComplete: true,
              currentSubtopicState: 'completion_choice' // New state for handling completion options
            });
          }
        }
      } else {
        // Edge case: no session and not loading - shouldn't happen, but handle gracefully
        console.warn('⚠️ [Conversation] No session available and not loading - this should not happen')
        setError('No active conversation. Please refresh the page and try again.')
        setIsConversationLoading(false);
        return;
      }
    } catch (error) {
      console.error("Error in conversation:", error);
      setError(
        error instanceof Error 
          ? `Failed to send message: ${error.message}` 
          : "Failed to send message. Please check your connection and try again."
      );
    } finally {
      setIsConversationLoading(false);
    }
  };

  // Sync knowledge map with session subtopics - only on initial load
  useEffect(() => {
    if (session?.subtopics && session.subtopics.length > 0 && topics.length === 0) {
      // Only sync if knowledge map is empty (initial load)
      console.log('🗺️ [Conversation] Syncing knowledge map with existing session:', {
        sessionId: session.sessionId,
        subtopicsCount: session.subtopics.length,
        currentIndex: session.currentSubtopicIndex
      })
      setTopics(
        session.subtopics.map((sub) => ({
          id: sub.id,
          name: sub.title,
          status: sub.status === "gap" ? "red" : 
                  sub.status === "shaky" ? "yellow" : 
                  sub.status === "understood" ? "green" : "unassessed",
        }))
      );
      setCurrentSubtopicIndex(session.currentSubtopicIndex);
    } else if (session) {
      console.log('📊 [Conversation] Session state check:', {
        hasSession: !!session,
        hasSubtopics: !!session.subtopics,
        subtopicsLength: session.subtopics?.length || 0,
        topicsLength: topics.length,
        sessionId: session.sessionId
      })
    }
  }, [session?.subtopics, topics.length, setTopics, setCurrentSubtopicIndex]);

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
      isConversationLoading,
      session,
    });
    if (
      initialTopic &&
      !hasSubmittedInitialTopic.current &&
      !session && // Only if no session exists yet
      !isConversationLoading
    ) {
      hasSubmittedInitialTopic.current = true;
      setInitialTopicSubmitted(true);
      console.log("[Conversation] Submitting initial topic:", initialTopic);
      submitMessage(initialTopic);
      // Clear initial topic after transition completes
      if (onInitialTopicUsed) {
        setTimeout(() => onInitialTopicUsed(), 150); // 350ms + 150ms = 500ms (after transition ends)
      }
    }
    // eslint-disable-next-line
  }, [initialTopic, isConversationLoading, session, initialTopicSubmitted]);

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
    resizeTextarea(textarea);
  }

  // Handle voice recording completion - append transcript to input
  useEffect(() => {
    // This effect would be triggered when voice recording completes
    // We'll need to modify the voice recording logic to work with conversation input
    // For now, this is a placeholder for future voice integration
  }, [isRecording, isTranscribing])

  // Focus the input field when clicking anywhere in the input container
  const handleContainerClick = () => {
    if (inputRef?.current) {
      inputRef.current.focus()
    }
  }

  // Update handleSubmit to use submitMessage
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingMessageId && session) {
      // Handle editing: truncate conversation and resubmit
      const messageIndex = session.history.findIndex(msg => msg.id === editingMessageId)
      if (messageIndex !== -1) {
        // Remove all messages after the edited message
        const newHistory = session.history.slice(0, messageIndex)
        updateSession({ history: newHistory })
        
        // Clear editing state
        setEditingMessageId(null)
      }
    }
    
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

  // Handle attachment option selection
  const handleAttachmentOption = (option: 'file' | 'camera' | 'photos') => {
    setShowAttachmentModal(false);
    // TODO: Implement attachment handling
    console.log(`Selected attachment option: ${option}`);
  };

  // Create a conversation-specific voice recording function
  const handleVoiceRecording = () => {
    // Note: The actual voice recording will still be handled by the parent component
    // This just triggers it and the result will come back via props or context
    if (toggleVoiceRecording) {
      toggleVoiceRecording()
    }
  }

  // Simple function to update conversation input from voice
  const handleVoiceInput = (transcript: string) => {
    console.log(`[Conversation] Received voice input: "${transcript}"`);
    console.log(`[Conversation] Current input before: "${input}"`);
    
    setInput(prevInput => {
      const newInput = prevInput + (prevInput ? ' ' : '') + transcript;
      console.log(`[Conversation] Setting new input: "${newInput}"`);
      return newInput;
    });
    
    // Auto-resize textarea after adding voice input with slight delay for DOM update
    if (inputRef?.current) {
      setTimeout(() => {
        if (inputRef?.current) {
          resizeTextarea(inputRef.current);
        }
      }, 10);
    }
  }

  // Pass our input handler up to parent on mount
  useEffect(() => {
    if (onVoiceTranscript) {
      onVoiceTranscript.current = handleVoiceInput;
    }
    return () => {
      if (onVoiceTranscript) {
        onVoiceTranscript.current = null;
      }
    }
  }, [onVoiceTranscript])

  // Control sticky header visibility based on session state
  useEffect(() => {
    const shouldShow = !!(session && session.history && session.history.length > 1); // At least 2 messages (user + assistant)
    setShowStickyHeader(shouldShow);
  }, [session?.history?.length]);

  // Clear sticky header immediately when component unmounts or session clears
  useEffect(() => {
    return () => {
      setShowStickyHeader(false);
    };
  }, []);

  // Add this above the return statement of the Conversation component
  const handleRetryNoteGeneration = async () => {
    try {
      setError(null);
      const result = await completeSessionAndGenerateNotes();
      if (result && result.success) {
        const notesSuccessMessage = {
          id: uuidv4(),
          role: "assistant" as const,
          content: "✅ Perfect! Your study notes have been saved to your journal. You can find them in the Journal tab where you can edit, search, and export them. Happy to make that note for you. You've done really well today, until next time."
        };
        addMessage(notesSuccessMessage);
        updateSession({ 
          isComplete: true,
          currentSubtopicState: 'complete'
        });
      } else {
        setError("Sorry, there was still an issue generating your study notes. Please try again later.");
      }
    } catch (error) {
      console.error('❌ [Conversation] Retry note generation failed:', error);
      setError("Sorry, there was still an issue generating your study notes. Please try again later.");
    }
  };

  // Copy message content to clipboard
  const handleCopyMessage = async (content: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(content)
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea')
        textArea.value = content
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
      }
      showSuccessNotification('Copied to clipboard!')
    } catch (error) {
      console.error('Copy failed:', error)
      showErrorNotification('Copy failed. Please try again.')
    }
  }



  // Calculate text similarity to determine if change is significant (15% threshold)
  const calculateTextSimilarity = (original: string, edited: string): number => {
    if (original === edited) return 1
    if (!original || !edited) return 0
    
    // Simple word-based comparison
    const originalWords = original.toLowerCase().trim().split(/\s+/)
    const editedWords = edited.toLowerCase().trim().split(/\s+/)
    
    const maxLength = Math.max(originalWords.length, editedWords.length)
    if (maxLength === 0) return 1
    
    // Count matching words (simple approach)
    let matches = 0
    const minLength = Math.min(originalWords.length, editedWords.length)
    
    for (let i = 0; i < minLength; i++) {
      if (originalWords[i] === editedWords[i]) {
        matches++
      }
    }
    
    return matches / maxLength
  }

  // Simple edit - just put text back in input area
  const handleStartEdit = (messageId: string, content: string) => {
    // Set the message content in the input field
    setInput(content)
    
    // Store which message we're editing
    setEditingMessageId(messageId)
    
    // Focus the input
    setTimeout(() => {
      inputRef?.current?.focus()
    }, 100)
  }

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingMessageId(null)
    setInput("")
  }

  // Check if message is the special completion message
  const isCompletionMessage = (message: any): boolean => {
    if (message.role !== 'assistant') return false
    const content = typeof message.content === 'string' ? message.content : ''
    
    // Check for completion message patterns
    return content.includes('Create study notes') || 
           content.includes('Start new topic') ||
           content.includes('Perfect! Your study notes have been saved') ||
           content.includes("You've done really well today")
  }

  // Long press handlers for mobile
  const handleLongPressStart = (messageId: string, e: React.TouchEvent) => {
    // Only handle single touch
    if (e.touches.length !== 1) {
      return;
    }
    
    // Clear any existing timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
    
    // Start long press timer (500ms)
    longPressTimerRef.current = setTimeout(() => {
      setLongPressedMessageId(messageId);
      // Add haptic feedback if available (requires user gesture)
      try {
        if ('vibrate' in navigator && navigator.vibrate) {
          navigator.vibrate(50);
        }
      } catch (error) {
        // Silently ignore vibration errors
      }
    }, 500);
  };

  const handleLongPressEnd = () => {
    // Clear the timer if touch ends before long press completes
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleLongPressCancel = () => {
    // Clear timer and reset state if touch is cancelled
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // Hover delay handlers for desktop
  const handleHoverStart = (messageId: string) => {
    // Clear any existing hover timer
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }
    
    // Start hover delay timer (600ms)
    hoverTimerRef.current = setTimeout(() => {
      setHoveredMessageId(messageId);
    }, 600);
  };

  const handleHoverEnd = () => {
    // Clear the timer and immediately hide buttons
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setHoveredMessageId(null);
  };

  // Listen for Escape key to cancel editing
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && editingMessageId) {
        handleCancelEdit()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [editingMessageId])

  // Handle document clicks to hide long press buttons
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent | TouchEvent) => {
      // Check if click/touch is outside message bubbles and action buttons
      const target = e.target as Element;
      if (!target.closest('[data-message-bubble]') && !target.closest('button[title*="message"]')) {
        setLongPressedMessageId(null);
      }
    };

    // Only use click for desktop, touchend for mobile to avoid conflicts
    document.addEventListener('click', handleDocumentClick);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, []);

  // Cleanup long press timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }
    };
  }, []);

  return (
    <ScrollContext.Provider value={{ isScrolled, showStickyHeader }}>
      <div className="flex flex-col h-full bg-white dark:bg-gray-900" style={{ minHeight: 0 }}>
        {/* Completion celebration */}
        <CompletionCelebration 
          isVisible={showCelebration} 
          onComplete={() => setShowCelebration(false)} 
        />
      
      {/* Persistent sticky header - ChatGPT/Claude style */}
      {showStickyHeader && (
        <div
          className={cn(
            "fixed top-0 h-16 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-b border-gray-200/50 dark:border-gray-700/50 transition-all duration-300 z-[70] flex items-center justify-between px-4 md:px-6",
            // Responsive positioning - respect sidebar layout
            "left-0 right-0", // Mobile: full width
            isScrolled ? "opacity-100 translate-y-0 shadow-sm" : "opacity-0 -translate-y-full"
          )}
        >
          {/* Left - Hamburger menu (mobile only) */}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 shrink-0 rounded-lg md:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </Button>

          {/* Center - Carson branding */}
          <div className="flex items-center gap-2 flex-1 justify-center min-w-0">
            <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center shrink-0">
              <div className="w-2.5 h-2.5 bg-white rounded-full"></div>
            </div>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              Carson
            </span>
          </div>

          {/* Right - Empty space for visual balance */}
          <div className="h-9 w-9 md:hidden"></div>
        </div>
      )}

      {/* Messages container - with scroll detection */}
      <div
        ref={scrollContainerRef}
        className={cn(
          "flex-1 overflow-y-scroll pb-4 md:pb-6 bg-gray-50 dark:bg-gray-900 px-1 md:px-4",
          showStickyHeader && isScrolled ? "pt-[80px]" : "pt-16" // More top padding to account for knowledge map toggle
        )}
        data-conversation-scroll
        style={{ 
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
          touchAction: 'pan-y',
          minHeight: 0
        }}
      >
        <div className="max-w-4xl mx-auto space-y-1 md:space-y-2">
          {(session?.history ?? []).map((message) => (
            <div
              key={message.id}
              className={cn("group", message.role === "assistant" ? "flex justify-start" : "flex justify-end")}
              onMouseEnter={() => handleHoverStart(message.id)}
              onMouseLeave={handleHoverEnd}
            >
              <div className={cn("flex flex-col", message.role === "assistant" ? "items-start" : "items-end")}>
                {/* Message Bubble */}
                <div
                  data-message-bubble
                  className={cn(
                    "px-4 md:px-6 py-3 md:py-4 break-words relative select-none md:select-text",
                    message.role === "assistant"
                      ? "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 max-w-full md:max-w-3xl border border-gray-200 dark:border-gray-700 rounded-xl sm:rounded-2xl rounded-bl-md shadow-sm"
                      : "bg-blue-600 dark:bg-blue-600 text-white max-w-full md:max-w-3xl rounded-2xl rounded-br-md shadow-sm"
                  )}
                  onTouchStart={(e) => {
                    // Only handle if it's a single touch and not a scroll gesture
                    if (e.touches.length === 1) {
                      handleLongPressStart(message.id, e);
                    }
                  }}
                  onTouchEnd={(e) => {
                    handleLongPressEnd();
                  }}
                  onTouchCancel={(e) => {
                    handleLongPressCancel();
                  }}
                  onTouchMove={(e) => {
                    // Cancel long press immediately if user moves finger (scrolling)
                    if (longPressTimerRef.current) {
                      clearTimeout(longPressTimerRef.current);
                      longPressTimerRef.current = null;
                    }
                  }}
                  style={{ 
                    touchAction: 'pan-y',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    WebkitTouchCallout: 'none',
                    WebkitTapHighlightColor: 'transparent'
                  }}
                  onContextMenu={(e) => {
                    // Prevent default context menu on long press
                    e.preventDefault();
                  }}
                >
                  <div className="text-sm md:text-base leading-relaxed whitespace-pre-line overflow-wrap-anywhere">
                    {typeof message.content === 'string' ? 
                      processMarkdown(message.content)
                      : JSON.stringify(message.content)
                    }
                  </div>


                </div>

                {/* Under-Bubble Action Buttons */}
                {!isCompletionMessage(message) && editingMessageId !== message.id && (
                  <div
                    className={cn(
                      "flex items-center gap-2 transition-all duration-200",
                      // Dynamic margin - more space when visible, minimal when hidden
                      longPressedMessageId === message.id || hoveredMessageId === message.id 
                        ? "mt-2 mb-1" 
                        : "mt-0.5 mb-0",
                      // Desktop: hover to show (with delay), Mobile: long press to show
                      "md:opacity-0 md:group-hover:opacity-100",
                      // Mobile visibility logic
                      longPressedMessageId === message.id ? "opacity-100" : "opacity-0 md:opacity-0",
                      // Desktop hover override
                      hoveredMessageId === message.id ? "md:opacity-100" : ""
                    )}
                  >
                    {/* Copy button - show for all messages except completion messages */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyMessage(typeof message.content === 'string' ? message.content : JSON.stringify(message.content));
                      }}
                      className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors touch-manipulation"
                      title="Copy message"
                    >
                      <Copy size={16} />
                    </button>

                    {/* Edit button - show only for user messages */}
                    {message.role === "user" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEdit(message.id, typeof message.content === 'string' ? message.content : JSON.stringify(message.content));
                        }}
                        className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors touch-manipulation"
                        title="Edit message"
                      >
                        <Edit3 size={16} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {isConversationLoading && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-xl sm:rounded-2xl rounded-bl-md px-4 md:px-6 py-3 md:py-4 shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex space-x-2 items-center h-6">

                  <div
                    className="w-2 h-2 rounded-full bg-blue-400 dark:bg-blue-500 animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  ></div>
                  <div
                    className="w-2 h-2 rounded-full bg-blue-400 dark:bg-blue-500 animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  ></div>
                  <div
                    className="w-2 h-2 rounded-full bg-blue-400 dark:bg-blue-500 animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  ></div>
                </div>
              </div>
            </div>
          )}
          
          {/* Only show the generic error block if it's not a study notes error */}
          {error && !error.includes('study notes') && (
            <div className="flex justify-center">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl sm:rounded-2xl px-4 md:px-6 py-4 md:py-5 max-w-md shadow-sm">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-red-800 dark:text-red-200 mb-3">{error}</p>
                    <button
                      onClick={retryLastAction}
                      className="inline-flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-600 transition-colors shadow-sm"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Try Again
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* Show retry button for study notes error only */}
          {error && error.includes('study notes') && (
            <div className="flex items-center gap-2 my-2">
              <AlertCircle className="text-red-500" size={20} />
              <span className="text-red-600">{error}</span>
              <Button size="sm" variant="outline" onClick={handleRetryNoteGeneration} className="ml-2 flex items-center gap-1">
                <RefreshCw size={16} className="mr-1" /> Retry saving note
              </Button>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Responsive input form - improved mobile behavior */}
      <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4 md:p-6">


        {/* Editing indicator */}
        {editingMessageId && (
          <div className="max-w-4xl mx-auto mb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Edit3 size={16} />
                <span>Editing message</span>
              </div>
              <button 
                onClick={handleCancelEdit}
                className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                title="Cancel editing"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Input form */}
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          <div
            className="relative flex items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl md:rounded-2xl shadow-sm hover:border-gray-300 dark:hover:border-gray-600 focus-within:border-blue-400 dark:focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-200 dark:focus-within:ring-blue-800 transition-all duration-200"
            onClick={handleContainerClick}
          >
            {/* Left side icons - responsive */}
            <div className="flex items-center pl-3 md:pl-4 relative">
              <button
                type="button"
                onClick={() => setShowAttachmentModal(!showAttachmentModal)}
                className="p-2 md:p-2.5 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
              >
                <Plus size={20} />
              </button>

              {/* Attachment options dropdown */}
              {showAttachmentModal && (
                <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-xl border border-gray-200 dark:border-gray-600 p-3 z-30 min-w-[200px] drop-shadow-lg">
                  <button
                    onClick={() => handleAttachmentOption('file')}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                  >
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <FileText size={18} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">File</span>
                  </button>
                  <button
                    onClick={() => handleAttachmentOption('camera')}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                  >
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                      <Camera size={18} className="text-green-600 dark:text-green-400" />
                    </div>
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Camera</span>
                  </button>
                  <button
                    onClick={() => handleAttachmentOption('photos')}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                  >
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                      <Image size={18} className="text-purple-600 dark:text-purple-400" />
                    </div>
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Photos</span>
                  </button>
                </div>
              )}
            </div>

            {/* Textarea input - improved mobile behavior */}
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInput}
              placeholder="Reply to Carson..."
              name="carson-message"
              className="flex-1 max-h-[100px] md:max-h-[200px] py-4 md:py-5 px-2 bg-transparent border-0 focus:ring-0 focus:outline-none resize-none text-base placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-gray-100 transition-all duration-200 ease-out"
              style={{ fontSize: "16px" }} // Prevents zoom on iOS Safari
              rows={1}
              disabled={isConversationLoading}
              autoComplete="off"
              autoCorrect="on"
              spellCheck="true"
              enterKeyHint="send"
              inputMode="text"
              autoCapitalize="sentences"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  if (input.trim() && !isConversationLoading) {
                    handleSubmit(e)
                  }
                }
              }}
              onFocus={() => {
                // Scroll to bottom when keyboard appears on iOS
                setTimeout(() => {
                  messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
                }, 300);
              }}
            />

            {/* Right side - send button only */}
            <div className="flex items-center pr-3 md:pr-4">
              {input.trim() ? (
                // Send button when there's text
                <button
                  type="submit"
                  disabled={isConversationLoading || !input.trim()}
                  className={cn(
                    "p-2 md:p-2.5 rounded-xl transition-all duration-200 shadow-sm",
                    input.trim() && !isConversationLoading
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                  )}
                >
                  {isConversationLoading ? (
                    <div className="h-5 w-5 md:h-6 md:w-6 border-2 border-white border-t-transparent rounded-full animate-spin no-transition"></div>
                  ) : (
                    <ArrowUp size={20} />
                  )}
                </button>
              ) : (
                // Microphone button when input is empty
                <button
                  type="button"
                  onClick={handleVoiceRecording}
                  disabled={isConversationLoading || isTranscribing || !toggleVoiceRecording}
                  className={cn(
                    "p-2 md:p-2.5 rounded-lg transition-all duration-200",
                    isRecording
                      ? "bg-red-500 text-white hover:bg-red-600"
                      : isTranscribing
                      ? "bg-blue-500 text-white"
                      : "text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20",
                    (isConversationLoading || isTranscribing || !toggleVoiceRecording) && "cursor-not-allowed opacity-50"
                  )}
                  title={
                    !toggleVoiceRecording 
                      ? "Voice input not available"
                      : isTranscribing 
                      ? "Transcribing..." 
                      : isRecording 
                      ? "Stop recording" 
                      : "Start voice input"
                  }
                >
                  {isTranscribing ? (
                    <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin no-transition"></div>
                  ) : isRecording ? (
                    <MicOff size={20} />
                  ) : (
                    <Mic size={20} />
                  )}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
    </ScrollContext.Provider>
  )
}
