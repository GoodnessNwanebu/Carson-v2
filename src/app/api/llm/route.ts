import { NextRequest, NextResponse } from "next/server"
import { generatePrompt } from "@/lib/prompts/promptEngine"

const API_KEY = process.env.OPENAI_API_KEY
console.log("API_KEY", API_KEY)
const API_URL = "https://api.openai.com/v1/chat/completions"

export async function POST(req: NextRequest) {
  try {
    const session = await req.json()
    console.log("i ran here")
    console.log("[API/llm] Received session:", session)
    const prompt = generatePrompt(session)

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4-turbo-preview",
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

    if (!response.ok) {
      console.error("[API/llm] OpenAI APIs call failed:", response.status, response.statusText)
      return NextResponse.json({ error: "OpenAI API call failed" }, { status: 500 })
    }

    const data = await response.json()
    console.log("[API/llm] OpenAI API response:", data)
    const content = data.choices[0].message.content

    // Try to parse as JSON for subtopics (first message)
    if (!session.subtopics || session.subtopics.length === 0) {
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
        
        console.log("[API/llm] Attempting to parse cleaned JSON:", cleaned.substring(0, 200) + "...");
        const parsed = JSON.parse(cleaned);
        console.log("[API/llm] Successfully parsed LLM content:", parsed);
        
        // Handle cases where introduction might be an object with content property
        let introductionContent = parsed.introduction;
        if (typeof introductionContent === 'object' && introductionContent !== null) {
          if (introductionContent.content) {
            introductionContent = introductionContent.content;
          } else if (introductionContent.text) {
            introductionContent = introductionContent.text;
          } else {
            // If it's an object but doesn't have expected properties, convert to string
            introductionContent = JSON.stringify(introductionContent);
          }
        }
        
        return NextResponse.json({ content: introductionContent, subtopics: parsed.subtopics, cleanTopic: parsed.cleanTopic });
      } catch (e) {
        console.error("[API/llm] Failed to parse LLM content as JSON:", e);
        console.error("[API/llm] Original content:", content);
        // Fallback: return the content as-is
        return NextResponse.json({ content });
      }
    }

    return NextResponse.json({ content })
  } catch (error) {
    console.error("[API/llm] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
} 