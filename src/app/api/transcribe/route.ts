import { NextRequest, NextResponse } from "next/server";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Increase timeout for long transcriptions
export const maxDuration = 60; // 60 seconds for long audio files

export async function POST(req: NextRequest) {
  try {
    // Parse the FormData from the request
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    
    if (!audioFile) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    if (!OPENAI_API_KEY) {
      return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 });
    }

    // Enhanced file validation and format detection
    const fileSize = audioFile.size;
    const fileName = audioFile.name;
    const fileType = audioFile.type;
    
    console.log(`[Transcribe] Processing audio file: ${fileName}, size: ${fileSize} bytes, type: ${fileType}`);
    
    // Validate file size (Whisper has 25MB limit)
    if (fileSize > 25 * 1024 * 1024) {
      return NextResponse.json({ 
        error: "Audio file too large", 
        details: "Maximum file size is 25MB" 
      }, { status: 413 });
    }
    
    // Estimate duration and warn about long files
    const estimatedBitrate = 64; // kbps (our new lower bitrate)
    const estimatedDurationSeconds = Math.round((fileSize * 8) / (estimatedBitrate * 1000));
    const estimatedMinutes = Math.floor(estimatedDurationSeconds / 60);
    
    console.log(`[Transcribe] Estimated duration: ${estimatedMinutes}:${(estimatedDurationSeconds % 60).toString().padStart(2, '0')} (${estimatedDurationSeconds}s)`);
    
    // Log warning for very long recordings
    if (estimatedDurationSeconds > 300) { // > 5 minutes
      console.warn(`[Transcribe] Very long recording detected: ~${estimatedMinutes} minutes`);
    }
    
    // Validate file type - Whisper supports multiple formats
    const supportedTypes = [
      'audio/webm', 'audio/mp4', 'audio/wav', 'audio/m4a', 
      'audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/flac'
    ];
    
    if (!supportedTypes.some(type => fileType.includes(type.split('/')[1]))) {
      console.warn(`[Transcribe] Potentially unsupported file type: ${fileType}, proceeding anyway...`);
    }

    // Create FormData for OpenAI API
    const openaiFormData = new FormData();
    openaiFormData.append('file', audioFile);
    openaiFormData.append('model', 'whisper-1');
    openaiFormData.append('language', 'en'); // Force English for medical terminology
    openaiFormData.append('response_format', 'json');
    
    // Enhanced prompt for better medical terminology accuracy
    const medicalPrompt = "This is a medical education conversation containing medical terms, anatomical references, disease names, drug names, and clinical terminology. Please prioritize medical accuracy.";
    openaiFormData.append('prompt', medicalPrompt);
    
    // Call OpenAI Whisper API with longer timeout for large files
    const transcriptionStartTime = Date.now();
    const timeoutDuration = estimatedDurationSeconds > 180 ? 45000 : 30000; // 45s for long files, 30s for shorter
    
    console.log(`[Transcribe] Starting transcription with ${timeoutDuration/1000}s timeout...`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.error(`[Transcribe] Timeout after ${timeoutDuration/1000}s`);
      controller.abort();
    }, timeoutDuration);
    
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: openaiFormData,
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const processingTime = Date.now() - transcriptionStartTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI Whisper API error:', response.status, errorText);
      
      // Provide specific error messages
      if (response.status === 413) {
        return NextResponse.json({ 
          error: "Audio file too large",
          details: "Please try a shorter recording or compress the audio file" 
        }, { status: 413 });
      } else if (response.status === 408) {
        return NextResponse.json({ 
          error: "Transcription timeout",
          details: "Your recording is too long to process. Please try a shorter recording." 
        }, { status: 408 });
      } else {
      return NextResponse.json({ 
        error: "Transcription failed",
        details: errorText 
      }, { status: response.status });
      }
    }

    const result = await response.json();
    
    console.log(`[Transcribe] Transcription successful in ${processingTime}ms: "${result.text}" (actual duration: ${result.duration || 'unknown'}s)`);
    
    // Clean and validate transcript
    const transcript = result.text?.trim() || '';
    
    if (!transcript) {
      console.warn('[Transcribe] Empty transcript received');
      return NextResponse.json({ 
        error: "No speech detected", 
        details: "Please try speaking more clearly or check your microphone" 
      }, { status: 400 });
    }
    
    return NextResponse.json({ 
      transcript,
      duration: result.duration || null,
      confidence: result.confidence || null,
      processingTime: `${processingTime}ms`,
      estimatedDuration: `${estimatedMinutes}:${(estimatedDurationSeconds % 60).toString().padStart(2, '0')}`
    });

  } catch (error: any) {
    console.error('Transcription error:', error);
    
    if (error.name === 'AbortError') {
      return NextResponse.json({ 
        error: "Transcription timeout",
        details: "Your recording took too long to process. Please try a shorter recording." 
      }, { status: 408 });
    }
    
    return NextResponse.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
} 