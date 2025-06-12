import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function GET(req: NextRequest) {
  console.log("🔄 [API/sessions/load] Loading individual session")
  
  try {
    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get('sessionId')
    
    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing sessionId parameter" },
        { status: 400 }
      )
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Database configuration error" },
        { status: 500 }
      )
    }

    // Load session by session_id
    const { data: session, error } = await supabaseAdmin
      .from('sessions')
      .select('*')
      .eq('session_id', sessionId)
      .single()

    if (error) {
      console.error("❌ [API/sessions/load] Database error:", error)
      return NextResponse.json(
        { error: "Session not found", details: error.message },
        { status: 404 }
      )
    }

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      )
    }

    console.log(`✅ [API/sessions/load] Session loaded: ${sessionId}`)
    
    return NextResponse.json({
      session
    })

  } catch (error) {
    console.error("💥 [API/sessions/load] Unexpected error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
} 