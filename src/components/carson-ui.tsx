"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { useSwipeable } from "react-swipeable"
import { useSidebarState } from "./features/sidebar/sidebar-context"
import { Conversation } from "./features/conversation/conversation"
import { ErrorBoundary } from "./ui/error-boundary"
import { PenLine, GraduationCap, Code, Coffee, Sparkles, Plus, SendHorizonal, Telescope, Mic, MicOff, Camera, FileText, Image, HelpCircle } from "lucide-react"
import { useSession } from "./features/conversation/session-context"
import { cn } from "@/lib/utils"
import { ThemeProvider } from "@/contexts/theme-context"
import { CarsonMainContent } from "./carson-main-content"
import { useKnowledgeMap } from "./features/knowledge-map/knowledge-map-context"
import { useNotificationHelpers } from "@/components/ui/notification-system"

export default function CarsonUI() {
  console.log("CarsonUI")
  // Add viewport meta tag for better mobile behavior
  useEffect(() => {
    // Add viewport meta tag to prevent scaling and improve mobile rendering
    const meta = document.createElement("meta")
    meta.name = "viewport"
    meta.content = "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content"
    document.head.appendChild(meta)
 
    // Add class to body for touch optimization only
    document.body.classList.add("touch-manipulation")
    
    // Add CSS for hover media queries
    const style = document.createElement("style")
    style.textContent = `
      @media (hover: none) and (pointer: coarse) {
        .hover\\:bg-gray-50:hover { background-color: inherit !important; }
        .hover\\:text-blue-600:hover { color: inherit !important; }
        .hover\\:bg-blue-50:hover { background-color: inherit !important; }
        .hover\\:border-blue-200:hover { border-color: inherit !important; }
        .hover\\:shadow-md:hover { box-shadow: inherit !important; }
        .hover\\:bg-blue-700:hover { background-color: inherit !important; }
        .hover\\:bg-red-600:hover { background-color: inherit !important; }
      }
      
      /* Ensure proper scrolling behavior */
      html, body {
        overflow: visible;
        height: 100%;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
      }
    `
    document.head.appendChild(style)

    return () => {
      if (document.head.contains(meta)) document.head.removeChild(meta)
      if (document.head.contains(style)) document.head.removeChild(style)
      document.body.classList.remove("touch-manipulation")
    }
  }, [])

  return (
          <ErrorBoundary>
            <CarsonUIContent />
          </ErrorBoundary>
  )
}

