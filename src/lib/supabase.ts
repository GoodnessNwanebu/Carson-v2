import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Client for frontend operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Admin client for server-side operations (API routes)
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
export const supabaseAdmin = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null

// Types for our database
export interface DatabaseSession {
  id: string
  session_id: string
  topic: string
  session_data: any
  created_at: string
  updated_at: string
  completed: boolean
}

export interface DatabaseStudyNote {
  id: string
  session_id: string
  content: string
  student_content?: string
  generated_at: string
  last_edited?: string
  note_version: string
  custom_title?: string
  is_edited: boolean
  edit_count: number
  tags?: string[]
  category?: string
  priority?: 'low' | 'medium' | 'high'
  study_status?: 'to_review' | 'reviewing' | 'mastered'
} 