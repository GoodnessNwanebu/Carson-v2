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

  // Enhanced device and browser detection for voice features
  const getDeviceCapabilities = () => {
    const userAgent = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(userAgent);
    const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);
    const isAndroid = /Android/.test(userAgent);
    const isChrome = /Chrome/.test(userAgent);
    const isFirefox = /Firefox/.test(userAgent);
    const isEdge = /Edge/.test(userAgent);
    
    return {
      isIOS,
      isSafari,
      isAndroid, 
      isChrome,
      isFirefox,
      isEdge,
      isMobile: isIOS || isAndroid,
      supportsMediaRecorder: typeof MediaRecorder !== 'undefined',
      supportsGetUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
    };
  };

  // Get optimal audio configuration for current device/browser
  const getAudioConfig = () => {
    const capabilities = getDeviceCapabilities();
    
    // iOS Safari - very limited support
    if (capabilities.isIOS && capabilities.isSafari) {
      return {
        mimeType: 'audio/mp4', // Safest for iOS Safari
        codecs: '',
        fileExtension: 'mp4',
        fallbacks: ['audio/wav', 'audio/webm']
      };
    }
    
    // Android Chrome - good webm support
    if (capabilities.isAndroid && capabilities.isChrome) {
      return {
        mimeType: 'audio/webm;codecs=opus',
        codecs: 'opus',
        fileExtension: 'webm',
        fallbacks: ['audio/webm', 'audio/mp4', 'audio/wav']
      };
    }
    
    // Firefox - prefers webm but different codec
    if (capabilities.isFirefox) {
      return {
        mimeType: 'audio/webm;codecs=vorbis',
        codecs: 'vorbis', 
        fileExtension: 'webm',
        fallbacks: ['audio/webm', 'audio/wav']
      };
    }
    
    // Chrome desktop - best support
    if (capabilities.isChrome) {
      return {
        mimeType: 'audio/webm;codecs=opus',
        codecs: 'opus',
        fileExtension: 'webm',
        fallbacks: ['audio/webm', 'audio/wav']
      };
    }
    
    // Edge and others - safe fallback
    return {
      mimeType: 'audio/wav',
      codecs: '',
      fileExtension: 'wav',
      fallbacks: ['audio/wav', 'audio/webm']
    };
  };

  // Enhanced MediaRecorder support detection
  const checkMediaRecorderSupport = (mimeType: string) => {
    if (!MediaRecorder.isTypeSupported) return false;
    return MediaRecorder.isTypeSupported(mimeType);
  };

  // Initialize audio recording with cross-platform fallbacks
  const initializeRecording = async () => {
    if (mediaRecorder) return true; // Already initialized
    
    const capabilities = getDeviceCapabilities();
    
    // Check basic support first
    if (!capabilities.supportsGetUserMedia) {
      console.error('[Voice] getUserMedia not supported');
      return false;
    }
    
    if (!capabilities.supportsMediaRecorder) {
      console.error('[Voice] MediaRecorder not supported');
      return false;
    }
    
    try {
      console.log('[Voice] Requesting microphone access...');
      
      // Request audio stream with cross-platform constraints
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // Enhanced constraints for better quality
          sampleRate: { ideal: 16000 }, // Good for speech recognition
          channelCount: { ideal: 1 },    // Mono for speech
        }
      });
      
      console.log('[Voice] Microphone access granted, initializing MediaRecorder...');
      
      const audioConfig = getAudioConfig();
      
      // Try to create MediaRecorder with best supported format
      let mimeType = audioConfig.mimeType;
      let recorder: MediaRecorder;
      
      // Always initialize recorder
      if (checkMediaRecorderSupport(mimeType)) {
        console.log(`[Voice] Using primary format: ${mimeType}`);
        recorder = new MediaRecorder(stream, { mimeType });
      } else {
        // Try fallbacks
        recorder = new MediaRecorder(stream); // Default fallback
        for (const fallback of audioConfig.fallbacks) {
          if (checkMediaRecorderSupport(fallback)) {
            console.log(`[Voice] Using fallback format: ${fallback}`);
            mimeType = fallback;
            recorder = new MediaRecorder(stream, { mimeType: fallback });
            break;
          }
        }
        
        // If we reach here without finding a fallback, recorder is already initialized with default
        if (recorder.mimeType === '') {
          console.log('[Voice] Using default MediaRecorder (no explicit mimeType)');
        }
      }
      
      // Set up recording event handlers
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log(`[Voice] Data chunk received: ${event.data.size} bytes`);
          setAudioChunks(prev => [...prev, event.data]);
        }
      };

      recorder.onstop = () => {
        console.log('[Voice] Recording stopped');
        stream.getTracks().forEach(track => track.stop());
      };
      
      recorder.onerror = (event) => {
        console.error('[Voice] MediaRecorder error:', event);
      };

      setMediaRecorder(recorder);
      console.log('[Voice] MediaRecorder initialized successfully');
      return true;
      
    } catch (error) {
      console.error('[Voice] Failed to initialize recording:', error);
      
      // Provide user-friendly error messages
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          console.error('[Voice] Microphone permission denied');
        } else if (error.name === 'NotFoundError') {
        console.error('[Voice] No microphone found');
        } else if (error.name === 'NotSupportedError') {
          console.error('[Voice] Audio recording not supported');
        }
      }
      
      return false;
    }
  };

  // Send audio to transcription API (implement based on your backend)
  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      setIsTranscribing(true);
      console.log(`[Voice] Transcribing audio blob: ${audioBlob.size} bytes, type: ${audioBlob.type}`);
      
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      
      // TODO: Replace with your actual transcription endpoint
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`Transcription failed: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('[Voice] Transcription result:', result);
      
      return result.transcript || result.text || '';
    } catch (error) {
      console.error('[Voice] Transcription error:', error);
      throw error;
    } finally {
      setIsTranscribing(false);
    }
  };

  const toggleVoiceRecording = async () => {
    if (!mediaRecorder) {
      const initialized = await initializeRecording();
      if (!initialized) return;
      }

    if (isRecording) {
      // Stop recording
      console.log('[Voice] Stopping recording...');
      mediaRecorder!.stop();
      setIsRecording(false);
      
      // Process the recorded audio
      setTimeout(async () => {
        if (audioChunks.length > 0) {
          console.log(`[Voice] Processing ${audioChunks.length} audio chunks...`);
          
          // Create blob from chunks
          const audioBlob = new Blob(audioChunks, { 
            type: audioChunks[0]?.type || 'audio/webm' 
          });
      
          console.log(`[Voice] Created audio blob: ${audioBlob.size} bytes`);
      
      try {
            const transcript = await transcribeAudio(audioBlob);
            console.log('[Voice] Transcription successful:', transcript);
        
            if (transcript && transcript.trim()) {
              // Handle based on context
              if (inConversation && conversationVoiceCallback.current) {
                // In conversation - use callback
                conversationVoiceCallback.current(transcript);
          } else {
                // On home screen - set query
                setQuery(transcript);
                // Auto-resize the textarea
          setTimeout(() => {
            if (inputRef.current) {
              resizeTextarea(inputRef.current);
            }
                }, 100);
          }
          }
          } catch (error) {
            console.error('[Voice] Failed to process recording:', error);
          }
          
          // Clear chunks for next recording
          setAudioChunks([]);
      }
      }, 100);
    } else {
      // Start recording
      console.log('[Voice] Starting recording...');
      setAudioChunks([]); // Clear previous chunks
      mediaRecorder!.start(1000); // Collect data every second
      setIsRecording(true);
    }
  };

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
    <>
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
    </>
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
