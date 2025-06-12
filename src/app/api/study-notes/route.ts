import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  console.log('📋 [API/study-notes] Fetching study notes')
  
  try {
    const { searchParams } = new URL(request.url)
    
    // Extract query parameters
    const search = searchParams.get('search')
    const category = searchParams.get('category')
    const tags = searchParams.get('tags')?.split(',').filter(Boolean)
    const status = searchParams.get('status')
    const sortBy = searchParams.get('sortBy') || 'generated_at'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    
    console.log('🔍 [API/study-notes] Filters:', {
      search,
      category,
      tags,
      status,
      sortBy,
      sortOrder
    })

    // Build the query
    let query = supabase
      .from('study_notes')
      .select(`
        *,
        session:sessions(topic, created_at, session_id)
      `)

    // Apply filters
    if (search) {
      query = query.or(`content.ilike.%${search}%,custom_title.ilike.%${search}%`)
    }
    
    if (category) {
      query = query.eq('category', category)
    }
    
    if (status) {
      query = query.eq('study_status', status)
    }
    
    if (tags && tags.length > 0) {
      query = query.contains('tags', tags)
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' })

    const { data: notes, error } = await query

    if (error) {
      console.error('❌ [API/study-notes] Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch study notes', details: error.message },
        { status: 500 }
      )
    }

    // If no notes exist, return a sample note for demo purposes
    if (!notes || notes.length === 0) {
      const sampleNote = {
        id: 'demo-note-1',
        content: `# Preeclampsia: A Critical Obstetric Emergency

## Definition & Overview
Preeclampsia is a pregnancy-specific hypertensive disorder characterized by new-onset hypertension and proteinuria after 20 weeks of gestation. It affects 3-5% of pregnancies and is a leading cause of maternal and fetal morbidity worldwide.

## Pathophysiology
The condition stems from **placental dysfunction** leading to:
- Inadequate spiral artery remodeling
- Reduced placental perfusion
- Release of anti-angiogenic factors
- Systemic endothelial dysfunction
- Widespread vasoconstriction

## Clinical Presentation
### Maternal Signs & Symptoms
- **Hypertension**: BP ≥140/90 mmHg on two occasions
- **Proteinuria**: ≥300mg in 24-hour urine collection
- **Severe features** may include:
  - Headache, visual disturbances
  - Right upper quadrant pain
  - Pulmonary edema
  - Thrombocytopenia

### Fetal Complications
- Intrauterine growth restriction (IUGR)
- Oligohydramnios
- Placental abruption
- Preterm delivery

## Management Approach
### Antihypertensive Therapy
- **First-line**: Labetalol, Nifedipine, Methyldopa
- **Target BP**: <160/110 mmHg (avoid over-treatment)
- **Severe hypertension**: Immediate treatment required

### Seizure Prophylaxis
- **Magnesium sulfate**: Gold standard for eclampsia prevention
- Loading dose: 4-6g IV over 15-20 minutes
- Maintenance: 1-2g/hour continuous infusion
- Monitor for toxicity (reflexes, respiratory rate)

### Delivery Planning
- **Definitive treatment**: Delivery of placenta
- **Timing depends on**:
  - Gestational age
  - Severity of disease
  - Maternal/fetal status
- **Corticosteroids**: For fetal lung maturity if <34 weeks

## Key Learning Points
1. **Early recognition** is crucial for optimal outcomes
2. **Magnesium sulfate** prevents seizures, not just treats them
3. **Delivery timing** requires careful risk-benefit analysis
4. **Postpartum monitoring** essential - can develop up to 6 weeks after delivery
5. **Future pregnancy counseling** - increased recurrence risk

## Clinical Pearls
- Preeclampsia can present without proteinuria (new 2013 criteria)
- HELLP syndrome is a severe variant with hemolysis, elevated liver enzymes, low platelets
- Aspirin prophylaxis recommended for high-risk patients
- Blood pressure may initially improve then worsen postpartum

*This comprehensive overview covers the essential aspects of preeclampsia management that every medical student should master.*`,
        custom_title: 'Preeclampsia: Complete Clinical Guide',
        generated_at: new Date().toISOString(),
        last_edited: new Date().toISOString(),
        category: 'Obstetrics & Gynecology',
        tags: ['preeclampsia', 'hypertension', 'pregnancy', 'emergency', 'magnesium-sulfate'],
        study_status: 'to_review',
        session: {
          topic: 'Preeclampsia Management',
          created_at: new Date().toISOString(),
          session_id: 'demo-session-1'
        }
      }

      console.log('📝 [API/study-notes] Returning sample note for demo')
      return NextResponse.json({
        notes: [sampleNote],
        total: 1,
        message: 'Sample note provided for demonstration'
      })
    }

    console.log(`✅ [API/study-notes] Found ${notes.length} study notes`)
    
    return NextResponse.json({
      notes,
      total: notes.length
    })

  } catch (error) {
    console.error('💥 [API/study-notes] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  console.log("✏️ [API/study-notes] Updating study note")
  
  try {
    if (!supabase) {
      return NextResponse.json(
        { error: "Database configuration error" },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { id, content, custom_title, tags, category, study_status } = body

    if (!id || !content) {
      return NextResponse.json(
        { error: "Missing required fields: id and content" },
        { status: 400 }
      )
    }

    // Get current note to increment edit count
    const { data: currentNote, error: fetchError } = await supabase
      .from('study_notes')
      .select('edit_count')
      .eq('id', id)
      .single()

    if (fetchError) {
      console.error("❌ [API/study-notes] Error fetching current note:", fetchError)
      return NextResponse.json(
        { error: "Note not found" },
        { status: 404 }
      )
    }

    // Update the note
    const updateData: any = {
      content,
      custom_title,
      last_edited: new Date().toISOString(),
      is_edited: true,
      edit_count: (currentNote.edit_count || 0) + 1
    }

    // Add organization fields if provided
    if (tags !== undefined) updateData.tags = tags
    if (category !== undefined) updateData.category = category
    if (study_status !== undefined) updateData.study_status = study_status

    const { data, error } = await supabase
      .from('study_notes')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error("❌ [API/study-notes] Update error:", error)
      return NextResponse.json(
        { error: "Failed to update note", details: error.message },
        { status: 500 }
      )
    }

    console.log(`✅ [API/study-notes] Note updated successfully: ${id}`)
    return NextResponse.json({ note: data })

  } catch (error) {
    console.error("💥 [API/study-notes] Unexpected error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
} 