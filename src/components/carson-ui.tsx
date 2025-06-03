"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { useSwipeable } from "react-swipeable"
import { Sidebar } from "./features/sidebar/sidebar"
import { SidebarProvider, useSidebarState } from "./features/sidebar/sidebar-context"
import { KnowledgeMapPanel } from "./features/knowledge-map/knowledge-map-panel"
import { Conversation } from "./features/conversation/conversation"
import { ErrorBoundary } from "./ui/error-boundary"
import { PenLine, GraduationCap, Code, Coffee, Sparkles, Plus, SendHorizonal, Telescope, Mic, MicOff, Camera, FileText, Image, HelpCircle } from "lucide-react"
import { useSession } from "./features/conversation/session-context"
import { cn } from "@/lib/utils"
import { ThemeProvider } from "@/contexts/theme-context"
import { CarsonMainContent } from "./carson-main-content"
import { useKnowledgeMap } from "./features/knowledge-map/knowledge-map-context"

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
      
      /* Ensure scrollable containers work properly */
      // .overflow-y-scroll {
      //   -webkit-overflow-scrolling: touch;
      //   overscroll-behavior: contain;
      // }
    `
    document.head.appendChild(style)

    return () => {
      if (document.head.contains(meta)) document.head.removeChild(meta)
      if (document.head.contains(style)) document.head.removeChild(style)
      document.body.classList.remove("touch-manipulation")
    }
  }, [])

  return (
    <ThemeProvider>
      <SidebarProvider>
          <ErrorBoundary>
            <CarsonUIContent />
          </ErrorBoundary>
      </SidebarProvider>
    </ThemeProvider>
  )
}

function CarsonUIContent() {
  const [query, setQuery] = useState("")
  const [deepDive, setDeepDive] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [inConversation, setInConversation] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [initialTopic, setInitialTopic] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const { collapsed, setSidebarOpen, sidebarOpen } = useSidebarState()
  const { isMapOpen, toggleMap, clearKnowledgeMap } = useKnowledgeMap()
  const { clearSession } = useSession()
  const [contentWidth, setContentWidth] = useState("max-w-2xl")

  // Voice-to-text state (Whisper-based)
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const conversationVoiceCallback = useRef<((transcript: string) => void) | null>(null);

  // Attachment modal state
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);

  // Initialize audio recording for initial input only when user clicks microphone
  const initializeRecording = async () => {
    if (mediaRecorder) return; // Already initialized
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus' // Good compression, supported by OpenAI
      });
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setAudioChunks(prev => [...prev, event.data]);
        }
      };

      recorder.onstop = async () => {
        setIsRecording(false);
        // Will handle transcription in the toggle function
      };

      setMediaRecorder(recorder);
      return true; // Success
    } catch (error) {
      console.error('Error accessing microphone:', error);
      return false; // Failed
    }
  };

  // Cleanup function for when component unmounts
  useEffect(() => {
    return () => {
      if (mediaRecorder && mediaRecorder.stream) {
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [mediaRecorder]);

  // Handle voice recording toggle for initial input
  const toggleVoiceRecording = async () => {
    // Initialize microphone if not already done
    if (!mediaRecorder) {
      const success = await initializeRecording();
      if (!success) {
        // Could show error state here
        return;
      }
    }

    if (!mediaRecorder) return;

    if (isRecording) {
      // Stop recording and transcribe
      mediaRecorder.stop();
      setIsTranscribing(true);
      
      // Create audio blob from chunks
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm;codecs=opus' });
      setAudioChunks([]); // Clear chunks for next recording
      
      try {
        // Send to our transcription API
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        
        const response = await fetch('/api/transcribe', {
          method: 'POST',
          body: formData,
        });
        
        if (response.ok) {
          const { transcript } = await response.json();
          
          // Check if we're in conversation mode vs home screen mode
          if (inConversation) {
            // In conversation mode - set transcript for conversation component to pick up
            conversationVoiceCallback.current?.(transcript);
          } else {
            // Home screen mode - update query as before
          setQuery(prevQuery => prevQuery + (prevQuery ? ' ' : '') + transcript);
          
          // Auto-resize textarea after adding voice input
          if (inputRef.current) {
          setTimeout(() => {
            if (inputRef.current) {
              resizeTextarea(inputRef.current);
            }
          }, 10);
          }
          }
        } else {
          console.error('Transcription failed:', response.statusText);
        }
      } catch (error) {
        console.error('Error during transcription:', error);
      } finally {
        setIsTranscribing(false);
      }
    } else {
      // Start recording
      setAudioChunks([]);
      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
    }
  };

  // Swipe handlers for sidebar (left edge swipe) - always active for touch devices
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

    setIsLoading(true)
    setTimeout(() => {
      setIsTransitioning(true)
    }, 300)
    setTimeout(() => {
      setIsLoading(false)
      setInitialTopic(query)
      setInConversation(true)
    }, 1000)
    setTimeout(() => {
      setIsTransitioning(false)
    }, 1200)
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
      setInConversation(false)
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

  return (
    <div className="fixed inset-0 flex bg-gray-50 dark:bg-gray-900">
      <Sidebar onNewChat={handleNewChat} />

      {/* Only show knowledge map when in conversation */}
      {inConversation && <KnowledgeMapPanel />}

      {/* Left edge swipe zone for sidebar - only on mobile */}
      <div
        {...sidebarSwipeHandlers}
        className="fixed left-0 top-0 bottom-0 w-8 z-30 pointer-events-auto md:hidden"
        style={{ touchAction: 'pan-y pinch-zoom' }}
      />

      {/* Right edge swipe zone for knowledge map - only on mobile when in conversation */}
      {inConversation && (
        <div
          {...knowledgeMapSwipeHandlers}
          className="fixed right-0 top-0 bottom-0 w-8 z-30 pointer-events-auto md:hidden"
          style={{ touchAction: 'pan-y pinch-zoom' }}
        />
      )}

      <div
        className={cn(
          "flex-1 flex flex-col transition-all duration-700 ease-in-out h-full",
          // Responsive margins: no margin on mobile, responsive margin on desktop
          "ml-0 md:ml-[60px]",
          !collapsed && "md:ml-[260px]",
          isTransitioning && "opacity-20 scale-98 blur-sm",
        )}
        style={{ minHeight: 0 }}
      >
        <CarsonMainContent
          inConversation={inConversation}
          setInConversation={setInConversation}
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
          audioChunks={audioChunks}
          isTranscribing={isTranscribing}
          showAttachmentModal={showAttachmentModal}
          setShowAttachmentModal={setShowAttachmentModal}
          handleAttachmentOption={handleAttachmentOption}
          toggleVoiceRecording={toggleVoiceRecording}
          conversationVoiceCallback={conversationVoiceCallback}
        />
      </div>
    </div>
  )
}

interface QuickActionButtonProps {
  icon: React.ReactNode
  label: string
  onClick?: () => void
}

function QuickActionButton({ icon, label, onClick }: QuickActionButtonProps) {
  return (
    <button
      className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 bg-white dark:bg-gray-700 rounded-lg sm:rounded-xl text-gray-700 dark:text-gray-200 text-sm sm:text-base font-medium transition-all duration-200 border border-gray-200 dark:border-gray-600 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 active:scale-95 active:bg-gray-50 dark:active:bg-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-200 dark:hover:border-blue-500 hover:shadow-md"
      onClick={onClick}
      type="button"
      role="button"
      tabIndex={0}
    >
      {icon}
      {label}
    </button>
  )
}
