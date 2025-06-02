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

    // Create FormData for OpenAI API
    const openaiFormData = new FormData();
    openaiFormData.append('file', audioFile);
    openaiFormData.append('model', 'whisper-1');
    openaiFormData.append('language', 'en'); // Force English for medical terminology
    openaiFormData.append('response_format', 'json');
    
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
    
    return NextResponse.json({ 
      transcript: result.text,
      duration: result.duration || null 
    });

  } catch (error) {
    console.error('Transcription error:', error);
    return NextResponse.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
} 