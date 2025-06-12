import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { callLLM } from "@/lib/prompts/llm-service"
import { CarsonSessionContext } from "@/lib/prompts/carsonTypes"

export async function POST(req: NextRequest) {
  console.log("📝 [API/study-notes] Generating study notes")
  
  try {
    const { sessionId } = await req.json()
    
    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing sessionId" },
        { status: 400 }
      )
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Database configuration error" },
        { status: 500 }
      )
    }

    // 1. Get session data from database
    console.log("🔍 [API/study-notes] Fetching session:", sessionId)
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('sessions')
      .select('*')
      .eq('session_id', sessionId)
      .single()

    if (sessionError || !session) {
      console.error("❌ [API/study-notes] Session not found:", sessionError)
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      )
    }

    // 2. Check if notes already exist
    const { data: existingNotes } = await supabaseAdmin
      .from('study_notes')
      .select('id')
      .eq('session_id', session.id)

    if (existingNotes && existingNotes.length > 0) {
      console.log("ℹ️ [API/study-notes] Notes already exist for this session")
      return NextResponse.json(
        { error: "Study notes already generated for this session" },
        { status: 409 }
      )
    }

    // 3. Generate study notes with LLM
    console.log("🧠 [API/study-notes] Generating notes with LLM")
    const sessionData: CarsonSessionContext = session.session_data
    const notesPrompt = generateCarsonNotesPrompt(sessionData)
    
    const response = await callLLM({
      sessionId: 'notes-generation',
      topic: notesPrompt,
      subtopics: [],
      currentSubtopicIndex: 0,
      history: [],
      currentQuestionType: 'parent',
      questionsAskedInCurrentSubtopic: 0,
      correctAnswersInCurrentSubtopic: 0,
      currentSubtopicState: 'assessing',
      shouldTransition: false,
      isComplete: false
    })

    // 4. Save generated notes to database
    console.log("💾 [API/study-notes] Saving generated notes")
    const { data: savedNotes, error: saveError } = await supabaseAdmin
      .from('study_notes')
      .insert({
        session_id: session.id,
        content: response.content,
        custom_title: sessionData.topic,
        generated_at: new Date().toISOString(),
        note_version: 'v1',
        is_edited: false,
        edit_count: 0,
        study_status: 'to_review'
      })
      .select(`
        *,
        session:sessions(topic, created_at, session_id)
      `)

    if (saveError) {
      console.error("❌ [API/study-notes] Failed to save notes:", saveError)
      return NextResponse.json(
        { error: "Failed to save generated notes", details: saveError.message },
        { status: 500 }
      )
    }

    console.log("✅ [API/study-notes] Notes generated and saved successfully")
    return NextResponse.json({ 
      success: true, 
      notes: savedNotes[0],
      message: "Study notes generated successfully"
    })

  } catch (error) {
    console.error("💥 [API/study-notes] Unexpected error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

function generateCarsonNotesPrompt(sessionData: CarsonSessionContext): string {
  // Extract struggle areas
  const strugglingTopics = sessionData.subtopics
    ?.filter(s => s.needsExplanation || s.status === 'gap')
    ?.map(s => `${s.title} (${s.questionsAsked} questions needed)`) || []

  // Extract key conversation moments
  const conversationSample = sessionData.history
    ?.slice(-10) // Last 10 exchanges
    ?.map(msg => `${msg.role === 'user' ? 'Student' : 'Carson'}: ${msg.content}`)
    ?.join('\n') || ''

  return `You are Carson writing study notes for a medical student who just completed learning about "${sessionData.topic}".

**STUDENT'S SESSION DATA:**
- Topic: ${sessionData.topic}
- Subtopics Covered: ${sessionData.subtopics?.map(s => s.title).join(', ') || 'None'}
- Total Exchanges: ${sessionData.history?.length || 0}
- Session Completed: ${sessionData.isComplete ? 'Yes' : 'No'}

**AREAS STUDENT STRUGGLED WITH:**
${strugglingTopics.length > 0 ? strugglingTopics.join('\n') : 'No major struggles identified'}

**RECENT CONVERSATION SAMPLE:**
${conversationSample}

Write study notes in Carson's authentic voice:
- Direct, honest medical assessment like a doctor talking to a future colleague
- Reference specific moments from the conversation when helpful
- Use real medical language naturally
- Sound like an attending physician, not an educational AI
- Include what they nailed vs what needs work
- Be encouraging but realistic

Format as clear markdown with these sections:
# Study Notes: ${sessionData.topic}

## What You Nailed
[Areas where student showed strong understanding]

## Review Points  
[Specific concepts that need reinforcement, with context]

## Key Moments That Helped
[Explanations or insights that led to understanding]

## Keep This Handy
[Quick reference points for future use]

Keep it concise but thorough - like notes you'd write for a student after a good teaching case.`
} 