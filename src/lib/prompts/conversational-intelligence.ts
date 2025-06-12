// conversational-intelligence.ts
// Handles bidirectional conversation where students can ask clarifying questions

import { CarsonSessionContext } from './carsonTypes';

export interface ConversationalIntent {
  type: 'clarification' | 'definition' | 'mechanism' | 'timeframe' | 'comparison' | 'example' | 'assessment_response' | 'off_topic' | 'uncertain_answer';
  confidence: number; // 0-1
  extractedQuery?: string; // The actual question they're asking
  requiresContextualAnswer: boolean; // Needs session context to answer properly
  shouldReturnToFlow: boolean; // Should we return to the main learning flow after answering
  interruptedQuestion?: string; // Carson's question that was interrupted
  shouldResumeQuestion: boolean; // Whether to re-ask Carson's original question
}

export interface ConversationalResponse {
  content: string;
  shouldContinueAssessment: boolean; // Whether to continue with normal assessment flow
  contextualHints?: string[]; // Additional context to help with the answer
  resumeWithQuestion?: string; // Carson's original question to re-ask after answering
}

/**
 * Two-tier intent detection system for speed and accuracy
 */
export function detectConversationalIntent(
  userMessage: string, 
  context: CarsonSessionContext
): ConversationalIntent {
  
  const message = userMessage.toLowerCase().trim();
  
  // Detect if Carson was asking a question that got interrupted
  const interruptedQuestion = getInterruptedQuestion(context);
  const shouldResumeQuestion = !!interruptedQuestion;
  
  // Check for uncertain/shaky answers first (highest priority)
  if (isUncertainAnswer(userMessage, context)) {
    return {
      type: 'uncertain_answer',
      confidence: 0.9,
      extractedQuery: userMessage,
      requiresContextualAnswer: true,
      shouldReturnToFlow: false, // Continue assessment flow but with encouragement
      interruptedQuestion,
      shouldResumeQuestion
    };
  }
  
  // Tier 1: Lightning-fast pattern matching (~1ms)
  const quickPatterns = {
    definition: /what (does|is) (\w+) (mean|stand for)|what('s| is) (\w+)\?|define (\w+)/i,
    timeframe: /how long (does|takes?|until)|when (does|will)|how (soon|quickly)/i,
    mechanism: /how does .+ work|what('s| is) the mechanism|how is .+ (caused|formed|made)/i,
    comparison: /what('s| is) the difference between|compare .+ (to|with|and)|versus|vs\./i,
    clarification: /can you (explain|clarify|tell me)|i don't understand|what do you mean|could you elaborate/i,
    example: /can you give (me )?(an )?example|for example|such as|like what/i
  };

  // Check each pattern
  for (const [type, pattern] of Object.entries(quickPatterns)) {
    if (pattern.test(message)) {
      return {
        type: type as any,
        confidence: 0.9,
        extractedQuery: extractQuestionFromPattern(userMessage, type),
        requiresContextualAnswer: needsSessionContext(type, context),
        shouldReturnToFlow: true,
        interruptedQuestion,
        shouldResumeQuestion
      };
    }
  }

  // Check if this looks like a medical assessment response
  if (looksLikeMedicalResponse(message, context)) {
    return {
      type: 'assessment_response',
      confidence: 0.95,
      requiresContextualAnswer: false,
      shouldReturnToFlow: false, // Continue normal assessment flow
      shouldResumeQuestion: false
    };
  }

  // Check if completely off-topic
  if (isOffTopic(message, context)) {
    return {
      type: 'off_topic',
      confidence: 0.8,
      requiresContextualAnswer: false,
      shouldReturnToFlow: true,
      interruptedQuestion,
      shouldResumeQuestion
    };
  }

  // Default: treat as assessment response
  return {
    type: 'assessment_response',
    confidence: 0.7,
    requiresContextualAnswer: false,
    shouldReturnToFlow: false,
    shouldResumeQuestion: false
  };
}

/**
 * Generate contextual answer for conversational questions
 */
export async function generateConversationalResponse(
  intent: ConversationalIntent,
  userMessage: string,
  context: CarsonSessionContext
): Promise<ConversationalResponse> {
  
  const currentSubtopic = context.subtopics[context.currentSubtopicIndex];
  const topic = context.topic;
  
  switch (intent.type) {
    case 'definition':
      return await handleDefinitionRequest(intent, userMessage, topic, currentSubtopic?.title);
      
    case 'mechanism':
      return await handleMechanismRequest(intent, userMessage, topic, currentSubtopic?.title);
      
    case 'timeframe':
      return await handleTimeframeRequest(intent, userMessage, topic, currentSubtopic?.title);
      
    case 'comparison':
      return await handleComparisonRequest(intent, userMessage, topic, currentSubtopic?.title);
      
    case 'clarification':
      return await handleClarificationRequest(intent, userMessage, context);
      
    case 'example':
      return await handleExampleRequest(intent, userMessage, topic, currentSubtopic?.title);
      
    case 'off_topic':
      return handleOffTopicRequest(userMessage, topic);
      
    case 'uncertain_answer':
      return await handleUncertainAnswer(intent, userMessage, context);
      
    default:
      return {
        content: "I want to make sure I understand your question correctly. Could you rephrase that?",
        shouldContinueAssessment: false
      };
  }
}

/**
 * Detect if Carson was asking a question that got interrupted by student's question
 */
function getInterruptedQuestion(context: CarsonSessionContext): string | undefined {
  // Look for Carson's last message that ended with a question
  const carsonMessages = context.history
    .filter(msg => msg.role === 'assistant')
    .reverse(); // Most recent first
  
  // Find the most recent Carson question
  for (const message of carsonMessages) {
    if (message.content.includes('?')) {
      // Better question extraction - handle multiple sentences properly
      const content = message.content;
      
      // Split by sentence endings but preserve the question marks
      const sentences = content.split(/(?<=[.!])\s+/);
      
      // Find the sentence with a question mark
      for (const sentence of sentences) {
        if (sentence.includes('?')) {
          // Clean up the question - remove extra whitespace and formatting
          const cleanQuestion = sentence
            .replace(/^\s*[-*•]\s*/, '') // Remove bullet points
            .replace(/^\d+\.\s*/, '') // Remove numbered lists
            .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold formatting
            .replace(/\n+/g, ' ') // Replace newlines with spaces
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
          
          if (cleanQuestion.length > 10) { // Ensure it's a substantial question
            return cleanQuestion;
          }
        }
      }
      
      // Fallback: if no clear sentence found, look for question patterns
      const questionMatch = content.match(/[A-Z][^.!]*\?/);
      if (questionMatch) {
        return questionMatch[0].trim();
      }
    }
  }
  
  return undefined;
}

/**
 * Extract the actual question from pattern matches
 */
function extractQuestionFromPattern(message: string, type: string): string {
  const patterns = {
    definition: /what (does|is) (\w+) (mean|stand for)|what('s| is) (\w+)\?|define (\w+)/i,
    timeframe: /how long .+|when .+|how (soon|quickly) .+/i,
    mechanism: /how does .+ work|what('s| is) the mechanism .+|how is .+ (caused|formed|made)/i,
    comparison: /what('s| is) the difference between .+|compare .+ (to|with|and) .+/i,
    clarification: /can you (explain|clarify|tell me) .+|what do you mean .+/i,
    example: /can you give (me )?(an )?example .+|for example .+/i
  };

  const pattern = patterns[type as keyof typeof patterns];
  if (pattern) {
    const match = message.match(pattern);
    return match ? match[0] : message;
  }
  return message;
}

/**
 * Determine if question needs session context to answer properly
 */
function needsSessionContext(type: string, context: CarsonSessionContext): boolean {
  // These types benefit from knowing what we've been discussing
  const contextualTypes = ['clarification', 'mechanism', 'comparison'];
  return contextualTypes.includes(type) && context.history.length > 2;
}

/**
 * Check if message looks like a medical assessment response
 */
function looksLikeMedicalResponse(message: string, context: CarsonSessionContext): boolean {
  // Get Carson's last question
  const lastCarsonMessage = context.history
    .filter(msg => msg.role === 'assistant')
    .slice(-1)[0]?.content || '';

  // If Carson asked a question, and student's response doesn't contain question words
  const questionWords = ['what', 'how', 'when', 'where', 'why', 'which', 'who', '?'];
  const hasQuestionWords = questionWords.some(word => message.includes(word));
  
  // Medical terminology suggests they're trying to answer
  const medicalTerms = ['patient', 'diagnosis', 'treatment', 'symptom', 'disease', 'condition', 'therapy', 'medication', 'clinical'];
  const hasMedicalTerms = medicalTerms.some(term => message.includes(term));
  
  // If Carson asked a question and student response has medical terms but no question words
  return lastCarsonMessage.includes('?') && hasMedicalTerms && !hasQuestionWords;
}

/**
 * Check if message is completely off-topic
 */
function isOffTopic(message: string, context: CarsonSessionContext): boolean {
  const offTopicPatterns = [
    /weather|sports|politics|food|music|movies/i,
    /how are you|what's up|hello|hi there/i,
    /can you help me with|homework|assignment/i
  ];
  
  return offTopicPatterns.some(pattern => pattern.test(message));
}

/**
 * Handle definition requests with medical context
 */
async function handleDefinitionRequest(
  intent: ConversationalIntent,
  message: string,
  topic: string,
  subtopic?: string
): Promise<ConversationalResponse> {
  
  const definition = generateMedicalDefinition(intent.extractedQuery || message, topic, subtopic);
  
  // Add natural transition back to original question if there was one
  const resumeText = intent.shouldResumeQuestion && intent.interruptedQuestion 
    ? `\n\nNow, back to what we were discussing: ${intent.interruptedQuestion}`
    : '';
  
  return {
    content: definition + resumeText,
    shouldContinueAssessment: !intent.shouldResumeQuestion, // If resuming, don't continue assessment yet
    contextualHints: [
      "Provide clear, contextual definition",
      "Connect to current topic being studied",
      "Use appropriate medical terminology"
    ],
    resumeWithQuestion: intent.interruptedQuestion
  };
}

/**
 * Handle mechanism questions
 */
async function handleMechanismRequest(
  intent: ConversationalIntent,
  message: string,
  topic: string,
  subtopic?: string
): Promise<ConversationalResponse> {
  
  const explanation = generateMechanismExplanation(intent.extractedQuery || message, topic, subtopic);
  
  const resumeText = intent.shouldResumeQuestion && intent.interruptedQuestion 
    ? `\n\nNow, let's get back to: ${intent.interruptedQuestion}`
    : '';
  
  return {
    content: explanation + resumeText,
    shouldContinueAssessment: !intent.shouldResumeQuestion,
    resumeWithQuestion: intent.interruptedQuestion
  };
}

/**
 * Handle timeframe questions
 */
async function handleTimeframeRequest(
  intent: ConversationalIntent,
  message: string,
  topic: string,
  subtopic?: string
): Promise<ConversationalResponse> {
  
  const answer = generateTimeframeAnswer(intent.extractedQuery || message, topic, subtopic);
  
  const resumeText = intent.shouldResumeQuestion && intent.interruptedQuestion 
    ? `\n\nAlright, back to our discussion: ${intent.interruptedQuestion}`
    : '';
  
  return {
    content: answer + resumeText,
    shouldContinueAssessment: !intent.shouldResumeQuestion,
    resumeWithQuestion: intent.interruptedQuestion
  };
}

/**
 * Handle comparison requests
 */
async function handleComparisonRequest(
  intent: ConversationalIntent,
  message: string,
  topic: string,
  subtopic?: string
): Promise<ConversationalResponse> {
  
  const comparison = generateComparisonAnswer(intent.extractedQuery || message, topic, subtopic);
  
  const resumeText = intent.shouldResumeQuestion && intent.interruptedQuestion 
    ? `\n\nOkay, now back to what I was asking: ${intent.interruptedQuestion}`
    : '';
  
  return {
    content: comparison + resumeText,
    shouldContinueAssessment: !intent.shouldResumeQuestion,
    resumeWithQuestion: intent.interruptedQuestion
  };
}

/**
 * Handle clarification requests with full context
 */
async function handleClarificationRequest(
  intent: ConversationalIntent,
  message: string,
  context: CarsonSessionContext
): Promise<ConversationalResponse> {
  
  const lastCarsonMessage = context.history
    .filter(msg => msg.role === 'assistant')
    .slice(-1)[0]?.content || '';
  
  const clarification = generateClarificationAnswer(
    intent.extractedQuery || message, 
    lastCarsonMessage, 
    context.topic, 
    context.subtopics[context.currentSubtopicIndex]?.title
  );
  
  const resumeText = intent.shouldResumeQuestion && intent.interruptedQuestion 
    ? `\n\nSo, going back to my question: ${intent.interruptedQuestion}`
    : '';
  
  return {
    content: clarification + resumeText,
    shouldContinueAssessment: !intent.shouldResumeQuestion,
    resumeWithQuestion: intent.interruptedQuestion
  };
}

/**
 * Handle example requests
 */
async function handleExampleRequest(
  intent: ConversationalIntent,
  message: string,
  topic: string,
  subtopic?: string
): Promise<ConversationalResponse> {
  
  const example = generateClinicalExample(intent.extractedQuery || message, topic, subtopic);
  
  const resumeText = intent.shouldResumeQuestion && intent.interruptedQuestion 
    ? `\n\nNow, let's return to: ${intent.interruptedQuestion}`
    : '';
  
  return {
    content: example + resumeText,
    shouldContinueAssessment: !intent.shouldResumeQuestion,
    resumeWithQuestion: intent.interruptedQuestion
  };
}

/**
 * Handle off-topic requests
 */
function handleOffTopicRequest(message: string, currentTopic: string): ConversationalResponse {
  return {
    content: `I appreciate the question, but let's keep our focus on ${currentTopic} for now. We can dive deep into this topic and make sure you really understand it. What would you like to know about ${currentTopic}?`,
    shouldContinueAssessment: false
  };
}

/**
 * Generate medical definitions with context
 */
function generateMedicalDefinition(term: string, topic: string, subtopic?: string): string {
  // This would ideally call a medical knowledge base or LLM
  // For now, return a contextual template
  return `This is a key term in ${topic}${subtopic ? ` (specifically in ${subtopic})` : ''}. [Medical definition would be generated here based on the specific term and context]`;
}

/**
 * Generate mechanism explanations
 */
function generateMechanismExplanation(question: string, topic: string, subtopic?: string): string {
  return `In ${topic}, this mechanism works by... [Detailed mechanism explanation would be generated here]`;
}

/**
 * Generate timeframe answers
 */
function generateTimeframeAnswer(question: string, topic: string, subtopic?: string): string {
  return `For ${topic}, the typical timeframe is... [Specific timing information would be generated here]`;
}

/**
 * Generate comparison answers
 */
function generateComparisonAnswer(question: string, topic: string, subtopic?: string): string {
  return `When comparing these in the context of ${topic}... [Detailed comparison would be generated here]`;
}

/**
 * Generate clarification answers
 */
function generateClarificationAnswer(question: string, lastCarsonMessage: string, topic: string, subtopic?: string): string {
  return `What I meant was... [Clarification based on the specific context would be generated here]`;
}

/**
 * Generate clinical examples
 */
function generateClinicalExample(request: string, topic: string, subtopic?: string): string {
  return `Here's a clinical example for ${topic}: [Relevant clinical scenario would be generated here]`;
}

/**
 * Generate encouraging response for uncertain answers
 */
function generateEncouragingResponse(studentAnswer: string, lastQuestion: string, topic: string, subtopic?: string): string {
  // Remove question mark and clean up the answer
  const cleanAnswer = studentAnswer.toLowerCase().replace(/[?!.]/g, '').trim();
  
  // Context-aware encouragement based on topic and answer
  if (topic.toLowerCase().includes('labour') || topic.toLowerCase().includes('labor')) {
    if (cleanAnswer.includes('pain')) {
      return `You're absolutely on the right track! Pain is indeed one of the most challenging aspects for patients during the transition phase. The intense contractions and pressure can be overwhelming. What specifically about the pain do you think makes it so challenging for patients to cope with?`;
    }
  }
  
  if (topic.toLowerCase().includes('preeclampsia')) {
    if (cleanAnswer.includes('pressure') || cleanAnswer.includes('blood')) {
      return `Good thinking! You're picking up on the key cardiovascular aspects. The blood pressure changes are definitely central to preeclampsia. Can you tell me more about what you think happens with blood pressure in this condition?`;
    }
  }
  
  // Generic encouraging responses for uncertain answers
  const encouragingStarters = [
    "You're on the right track!",
    "That's a good start!",
    "I can see you're thinking about this correctly!",
    "You're definitely onto something important!",
    "That's exactly the kind of thinking I want to see!"
  ];
  
  const randomStarter = encouragingStarters[Math.floor(Math.random() * encouragingStarters.length)];
  
  return `${randomStarter} ${cleanAnswer ? `"${cleanAnswer}"` : 'Your instinct'} is pointing in the right direction. Let me help you build on that thought - what makes you think that's the most challenging aspect? What else might patients experience during this time?`;
}

/**
 * Check if message is an uncertain answer
 */
function isUncertainAnswer(message: string, context: CarsonSessionContext): boolean {
  const trimmed = message.trim();
  
  // Get Carson's last message to see if it was a question
  const lastCarsonMessage = context.history
    .filter(msg => msg.role === 'assistant')
    .slice(-1)[0]?.content || '';
  
  // Only consider it uncertain if Carson asked a question
  if (!lastCarsonMessage.includes('?')) {
    return false;
  }
  
  // Patterns that indicate uncertainty
  const uncertaintyPatterns = [
    // Single word/phrase with question mark (like "the pain?")
    /^[a-zA-Z\s]{1,20}\?$/,
    
    // Hesitant language
    /^(maybe|perhaps|possibly|i think|i guess|probably|might be|could be)/i,
    
    // Very short responses with uncertainty markers
    /^(um|uh|well|hmm|i'm not sure|not sure|dunno|don't know)\b/i,
    
    // Question mark at end of short statement
    /^.{1,30}\?$/,
    
    // Tentative medical terms
    /^(the )?\w+\?$/i
  ];
  
  // Check if message matches uncertainty patterns
  const matchesPattern = uncertaintyPatterns.some(pattern => pattern.test(trimmed));
  
  // Additional context clues
  const isVeryShort = trimmed.length < 25;
  const endsWithQuestionMark = trimmed.endsWith('?');
  const hasUncertainWords = /\b(maybe|perhaps|possibly|i think|i guess|probably|might|could|unsure|not sure)\b/i.test(trimmed);
  
  // Combine signals
  return matchesPattern || (isVeryShort && endsWithQuestionMark) || hasUncertainWords;
}

/**
 * Handle uncertain answers with encouragement
 */
async function handleUncertainAnswer(
  intent: ConversationalIntent,
  message: string,
  context: CarsonSessionContext
): Promise<ConversationalResponse> {
  
  const currentSubtopic = context.subtopics[context.currentSubtopicIndex];
  const topic = context.topic;
  const studentAnswer = message.replace('?', '').trim();
  
  // Get the last question Carson asked
  const lastCarsonMessage = context.history
    .filter(msg => msg.role === 'assistant')
    .slice(-1)[0]?.content || '';
  
  return {
    content: generateEncouragingResponse(studentAnswer, lastCarsonMessage, topic, currentSubtopic?.title),
    shouldContinueAssessment: true, // Continue with assessment but with encouragement
    contextualHints: [
      "Student seems uncertain - provide encouragement",
      "Validate their thinking and guide them forward",
      "Build confidence while correcting if needed"
    ],
    resumeWithQuestion: intent.interruptedQuestion
  };
} 