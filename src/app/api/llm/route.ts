import { NextRequest, NextResponse } from "next/server"
import { generatePrompt } from "@/lib/prompts/promptEngine"

const API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY
const API_URL = "https://api.openai.com/v1/chat/completions"

export async function POST(req: NextRequest) {
  try {
    const session = await req.json()
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
            content: "You are Carson, a medical learning companion that helps students understand complex medical topics through Socratic questioning and clear explanations.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    })

    if (!response.ok) {
      console.error("[API/llm] OpenAI API call failed:", response.status, response.statusText)
      return NextResponse.json({ error: "OpenAI API call failed" }, { status: 500 })
    }

    const data = await response.json()
    console.log("[API/llm] OpenAI API response:", data)
    const content = data.choices[0].message.content

    // Try to parse as JSON for subtopics (first message)
    if (!session.subtopics || session.subtopics.length === 0) {
      try {
        // Remove triple backticks and optional "json" label
        const cleaned = content
          .replace(/```json\s*/i, '')
          .replace(/```/g, '')
          .trim();
        const parsed = JSON.parse(cleaned);
        console.log("[API/llm] Parsed LLM content:", parsed);
        return NextResponse.json({ content: parsed.introduction, subtopics: parsed.subtopics });
      } catch (e) {
        console.error("[API/llm] Failed to parse LLM content as JSON:", content, e);
        return NextResponse.json({ content });
      }
    }

    return NextResponse.json({ content })
  } catch (error) {
    console.error("[API/llm] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
} 