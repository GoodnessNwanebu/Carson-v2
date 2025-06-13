import { CarsonSessionContext } from './carsonTypes';

interface SubtopicResponse {
  id: string;
  title: string;
  description?: string;
}

// Mock LLM service - replace with actual LLM integration
export async function callLLM(context: CarsonSessionContext): Promise<{ content: string; subtopics?: SubtopicResponse[]; cleanTopic?: string }> {
  console.log("[callLLM] Called with session:", context);
  // Call the Next.js API route instead of OpenAI directly
  try {
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    // Best fix: Use relative URL - works in all environments
    // Since this is a Next.js app, the API routes are served from the same domain
    const apiUrl = '/api/llm';
    
    console.log("[callLLM] Using API URL:", apiUrl);
    
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(context),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

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