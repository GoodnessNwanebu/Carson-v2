import { CarsonSessionContext } from './carsonTypes';

interface SubtopicResponse {
  id: string;
  title: string;
  description?: string;
}

// Mock LLM service - replace with actual LLM integration
export async function callLLM(context: CarsonSessionContext): Promise<{ content: string; subtopics?: SubtopicResponse[] }> {
  console.log("[callLLM] Called with session:", context);
  // Call the Next.js API route instead of OpenAI directly
  try {
    const response = await fetch("/api/llm", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(context),
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