function CarsonUIContent() {
  const [query, setQuery] = useState("")
  const [deepDive, setDeepDive] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [initialTopic, setInitialTopic] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const { collapsed, setSidebarOpen, sidebarOpen } = useSidebarState()
  const { isMapOpen, toggleMap, clearKnowledgeMap } = useKnowledgeMap()
  const { session, clearSession } = useSession()
  const [contentWidth, setContentWidth] = useState("max-w-2xl")
  const { success: notifySuccess, error: notifyError, warning: notifyWarning, info: notifyInfo } = useNotificationHelpers()

  // **CLEAN SEPARATION**: Handle new vs existing conversations separately
  const hasExistingConversation = !!(session && session.history && session.history.length > 0)
  const isStartingNewConversation = !session && !!initialTopic
  const inConversation = hasExistingConversation || isStartingNewConversation
  
  console.log('🎯 [CarsonUI] Conversation state:', {
    hasSession: !!session,
    hasHistory: !!(session?.history?.length),
    historyLength: session?.history?.length || 0,
    inConversation,
    sessionId: session?.sessionId
  })

  // Voice-to-text state (simplified)
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const conversationVoiceCallback = useRef<((transcript: string) => void) | null>(null);

  // Attachment modal state
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);

  // Swipe handlers for sidebar (left edge swipe) - now always listening for touch devices
  const sidebarSwipeHandlers = useSwipeable({
    onSwipedRight: () => {
      if (!sidebarOpen) {
        setSidebarOpen(true)
      }
    },
    onSwipedLeft: () => {
      if (sidebarOpen) {
        setSidebarOpen(false)
      }
    },
    trackMouse: false,
    trackTouch: true,
    delta: 50, // Minimum swipe distance
    preventScrollOnSwipe: false, // Allow scrolling
    touchEventOptions: { passive: true }
  })

  // Swipe handlers for knowledge map (right edge swipe) - always active for touch devices
  const knowledgeMapSwipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      if (!isMapOpen && inConversation) {
        toggleMap()
      }
    },
    onSwipedRight: () => {
      if (isMapOpen && inConversation) {
        toggleMap()
      }
    },
    trackMouse: false,
    trackTouch: true,
    delta: 50,
    preventScrollOnSwipe: false, // Allow scrolling
    touchEventOptions: { passive: true }
  })

  // Update content width when sidebar state changes - CSS responsive
  useEffect(() => {
    setContentWidth(collapsed ? "max-w-3xl" : "max-w-2xl")
  }, [collapsed])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim() || isLoading) return

    const submittedQuery = query // Capture immediately to prevent race conditions
    setIsLoading(true)
    
    // Apple-style: Faster, more decisive timing
    setTimeout(() => {
      setIsTransitioning(true)
    }, 150) // Quicker start
    
    setTimeout(() => {
      setIsLoading(false)
      setInitialTopic(submittedQuery)
    }, 350) // Content appears near transition end
    
    setTimeout(() => {
      setIsTransitioning(false)
    }, 400) // Snappier end
  }

  // Reset to home screen (new chat) - user controls sidebar manually
  const handleNewChat = () => {
    // Immediate state reset to prevent any lingering UI issues
    setIsTransitioning(true)
    
    // Clear everything immediately
    setQuery("")
    setInitialTopic(null)
    clearSession()
    clearKnowledgeMap()
    
    // Force transition to home screen after brief delay
    setTimeout(() => {
      setIsLoading(false)
      setIsTransitioning(false)
    }, 100)
  }

  // Auto-resize textarea with universal best practices
  const resizeTextarea = (textarea: HTMLTextAreaElement) => {
    // Reset height to auto to get accurate scrollHeight measurement
    textarea.style.height = "auto"
    
    // Calculate content height
    const scrollHeight = textarea.scrollHeight
    
    // Set responsive max heights based on device
    const isMobile = window.innerWidth < 768
    const maxHeight = isMobile ? 80 : 120 // 3-4 lines mobile, 4-5 lines desktop
    const minHeight = 60 // Slightly larger minimum for home screen
    
    // Calculate final height within bounds
    const finalHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight)
    
    // Apply height with smooth transition
    textarea.style.height = `${finalHeight}px`
    
    // Enable internal scrolling only when at max height
    textarea.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden'
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target
    setQuery(textarea.value)
    resizeTextarea(textarea);
  }

  // Focus the input field when clicking anywhere in the input container
  const handleContainerClick = () => {
    inputRef.current?.focus()
  }

  // Handle attachment option selection
  const handleAttachmentOption = (option: 'file' | 'camera' | 'photos') => {
    setShowAttachmentModal(false);
    // TODO: Implement attachment handling
    console.log(`Selected attachment option: ${option}`);
  };

  // Simple voice recording toggle - completely rewritten for simplicity
  const toggleVoiceRecording = async () => {
    // If currently recording, stop it
    if (isRecording && mediaRecorder) {
      console.log('[Voice] Stopping recording...');
      mediaRecorder.stop();
      setIsRecording(false);
      return;
    }

    // If not recording, start a new recording session
    try {
      console.log('[Voice] Starting new recording session...');
      
      // Get microphone permission and stream
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      // Create new MediaRecorder
      const recorder = new MediaRecorder(stream);
      let chunks: Blob[] = [];
      
      // Handle data collection
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      // Handle recording completion
      recorder.onstop = async () => {
        console.log('[Voice] Recording stopped, processing...');
        setIsRecording(false);
        
        if (chunks.length === 0) {
          notifyError('No Audio Detected', 'Please check your microphone and try again.');
          return;
        }

        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        console.log(`[Voice] Created audio blob: ${audioBlob.size} bytes`);
        
        // Transcribe audio
        try {
          setIsTranscribing(true);
          const formData = new FormData();
          formData.append('audio', audioBlob, 'recording.webm');
          
          const response = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData,
          });
          
          if (!response.ok) {
            throw new Error(`Transcription failed: ${response.status}`);
          }
          
          const result = await response.json();
          const transcript = result.transcript || result.text || '';
          console.log(`[Voice] Received transcript: "${transcript}"`);
          
          if (transcript && transcript.trim()) {
            // Add transcript to appropriate input field
            if (inConversation && conversationVoiceCallback.current) {
              console.log('[Voice] Using conversation voice callback');
              conversationVoiceCallback.current(transcript);
            } else {
              console.log('[Voice] Using home screen setQuery');
              setQuery(prevQuery => prevQuery + (prevQuery ? ' ' : '') + transcript);
            }
            notifySuccess('Voice Input Added', 'Your speech has been added to the input field.');
          } else {
            notifyError('No Speech Detected', 'Please try speaking more clearly.');
          }
        } catch (error: any) {
          console.error('[Voice] Transcription failed:', error);
          notifyError('Transcription Failed', 'Voice transcription failed. Please try again.');
        } finally {
          setIsTranscribing(false);
        }
      };

      // Handle errors
      recorder.onerror = (event: any) => {
        console.error('[Voice] MediaRecorder error:', event.error);
        notifyError('Recording Error', 'Recording error occurred. Please try again.');
        setIsRecording(false);
      };

      // Start recording immediately
      setMediaRecorder(recorder);
      recorder.start();
      setIsRecording(true);
      notifyInfo('Recording Started', 'Speak now. Tap the microphone again to stop.');
      
    } catch (error: any) {
      console.error('[Voice] Failed to start recording:', error);
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        notifyError('Permission Denied', 'Please allow microphone access and try again.');
      } else if (error.name === 'NotFoundError') {
        notifyError('No Microphone', 'No microphone found. Please connect a microphone.');
      } else {
        notifyError('Microphone Error', 'Failed to access microphone. Please try again.');
      }
    }
  };

  return (
    <>
      {/* Left edge swipe zone for sidebar - only on mobile */}
      <div
        {...sidebarSwipeHandlers}
        className="absolute left-0 top-0 bottom-0 w-8 z-30 pointer-events-auto md:hidden"
        style={{ touchAction: 'pan-y pinch-zoom' }}
      />

      {/* Right edge swipe zone for knowledge map - only on mobile when in conversation */}
      {inConversation && (
        <div
          {...knowledgeMapSwipeHandlers}
          className="absolute right-0 top-0 bottom-0 w-8 z-30 pointer-events-auto md:hidden"
          style={{ touchAction: 'pan-y pinch-zoom' }}
        />
      )}

      <div
        className={cn(
          "flex-1 flex flex-col transition-all duration-700 ease-in-out h-full",
          isTransitioning && "opacity-20 scale-98 blur-sm",
        )}
        style={{ minHeight: 0 }}
      >
        <CarsonMainContent
          inConversation={inConversation}
          query={query}
          setQuery={setQuery}
          deepDive={deepDive}
          setDeepDive={setDeepDive}
          isLoading={isLoading}
          setIsLoading={setIsLoading}
          isTransitioning={isTransitioning}
          setIsTransitioning={setIsTransitioning}
          initialTopic={initialTopic}
          setInitialTopic={setInitialTopic}
          inputRef={inputRef}
          handleSubmit={handleSubmit}
          handleNewChat={handleNewChat}
          isRecording={isRecording}
          mediaRecorder={mediaRecorder}
          audioChunks={[]}
          isTranscribing={isTranscribing}
          showAttachmentModal={showAttachmentModal}
          setShowAttachmentModal={setShowAttachmentModal}
          handleAttachmentOption={handleAttachmentOption}
          toggleVoiceRecording={toggleVoiceRecording}
          conversationVoiceCallback={conversationVoiceCallback}
        />
      </div>
    </>
  )
}

interface QuickActionButtonProps {
  icon: React.ReactNode
  label: string
  onClick?: () => void
}
