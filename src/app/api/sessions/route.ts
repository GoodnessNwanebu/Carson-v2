import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { CarsonSessionContext } from "@/lib/prompts/carsonTypes"

export async function POST(req: NextRequest) {
  console.log("🗄️ [API/sessions] Saving session to database")
  
  try {
    const sessionData: CarsonSessionContext = await req.json()
    
    // Validate required fields
    if (!sessionData.sessionId || !sessionData.topic) {
      return NextResponse.json(
        { error: "Missing required fields: sessionId and topic" },
        { status: 400 }
      )
    }

    if (!supabaseAdmin) {
      console.error("❌ [API/sessions] Supabase admin client not configured")
      return NextResponse.json(
        { error: "Database configuration error" },
        { status: 500 }
      )
    }

    console.log("📥 [API/sessions] Session data:", {
      sessionId: sessionData.sessionId,
      topic: sessionData.topic,
      subtopicsCount: sessionData.subtopics?.length || 0,
      historyLength: sessionData.history?.length || 0,
      isComplete: sessionData.isComplete
    })

    // Upsert session (insert or update if exists)
    const { data, error } = await supabaseAdmin
      .from('sessions')
      .upsert({
        session_id: sessionData.sessionId,
        topic: sessionData.topic,
        session_data: sessionData,
        completed: sessionData.isComplete || false,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'session_id'
      })
      .select()

    if (error) {
      // **ENHANCED ERROR HANDLING**: If it's a duplicate key error, try to handle it gracefully
      if (error.code === '23505' && error.message.includes('duplicate key')) {
        console.warn("⚠️ [API/sessions] Duplicate session detected, attempting update:", sessionData.sessionId)
        
        // Try to update the existing session instead
        const { data: updateData, error: updateError } = await supabaseAdmin
          .from('sessions')
          .update({
            topic: sessionData.topic,
            session_data: sessionData,
            completed: sessionData.isComplete || false,
            updated_at: new Date().toISOString()
          })
          .eq('session_id', sessionData.sessionId)
          .select()

        if (updateError) {
          console.error("❌ [API/sessions] Update failed:", updateError)
          return NextResponse.json(
            { error: "Failed to update session", details: updateError.message },
            { status: 500 }
          )
        }

        console.log("✅ [API/sessions] Session updated successfully:", updateData[0]?.id)
        return NextResponse.json({ 
          success: true, 
          session: updateData[0],
          message: "Session updated successfully"
        })
      }

      console.error("❌ [API/sessions] Database error:", error)
      return NextResponse.json(
        { error: "Failed to save session", details: error.message },
        { status: 500 }
      )
    }

    console.log("✅ [API/sessions] Session saved successfully:", data[0]?.id)
    return NextResponse.json({ 
      success: true, 
      session: data[0],
      message: "Session saved successfully"
    })

  } catch (error) {
    console.error("💥 [API/sessions] Unexpected error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  console.log("📋 [API/sessions] Fetching sessions")
  
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Database configuration error" },
        { status: 500 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50) // Limit for performance

    if (error) {
      console.error("❌ [API/sessions] Database error:", error)
      return NextResponse.json(
        { error: "Failed to fetch sessions", details: error.message },
        { status: 500 }
      )
    }

    console.log(`✅ [API/sessions] Found ${data.length} sessions`)
    return NextResponse.json({ sessions: data })

  } catch (error) {
    console.error("💥 [API/sessions] Unexpected error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
} 