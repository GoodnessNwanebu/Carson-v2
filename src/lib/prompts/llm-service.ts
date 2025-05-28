import { CarsonSessionContext } from "./carsonTypes"
import { generatePrompt } from "./promptEngine"

// TODO: Move to environment variables
const API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY
const API_URL = "https://api.openai.com/v1/chat/completions"

interface LLMResponse {
  content: string
  subtopics?: Array<{
    id: string
    title: string
    description: string
  }>
}

export async function callLLM(session: CarsonSessionContext): Promise<LLMResponse> {
  console.log("[callLLM] Called with session:", session);
  // Call the Next.js API route instead of OpenAI directly
  try {
    const response = await fetch("/api/llm", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(session),
    })

    if (!response.ok) {
      throw new Error(`API call failed: ${response.statusText}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error("[callLLM] Error calling /api/llm:", error)
    throw error
  }
} 