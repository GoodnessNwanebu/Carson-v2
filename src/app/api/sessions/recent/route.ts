import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function GET(req: NextRequest) {
  console.log("📋 [API/sessions/recent] Fetching recent sessions")
  
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Database configuration error" },
        { status: 500 }
      )
    }

    // Get recent sessions with metadata - limit to 20 for MVP
    const { data: sessions, error } = await supabaseAdmin
      .from('sessions')
      .select(`
        id,
        session_id,
        topic,
        created_at,
        updated_at,
        completed,
        session_data
      `)
      .order('updated_at', { ascending: false })
      .limit(20)

    if (error) {
      console.error("❌ [API/sessions/recent] Database error:", error)
      return NextResponse.json(
        { error: "Failed to fetch recent sessions", details: error.message },
        { status: 500 }
      )
    }

    // Transform sessions for frontend consumption
    const transformedSessions = sessions?.map(session => {
      const sessionData = session.session_data || {}
      const messageCount = sessionData.history?.length || 0
      const lastMessage = sessionData.history?.[messageCount - 1]?.content || ''
      
      return {
        id: session.id,
        sessionId: session.session_id,
        title: session.topic || 'Untitled Conversation',
        createdAt: session.created_at,
        updatedAt: session.updated_at,
        completed: session.completed,
        messageCount,
        lastMessage: lastMessage.substring(0, 100) + (lastMessage.length > 100 ? '...' : ''),
        subtopicsCount: sessionData.subtopics?.length || 0,
        isComplete: sessionData.isComplete || session.completed,
      }
    }) || []

    console.log(`✅ [API/sessions/recent] Found ${transformedSessions.length} recent sessions`)
    
    return NextResponse.json({
      sessions: transformedSessions,
      total: transformedSessions.length
    })

  } catch (error) {
    console.error("💥 [API/sessions/recent] Unexpected error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  console.log("📝 [API/sessions/recent] Updating session access time")
  
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

    // Update last accessed time
    const { error } = await supabaseAdmin
      .from('sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('session_id', sessionId)

    if (error) {
      console.error("❌ [API/sessions/recent] Failed to update access time:", error)
      return NextResponse.json(
        { error: "Failed to update session access time" },
        { status: 500 }
      )
    }

    console.log("✅ [API/sessions/recent] Session access time updated")
    return NextResponse.json({ success: true })

  } catch (error) {
    console.error("💥 [API/sessions/recent] Unexpected error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
} 