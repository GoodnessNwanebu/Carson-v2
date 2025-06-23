"use client"

import type React from "react"
import { useState, useEffect, useRef, createContext, useContext } from "react"
import { useSwipeable } from "react-swipeable"
import { useSidebarState } from "./features/sidebar/sidebar-context"
import { Conversation } from "./features/conversation/conversation"
import { ErrorBoundary } from "./ui/error-boundary"
import { PenLine, GraduationCap, Code, Coffee, Sparkles, Plus, SendHorizonal, Telescope, Mic, MicOff, Camera, FileText, Image, HelpCircle } from "lucide-react"
import { useSession } from "./features/conversation/session-context"
import { cn } from "@/lib/utils"
import { CarsonMainContent } from "./carson-main-content"
import { useKnowledgeMap } from "./features/knowledge-map/knowledge-map-context"
import { useNotifications } from "@/hooks/use-notifications"

// Create context for new chat functionality
interface NewChatContextType {
  handleNewChat: () => void
}

const NewChatContext = createContext<NewChatContextType | null>(null)

export const useNewChat = () => {
  const context = useContext(NewChatContext)
  if (!context) {
    throw new Error('useNewChat must be used within a NewChatProvider')
  }
  return context
}

export default function CarsonUI() {
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
  const { success: notifySuccess, error: notifyError, warning: notifyWarning, info: notifyInfo } = useNotifications()

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

  // Swipe handlers for mobile navigation
  const sidebarSwipeHandlers = useSwipeable({
    onSwipedRight: () => {
      if (window.innerWidth < 768) { // Only on mobile
        setSidebarOpen(true)
      }
    },
    trackMouse: false,
    trackTouch: true,
    delta: 50,
    preventScrollOnSwipe: false,
    touchEventOptions: { passive: true }
  })

  const knowledgeMapSwipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      if (window.innerWidth < 768 && inConversation) { // Only on mobile and in conversation
        toggleMap()
      }
    },
    trackMouse: false,
    trackTouch: true,
    delta: 50,
    preventScrollOnSwipe: false,
    touchEventOptions: { passive: true }
  })

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim() || isLoading || isTransitioning) return

    // Store the query before clearing it
    const topicToSet = query.trim()
    
    // Start transition immediately
    setIsTransitioning(true)
    setIsLoading(true)
    setQuery("")
    
    // Use a single coordinated transition
    setTimeout(() => {
      // Set everything at once when blur is established
      setInitialTopic(topicToSet)
      setContentWidth("max-w-4xl")
    }, 200) // Longer delay to ensure smooth transition
    
    setTimeout(() => {
      setIsTransitioning(false)
      setIsLoading(false)
    }, 450) // Slightly longer to match the content delay
  }

  // Reset to home screen (new chat) - user controls sidebar manually
  const handleNewChat = () => {
    // Clear everything immediately without transition delays
    setQuery("")
    setInitialTopic(null)
    setIsLoading(false)
    setIsTransitioning(false)
    clearSession()
    clearKnowledgeMap()
    
    // **FIX**: Explicitly clear the input field to ensure it's empty
    if (inputRef.current) {
      inputRef.current.value = ""
      inputRef.current.style.height = "auto" // Reset height as well
    }
    
    // **ADDITIONAL FIX**: Focus the input field immediately
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus()
      }
    }, 10) // Very short delay to ensure DOM is updated
  }

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

  // Enhanced voice recording toggle with better long-recording support
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
          autoGainControl: true,
          // Add constraints for better long recording performance
          sampleRate: 16000, // Lower sample rate for speech (saves space)
          channelCount: 1     // Mono audio for speech (saves space)
        }
      });
      
      // Create new MediaRecorder with optimized settings for long recordings
      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus', // Opus codec is more efficient for speech
        audioBitsPerSecond: 64000 // Lower bitrate for longer recordings (64kbps)
      });
      let chunks: Blob[] = [];
      let recordingStartTime = Date.now();
      
      // Handle data collection with timeslicing to prevent memory buildup
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
          console.log(`[Voice] Chunk received: ${event.data.size} bytes, total chunks: ${chunks.length}`);
          
          // Optional: Show progress for long recordings
          const recordingDuration = Math.floor((Date.now() - recordingStartTime) / 1000);
          if (recordingDuration > 30 && recordingDuration % 15 === 0) {
            console.log(`[Voice] Recording in progress: ${Math.floor(recordingDuration / 60)}:${(recordingDuration % 60).toString().padStart(2, '0')}`);
          }
        }
      };

      // Handle recording completion with enhanced error handling
      recorder.onstop = async () => {
        console.log('[Voice] Recording stopped, processing...');
        setIsRecording(false);
        
        if (chunks.length === 0) {
          notifyError('No Audio Detected', { description: 'Please check your microphone and try again.' });
          return;
        }

        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        const recordingDuration = Math.floor((Date.now() - recordingStartTime) / 1000);
        console.log(`[Voice] Created audio blob: ${audioBlob.size} bytes, duration: ~${recordingDuration}s`);
        
        // Warn user about large files
        if (audioBlob.size > 10 * 1024 * 1024) { // > 10MB
          console.warn('[Voice] Large audio file detected, transcription may take longer...');
          notifyInfo('Processing Large Recording', { description: 'Your recording is quite long. Transcription may take a minute...' });
        }
        
        // Transcribe audio with enhanced error handling
        try {
          setIsTranscribing(true);
          const formData = new FormData();
          formData.append('audio', audioBlob, 'recording.webm');
          
          // Add timeout for long recordings
          const controller = new AbortController();
          const timeoutId = setTimeout(() => {
            controller.abort();
          }, 60000); // 60 second timeout for transcription
          
          const response = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData,
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            const errorData = await response.json();
            console.error('[Voice] Transcription API error:', response.status, errorData);
            
            // Provide specific error messages based on the failure
            if (response.status === 413) {
              throw new Error('Recording too large. Please try a shorter recording.');
            } else if (response.status === 408 || response.status === 504) {
              throw new Error('Transcription timed out. Please try a shorter recording.');
            } else {
              throw new Error(errorData.details || `Transcription failed: ${response.status}`);
            }
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
            
            // Show success message with recording stats
            const durationText = recordingDuration > 60 
              ? `${Math.floor(recordingDuration / 60)}:${(recordingDuration % 60).toString().padStart(2, '0')}`
              : `${recordingDuration}s`;
            notifySuccess('Voice Input Added', { description: `Your ${durationText} recording has been transcribed and added.` });
          } else {
            notifyError('No Speech Detected', { description: 'Please try speaking more clearly.' });
          }
        } catch (error: any) {
          console.error('[Voice] Transcription failed:', error);
          
          if (error.name === 'AbortError') {
            notifyError('Transcription Timeout', { description: 'Your recording was too long to process. Please try a shorter recording.' });
          } else {
            const errorMessage = error.message || 'Voice transcription failed. Please try again.';
            notifyError('Transcription Failed', errorMessage);
          }
        } finally {
          setIsTranscribing(false);
        }
      };

      // Handle errors with more specific messages
      recorder.onerror = (event: any) => {
        console.error('[Voice] MediaRecorder error:', event.error);
        setIsRecording(false);
        
        if (event.error.name === 'InvalidStateError') {
          notifyError('Recording Error', 'Please stop the current recording before starting a new one.');
        } else {
          notifyError('Recording Error', 'Recording error occurred. Please try again.');
        }
      };

      // Start recording with timeslicing to prevent memory issues
      setMediaRecorder(recorder);
      recorder.start(1000); // Save chunks every 1 second to prevent memory buildup
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
    <NewChatContext.Provider value={{ handleNewChat }}>
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
    </NewChatContext.Provider>
  )
}

interface QuickActionButtonProps {
  icon: React.ReactNode
  label: string
  onClick?: () => void
}
