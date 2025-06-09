import { NextRequest, NextResponse } from "next/server";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

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
      }, { status: 400 });
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
    
    // Add prompt to improve medical terminology accuracy
    const medicalPrompt = "This is a medical education conversation containing medical terms, anatomical references, disease names, and clinical terminology.";
    openaiFormData.append('prompt', medicalPrompt);
    
    // Call OpenAI Whisper API
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: openaiFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI Whisper API error:', response.status, errorText);
      return NextResponse.json({ 
        error: "Transcription failed",
        details: errorText 
      }, { status: response.status });
    }

    const result = await response.json();
    
    console.log(`[Transcribe] Transcription successful: "${result.text}" (${result.duration || 'unknown'}s)`);
    
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
      confidence: result.confidence || null
    });

  } catch (error) {
    console.error('Transcription error:', error);
    return NextResponse.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
} 