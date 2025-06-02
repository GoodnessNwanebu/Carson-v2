import { NextRequest, NextResponse } from "next/server"
import { generatePrompt } from "@/lib/prompts/promptEngine"

const API_KEY = process.env.OPENAI_API_KEY
console.log("🔑 [API/llm] API_KEY loaded:", API_KEY ? `${API_KEY.substring(0, 20)}...` : "undefined")
const API_URL = "https://api.openai.com/v1/chat/completions"

export async function POST(req: NextRequest) {
  console.log("🚀 [API/llm] POST endpoint hit")
  
  try {
    console.log("📥 [API/llm] Parsing request body...")
    const session = await req.json()
    console.log("✅ [API/llm] Session parsed successfully:", {
      sessionId: session.sessionId,
      topic: session.topic?.substring(0, 50) + (session.topic?.length > 50 ? '...' : ''),
      subtopicsCount: session.subtopics?.length || 0,
      historyLength: session.history?.length || 0
    })
    
    console.log("🧠 [API/llm] Generating prompt...")
    const prompt = generatePrompt(session)
    console.log("✅ [API/llm] Prompt generated, length:", prompt.length)

    console.log("🌐 [API/llm] Making OpenAI API call...")
    console.log("🌐 [API/llm] Request details:", {
      url: API_URL,
      model: "gpt-4o-mini",
      hasApiKey: !!API_KEY,
      promptLength: prompt.length
    })

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are Carson, a calm, warm, and non-judgmental medical learning companion. You help students understand complex medical topics through Socratic questioning and clear explanations. Always maintain an encouraging, supportive tone - never shame, criticize, or make students feel inadequate. Create a safe learning space where struggling is normal and celebrated as part of growth. Be patient, understanding, and genuinely enthusiastic about their learning journey.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    })

    console.log("📡 [API/llm] OpenAI response received:", {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    })

    if (!response.ok) {
      console.error("❌ [API/llm] OpenAI API call failed:", response.status, response.statusText)
      const errorText = await response.text()
      console.error("❌ [API/llm] Error details:", errorText)
      return NextResponse.json({ error: "OpenAI API call failed", details: errorText }, { status: 500 })
    }

    console.log("🔄 [API/llm] Parsing OpenAI response...")
    const data = await response.json()
    console.log("✅ [API/llm] OpenAI API response parsed:", {
      id: data.id,
      model: data.model,
      choices: data.choices?.length || 0,
      usage: data.usage
    })
    
    const content = data.choices[0].message.content
    console.log("📝 [API/llm] Content extracted, length:", content?.length || 0)

    // Try to parse as JSON for subtopics (first message)
    if (!session.subtopics || session.subtopics.length === 0) {
      console.log("🔍 [API/llm] Attempting to parse as subtopics JSON...")
      try {
        // Extract JSON from markdown code blocks
        let cleaned = content;
        
        // Remove markdown code blocks with optional language identifier
        cleaned = cleaned.replace(/```(?:json)?\s*/gi, '');
        cleaned = cleaned.replace(/```\s*/g, '');
        
        // Find the JSON object (starts with { and ends with })
        const jsonStart = cleaned.indexOf('{');
        const jsonEnd = cleaned.lastIndexOf('}');
        
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
        }
        
        cleaned = cleaned.trim();
        
        console.log("🧹 [API/llm] Cleaned JSON preview:", cleaned.substring(0, 200) + "...")
        const parsed = JSON.parse(cleaned);
        console.log("✅ [API/llm] Successfully parsed subtopics JSON:", {
          hasIntroduction: !!parsed.introduction,
          subtopicsCount: parsed.subtopics?.length || 0,
          cleanTopic: parsed.cleanTopic
        })
        
        // Handle cases where introduction might be an object with content property
        let introductionContent = parsed.introduction;
        if (typeof introductionContent === 'object' && introductionContent !== null) {
          console.log("🔄 [API/llm] Introduction is object, extracting content...")
          if (introductionContent.content) {
            introductionContent = introductionContent.content;
          } else if (introductionContent.text) {
            introductionContent = introductionContent.text;
          } else {
            // If it's an object but doesn't have expected properties, convert to string
            introductionContent = JSON.stringify(introductionContent);
          }
        }
        
        console.log("✅ [API/llm] Returning subtopics response")
        return NextResponse.json({ content: introductionContent, subtopics: parsed.subtopics, cleanTopic: parsed.cleanTopic });
      } catch (e) {
        console.error("❌ [API/llm] Failed to parse LLM content as JSON:", e)
        console.error("❌ [API/llm] Original content:", content)
        // Fallback: return the content as-is
        console.log("🔄 [API/llm] Falling back to raw content")
        return NextResponse.json({ content });
      }
    }

    console.log("✅ [API/llm] Returning regular content response")
    return NextResponse.json({ content })
  } catch (error) {
    console.error("💥 [API/llm] Unhandled error:", error)
    console.error("💥 [API/llm] Error stack:", error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json({ 
      error: "Internal server error", 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 })
  }
} 