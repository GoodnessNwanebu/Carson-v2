import { CarsonSessionContext } from './carsonTypes';
import { callLLM } from './llm-service';

/**
 * Carson Assessment Engine - Phase 1 Refactor
 * 
 * NEW ARCHITECTURE (Recommended):
 * - assessUserResponseV2() - Clean separation of concerns
 * - assessMedicalAccuracy() - Focused medical assessment only
 * - determineNextAction() - Pure orchestration logic
 * 
 * USAGE:
 * Replace: const result = await assessUserResponse(userResponse, context)
 * With:    const result = await assessUserResponseV2(userResponse, context)
 * 
 * BENEFITS:
 * - Faster (focused LLM calls)
 * - More reliable (separate concerns)
 * - Easier to debug (clear responsibilities)
 * - Better handling of "confidently wrong" students
 */

// Assessment types
export type AnswerQuality = 'excellent' | 'good' | 'partial' | 'incorrect' | 'confused';
export type NextAction = 'continue_conversation' | 'give_cue' | 'explain' | 'check_understanding' | 'complete_subtopic' | 'handle_interaction' | 'provide_support' | 'gentle_correction' | 'explain_gaps';

// **NEW**: Simple Triaging Model (Session-Constrained)
export interface SubtopicRequirements {
  maxQuestions: number;           // Hard limit to prevent endless loops
  minQuestionsForMastery: number; // Minimum questions before considering mastery
  mustTestApplication: boolean;   // Whether to include application scenario
}

export interface GapAnalysis {
  criticalGaps: string[];         // Must address - fundamental/dangerous misconceptions
  importantGaps: string[];        // Should address - common/clinically relevant
  minorGaps: string[];           // Nice to address - rare/academic details
  strengthAreas: string[];        // Areas student understands well
}

export interface SubtopicStatus {
  hasInitialAssessment: boolean;  // Whether we've done comprehensive gap analysis
  gapAnalysis?: GapAnalysis;      // Results of initial comprehensive assessment
  addressedGaps: string[];        // Gaps we've successfully addressed
  acknowledgedGaps: string[];     // Gaps we've acknowledged but deferred
  questionsUsed: number;          // Questions used so far in this subtopic
  hasTestedApplication: boolean;  // Whether we've tested clinical application
}

export type AssessmentPhase = 'initial_assessment' | 'targeted_remediation' | 'application' | 'gap_acknowledgment' | 'complete';

export interface AssessmentResult {
  answerQuality: AnswerQuality;
  nextAction: NextAction;
  reasoning: string;
  isStruggling?: boolean;
  specificGaps?: string;
  interactionType: InteractionType;
  currentPhase?: AssessmentPhase;
  statusUpdate?: Partial<SubtopicStatus>;
}

// Response type definitions
export type ResponseType = 'question' | 'explanation' | 'cue' | 'feedback' | 'transition';

interface ResponseTemplate {
  pattern: string;
  maxLength: number;
  tone: 'warm' | 'encouraging' | 'explanatory';
}

const responseTemplates: Record<ResponseType, ResponseTemplate> = {
  question: {
    pattern: "{acknowledgment} {context_bridge} {question}",
    maxLength: 120,
    tone: 'warm'
  },
  explanation: {
    pattern: "{supportive_intro} {key_concept}",
    maxLength: 180,
    tone: 'explanatory'
  },
  cue: {
    pattern: "{gentle_guidance} {hint}",
    maxLength: 100,
    tone: 'encouraging'
  },
  feedback: {
    pattern: "{encouragement} {connection}",
    maxLength: 80,
    tone: 'warm'
  },
  transition: {
    pattern: "{celebration} {bridge_to_next}",
    maxLength: 60,
    tone: 'warm'
  }
};

// Warm prompts for questions (no analogies)
const warmPrompts = [
  "Now, tell me about",
  "What about",
  "How would you approach", 
  "What's your thinking on",
  "Help me understand"
];

// Brief acknowledgments that show Carson is listening
const acknowledgments = [
  "Right on.",
  "Got it.",
  "I see where you're going.",
  "Mm-hmm.",
  "Yeah, that tracks."
];

// Context bridges that explain WHY we're asking the next question
const contextBridges = [
  "So now I'm curious about",
  "That brings up",
  "Which makes me think about", 
  "Speaking of that,",
  "That reminds me -"
];

// Gentle guidance phrases for cues
const gentleGuidance = [
  "Think about this:",
  "Here's something to consider:",
  "What about this angle:",
  "Consider this:",
  "Here's a thought:"
];

// Supportive introductions for explanations
const supportiveIntros = [
  "Okay, so here's what's happening:",
  "Right, so the deal is:",
  "Here's the thing:",
  "So basically:",
  "The way I think about it:"
];

// Encouraging phrases for feedback with connection
const encouragementsWithConnection = [
  "Exactly - you get",
  "Right, you're seeing", 
  "Yeah, you've picked up on",
  "Bingo - you understand",
  "Exactly - you're connecting"
];

// Celebrations with bridges to next topic
const celebrationsWithBridge = [
  "Solid. Now let's talk about",
  "Perfect. Moving to", 
  "Good stuff. Next up:",
  "Nice. Let's tackle",
  "Alright, now for"
];

// Brief encouraging phrases for feedback
const encouragements = [
  "Exactly.",
  "Right.",
  "Yep.",
  "That's it.",
  "Correct."
];

// Brief celebration phrases for transitions
const celebrations = [
  "Good. Next topic.",
  "Solid. Moving on.", 
  "Right. Next.",
  "Perfect. Continuing.",
  "Yep. Next up."
];

// Concise medical analogies for cues/explanations only
const medicalAnalogies = {
  circulation: "Think highway traffic flow -",
  placenta: "Like a transfer station -", 
  bleeding: "Picture a leak in pipes -",
  delivery: "Emergency evacuation scenario -",
  compression: "Traffic jam effect -"
};

// Dynamic response patterns based on student confidence and context
const dynamicResponses = {
  // When student is confident and doing well
  confident: {
    acknowledgments: [
      "Right.",
      "Yep.",
      "I see what you mean.",
      "Makes sense.",
      "Good point."
    ],
    challenges: [
      "Okay, now what about this:",
      "Interesting - so what if",
      "That's solid. But consider this:",
      "Right, and how about",
      "Makes sense. Now here's a curveball:"
    ]
  },
  
  // When student is struggling or confused
  struggling: {
    supportive_intros: [
      "No worries.",
      "Totally fine.",
      "This stuff is tricky.",
      "Yeah, this one's tough.",
      "Don't sweat it."
    ],
    explanations: [
      "So basically,",
      "Here's what's going on:",
      "The deal is:",
      "So the way it works is:",
      "Think about it like this:"
    ]
  },
  
  // When student is partially right
  partially_right: {
    acknowledgments: [
      "You're getting there.",
      "Part of that's right.",
      "You've got some of it.",
      "On the right track.",
      "That's part of it."
    ]
  }
};

// **NEW**: Knowledge retention validation
export interface KnowledgeRetentionTest {
  subtopicIndex: number;
  questionType: 'retention' | 'connection' | 'application';
  lastTestedAt?: Date;
}

/**
 * Generate requirements for a subtopic based on its title and topic
 */
export function generateSubtopicRequirements(subtopicTitle: string, topic: string): SubtopicRequirements {
  const titleLower = subtopicTitle.toLowerCase();
  
  let mustTestApplication = true;
  let maxQuestions = 8;
  let minQuestionsForMastery = 3;
  
  // Pathophysiology subtopics - often pure knowledge
  if (titleLower.includes('pathophysio') || titleLower.includes('mechanism') || titleLower.includes('definition')) {
    mustTestApplication = false; // Pure knowledge, not always clinical application
    minQuestionsForMastery = 2; // Can be faster for definitions
    maxQuestions = 6; // Simpler topics need fewer questions
  }
  
  // Clinical subtopics - always test application
  else if (titleLower.includes('management') || titleLower.includes('treatment') || 
           titleLower.includes('diagnos') || titleLower.includes('presentation')) {
    mustTestApplication = true; // Always test clinical reasoning
    maxQuestions = 8; // May need more questions for complex scenarios
  }
  
  return {
    maxQuestions,
    minQuestionsForMastery,
    mustTestApplication
  };
}

/**
 * Initialize subtopic status for a new subtopic
 */
export function initializeSubtopicStatus(): SubtopicStatus {
  return {
    hasInitialAssessment: false,
    addressedGaps: [],
    acknowledgedGaps: [],
    questionsUsed: 0,
    hasTestedApplication: false
  };
}

/**
 * Analyze student's comprehensive response to identify all gaps with priorities
 */
export async function analyzeGaps(
  userResponse: string,
  subtopicTitle: string,
  topic: string
): Promise<GapAnalysis> {
  const assessmentPrompt = `Analyze a student's response about ${subtopicTitle} in ${topic}.

**Student Response**: ${userResponse}

Categorize knowledge gaps by priority:

1. CRITICAL (must address - dangerous/fundamental gaps)
2. IMPORTANT (should address - common clinical gaps)  
3. MINOR (nice to know - rare/academic gaps)
4. STRENGTHS (areas they understand well)

Respond in JSON format:
{
  "criticalGaps": ["specific gap 1", "specific gap 2"],
  "importantGaps": ["specific gap 1", "specific gap 2"],
  "minorGaps": ["specific gap 1", "specific gap 2"],
  "strengthAreas": ["strength 1", "strength 2"]
}

Analysis:`;

  try {
    const response = await callLLM({
      sessionId: 'gap-analysis',
      topic: assessmentPrompt,
      subtopics: [],
      currentSubtopicIndex: 0,
      history: [],
      currentQuestionType: 'follow_up',
      questionsAskedInCurrentSubtopic: 0,
      correctAnswersInCurrentSubtopic: 0,
      currentSubtopicState: 'assessing',
      shouldTransition: false,
      isComplete: false,
    });
    
    // Validate response structure (copy from assessWithLLM pattern)
    if (!response || !response.content || typeof response.content !== 'string') {
      console.error('Gap analysis: Invalid response structure:', response);
      return getGapAnalysisFallback(userResponse);
    }
    
    try {
      // Try to parse as JSON
      const parsed = JSON.parse(response.content);
      
      // Validate the parsed structure
      if (!parsed || typeof parsed !== 'object') {
        console.error('Gap analysis: Parsed content is not an object:', parsed);
        return getGapAnalysisFallback(userResponse);
      }
      
      return {
        criticalGaps: Array.isArray(parsed.criticalGaps) ? parsed.criticalGaps : [],
        importantGaps: Array.isArray(parsed.importantGaps) ? parsed.importantGaps : [],
        minorGaps: Array.isArray(parsed.minorGaps) ? parsed.minorGaps : [],
        strengthAreas: Array.isArray(parsed.strengthAreas) ? parsed.strengthAreas : []
      };
    } catch (parseError) {
      // Fallback to simple text parsing (copy from assessWithLLM pattern)
      const content = response.content.toLowerCase().trim();
      
      // Try to extract information from non-JSON response
      const criticalMatches = content.match(/critical[^:]*:(.*?)(?:important|minor|strength|$)/);
      const importantMatches = content.match(/important[^:]*:(.*?)(?:critical|minor|strength|$)/);
      const strengthMatches = content.match(/strength[^:]*:(.*?)(?:critical|important|minor|$)/);
      
      return {
        criticalGaps: criticalMatches ? [criticalMatches[1].trim()] : [],
        importantGaps: importantMatches ? [importantMatches[1].trim()] : ['Understanding needs clarification'],
        minorGaps: [],
        strengthAreas: strengthMatches ? [strengthMatches[1].trim()] : []
      };
    }
  } catch (error) {
    console.error('Gap analysis failed, using fallback:', error);
    return getGapAnalysisFallback(userResponse);
  }
}

/**
 * Fallback gap analysis when LLM fails (copy from assessWithLLM pattern)
 */
function getGapAnalysisFallback(userResponse: string): GapAnalysis {
  const response = userResponse.toLowerCase().trim();
  const length = response.length;
  
  // Simple heuristics for gap analysis
  if (length < 10) {
    return {
      criticalGaps: ['Insufficient detail provided'],
      importantGaps: ['Need more comprehensive explanation'],
      minorGaps: [],
      strengthAreas: []
    };
  }
  
  // Look for medical terminology
  const medicalTerms = ['pathophysiology', 'mechanism', 'diagnosis', 'treatment', 'patient', 'clinical'];
  const hasMedicalTerms = medicalTerms.some(term => response.includes(term));
  
  if (hasMedicalTerms && length > 50) {
    return {
      criticalGaps: [],
      importantGaps: ['Some areas need deeper exploration'],
      minorGaps: ['Advanced concepts could be expanded'],
      strengthAreas: ['Shows medical vocabulary and basic understanding']
    };
  } else {
    return {
      criticalGaps: ['Fundamental concepts need clarification'],
      importantGaps: ['Basic understanding needs development'],
      minorGaps: [],
      strengthAreas: length > 20 ? ['Attempting to engage with the topic'] : []
    };
  }
}

/**
 * Check if we should test retention of previously mastered subtopics
 */
export function shouldTestRetention(context: CarsonSessionContext): KnowledgeRetentionTest | null {
  const completedSubtopics = context.subtopics
    .map((subtopic, index) => ({ subtopic, index }))
    .filter((item, index) => index < context.currentSubtopicIndex && item.subtopic.correctAnswers >= 2);
  
  if (completedSubtopics.length === 0) return null;
  
  // Test retention every 2-3 subtopics
  const shouldTest = context.currentSubtopicIndex > 0 && 
                    context.currentSubtopicIndex % 3 === 0 && 
                    Math.random() < 0.7; // 70% chance
  
  if (!shouldTest) return null;
  
  // Pick a previously completed subtopic to test
  const randomSubtopic = completedSubtopics[Math.floor(Math.random() * completedSubtopics.length)];
  
  return {
    subtopicIndex: randomSubtopic.index,
    questionType: 'retention',
    lastTestedAt: new Date()
  };
}

/**
 * Generate retention questions that connect previous learning
 */
export function generateRetentionQuestion(
  retentionTest: KnowledgeRetentionTest,
  context: CarsonSessionContext
): string {
  const previousSubtopic = context.subtopics[retentionTest.subtopicIndex];
  const currentSubtopic = context.subtopics[context.currentSubtopicIndex];
  
  const connectionQuestions = [
    `Before we continue with ${currentSubtopic.title}, let's connect this to what we learned about ${previousSubtopic.title}. How do these two areas relate in clinical practice?`,
    `Quick review: We covered ${previousSubtopic.title} earlier. How would that knowledge help you with a patient who also has issues related to ${currentSubtopic.title}?`,
    `Let's make sure this sticks - can you explain how ${previousSubtopic.title} might influence your approach to ${currentSubtopic.title}?`,
    `Building on our earlier discussion of ${previousSubtopic.title}, how would you prioritize that knowledge when dealing with ${currentSubtopic.title}?`
  ];
  
  return connectionQuestions[Math.floor(Math.random() * connectionQuestions.length)];
}

/**
 * Check if the user response indicates confusion or struggling
 */
function isStruggling(userResponse: string): boolean {
  const response = userResponse.toLowerCase().trim();
  
  // Explicit struggling statements
  const directStruggling = [
    /^(i don'?t know|not sure|no idea|unsure|i'?m not sure)/,
    /^(confused|lost|stuck)/,
    /^(help|i need help)/,
    /don'?t understand/,
    /not following/,
    /makes no sense/,
    /too hard/,
    /difficult/
  ];
  
  // Deflection patterns - trying to avoid answering
  const deflectionPatterns = [
    /^(can you give me a hint|hint|clue)/,
    /^(what do you think|what would you say)/,
    /^(i'?m not sure, but|maybe|perhaps)/,
    /^(could it be|is it|might it be)/,
    /^(i think it might|it could be|possibly)/
  ];
  
  // Vague/evasive answers that indicate lack of knowledge
  const vaguePatterns = [
    /^(it'?s related to|something about|has to do with)/,
    /^(the|a|some)\s+\w+$/,  // Very short, generic answers like "the kidney"
    /^(um|uh|well|so)/,      // Filler words indicating uncertainty
    /^(i think|i believe|i guess)/,
  ];
  
  // Question reversals - fishing for answers
  const fishingPatterns = [
    /\?$/,                   // Ends with question mark (answering with a question)
    /^(is it|does it|can it|would it)/,
    /right\?$/,              // "It's prerenal, right?"
    /correct\?$/
  ];
  
  // Very short responses (often indicate confusion)
  const isTooShort = response.length < 8 && !/^(yes|no|yeah|nope)$/.test(response);
  
  return directStruggling.some(pattern => pattern.test(response)) ||
         deflectionPatterns.some(pattern => pattern.test(response)) ||
         vaguePatterns.some(pattern => pattern.test(response)) ||
         fishingPatterns.some(pattern => pattern.test(response)) ||
         isTooShort;
}

/**
 * Check if the user response is a conversational/meta response rather than a medical answer
 */
function isConversationalResponse(userResponse: string, lastCarsonMessage?: string): boolean {
  const response = userResponse.toLowerCase().trim();
  const carsonMessage = lastCarsonMessage?.toLowerCase() || '';
  
  // If Carson just asked if they're ready, treat confirmations as conversational
  const isReadinessQuestion = carsonMessage.includes('ready') || 
                             carsonMessage.includes('shall we') || 
                             carsonMessage.includes('let\'s') ||
                             carsonMessage.includes('begin') ||
                             carsonMessage.includes('start');
  
  // Readiness confirmations - only if Carson asked about readiness
  const readinessPatterns = [
    /^(yes|yeah|yep|sure|okay|ok|alright|ready)/,
    /ready/,
    /(let'?s go|let'?s start|let'?s begin)/,
    /^(i'?m ready|am ready)/
  ];
  
  if (isReadinessQuestion) {
    const isReadinessResponse = readinessPatterns.some(pattern => pattern.test(response));
    if (isReadinessResponse) return true;
  }
  
  // REMOVED "I don't know" from conversational - it should be assessed as struggling!
  
  // Clarification and context requests - these are conversational, not medical answers
  const clarificationPatterns = [
    /^(what|how|when|where|why)\s/,
    /^(can you|could you|please)/,
    /^(sorry|excuse me)/,
    // Context and scope questions
    /in the context of/,
    /about (.*?)\?$/,
    /related to/,
    /specifically/,
    /you mean/,
    /are you asking/,
    /do you want me to/
  ];
  
  // Help requests that aren't struggling
  const isHelpRequest = /^(help|explain|clarify)/.test(response) && !isStruggling(userResponse);
  
  // Very short responses without medical context (but not struggling responses)
  const isVeryShort = response.length < 6 && !isStruggling(userResponse);
  
  return clarificationPatterns.some(pattern => pattern.test(response)) || isHelpRequest || isVeryShort;
}

/**
 * Use LLM to assess the quality of a medical response and identify specific gaps
 */
async function assessWithLLM(
  userResponse: string,
  carsonQuestion: string,
  topic: string,
  subtopic: string
): Promise<{quality: AnswerQuality, specificGaps?: string}> {
  // Quick check for obvious struggling responses
  if (isStruggling(userResponse)) {
    return {quality: 'confused'};
  }

  // Validate inputs
  if (!userResponse?.trim() || userResponse.trim().length < 2) {
    return {quality: 'confused'};
  }

  const assessmentPrompt = `You are a medical education expert evaluating a student's response. Assess the quality of their answer and identify specific gaps.

**Topic**: ${topic}
**Subtopic**: ${subtopic}
**Carson's Question**: ${carsonQuestion}
**Student's Response**: ${userResponse}

Evaluate the response and provide:
1. Overall quality assessment
2. If "partial", what specific important points are missing

For example, if discussing ectopic pregnancy risk factors and they miss PID/STIs, mention that specifically.

Respond in JSON format:
{
  "quality": "excellent|good|partial|incorrect|confused",
  "specificGaps": "What important points are missing (only if partial)"
}

Assessment:`;

  try {
    const response = await callLLM({
      sessionId: 'assessment',
      topic: assessmentPrompt,
      subtopics: [],
      currentSubtopicIndex: 0,
      history: [],
      currentQuestionType: 'follow_up',
      questionsAskedInCurrentSubtopic: 0,
      correctAnswersInCurrentSubtopic: 0,
      currentSubtopicState: 'assessing',
      shouldTransition: false,
      isComplete: false,
    });
    
    // Validate response structure
    if (!response || !response.content || typeof response.content !== 'string') {
      console.error('LLM assessment: Invalid response structure:', response);
      return {quality: fallbackAssessment(userResponse)};
    }
    
    try {
      // Try to parse as JSON
      const parsed = JSON.parse(response.content);
      
      // Validate the parsed structure
      const validQualities = ['excellent', 'good', 'partial', 'incorrect', 'confused'];
      if (!parsed.quality || !validQualities.includes(parsed.quality)) {
        console.error('LLM assessment: Invalid quality value:', parsed.quality);
        return {quality: fallbackAssessment(userResponse)};
      }
      
      return {
        quality: parsed.quality as AnswerQuality,
        specificGaps: parsed.specificGaps || undefined
      };
    } catch (parseError) {
      // Fallback to simple parsing
      const assessment = response.content.toLowerCase().trim();
    
      if (assessment.includes('excellent')) return {quality: 'excellent'};
      if (assessment.includes('good')) return {quality: 'good'};
      if (assessment.includes('partial')) return {quality: 'partial'};
      if (assessment.includes('incorrect')) return {quality: 'incorrect'};
      if (assessment.includes('confused')) return {quality: 'confused'};
      
      // If we can't parse anything meaningful, use fallback
      console.warn('LLM assessment: Could not parse response, using fallback');
      return {quality: fallbackAssessment(userResponse)};
    }
  } catch (error) {
    console.error('LLM assessment failed, falling back to heuristics:', error);
    return {quality: fallbackAssessment(userResponse)};
  }
}

/**
 * Fallback assessment for when LLM assessment fails
 */
function fallbackAssessment(userResponse: string): AnswerQuality {
  const response = userResponse.toLowerCase().trim();
  const length = response.length;
  
  // Check for obvious confusion signals first
  if (isStruggling(response)) {
    return 'confused';
  }
  
  // Very short responses that aren't obvious answers
  if (length < 5 && !/^(yes|no|yeah|nope|ok)$/.test(response)) {
    return 'confused';
  }
  
  // Look for medical terminology or structured thinking
  const medicalTerms = ['pathophysiology', 'mechanism', 'diagnosis', 'treatment', 'patient', 'clinical', 
                       'syndrome', 'disease', 'condition', 'symptoms', 'signs', 'etiology', 'prognosis'];
  const hasMedicalTerms = medicalTerms.some(term => response.includes(term));
  
  // Look for structured medical reasoning
  const reasoningPatterns = ['because', 'since', 'due to', 'caused by', 'leads to', 'results in', 'indicates'];
  const hasReasoning = reasoningPatterns.some(pattern => response.includes(pattern));
  
  // More intelligent assessment based on content quality
  if (hasMedicalTerms && hasReasoning && length > 30) {
    return 'good';
  } else if (hasMedicalTerms || hasReasoning) {
    return 'partial';
  } else if (length > 20) {
    return 'partial';
  } else {
    return 'incorrect';
  }
}

/**
 * Assess the quality of a user's response with interaction type detection
 */
export async function assessUserResponse(
  userResponse: string, 
  context: CarsonSessionContext
): Promise<AssessmentResult | null> {
  // **NEW**: First classify the interaction type
  const interaction = classifyInteraction(userResponse, context);
  
  // If this isn't a medical response, handle it appropriately
  if (!interaction.requiresAssessment) {
    // Return a special assessment result for non-medical interactions
    return {
      answerQuality: 'conversational' as any, // Special type for non-medical
      nextAction: 'continue_conversation',
      reasoning: interaction.suggestedResponse || "Let's continue with our learning.",
      isStruggling: interaction.type === 'emotional_support' || interaction.type === 'give_up',
      specificGaps: undefined,
      interactionType: interaction.type // Add this for context
    } as AssessmentResult & { interactionType: InteractionType };
  }
  
  // Get Carson's last message for context
  const lastCarsonMessage = context.history
    .filter(msg => msg.role === "assistant")
    .slice(-1)[0]?.content || "";
  
  // Check if this is a conversational response rather than a medical answer
  if (isConversationalResponse(userResponse, lastCarsonMessage)) {
    return null; // Don't assess conversational responses
  }
  
  // Check if student is struggling first
  const isUserStruggling = isStruggling(userResponse);
  
  // Get current subtopic for context
  const currentSubtopic = context.subtopics[context.currentSubtopicIndex];
  const subtopicTitle = currentSubtopic?.title || "Unknown Subtopic";
  
  // Use LLM-powered assessment for medical responses (or mark as confused if struggling)
  let answerQuality: AnswerQuality;
  let specificGaps: string | undefined;
  
  if (isUserStruggling) {
    answerQuality = 'confused';
  } else {
    const assessmentResult = await assessWithLLM(
    userResponse,
    lastCarsonMessage,
    context.topic || "Medical Topic",
    subtopicTitle
  );
    answerQuality = assessmentResult.quality;
    specificGaps = assessmentResult.specificGaps;
  }
  
  // **NEW**: Use simple triaging model
  const subtopic = context.subtopics[context.currentSubtopicIndex];
  const requirements = generateSubtopicRequirements(subtopic.title, context.topic || "Medical Topic");
  
  // Get or initialize subtopic status from stored triaging data
  const status: SubtopicStatus = subtopic.triagingStatus || initializeSubtopicStatus();
  
  const { phase, nextAction, statusUpdate } = await determineTriagingAction(
    userResponse, answerQuality, context, requirements, status, lastCarsonMessage
  );
  
  return {
    answerQuality,
    nextAction,
    reasoning: generateReasoningForAssessment(answerQuality, nextAction, context, specificGaps, phase),
    isStruggling: isUserStruggling,
    specificGaps,
    interactionType: 'medical_response',
    currentPhase: phase,
    statusUpdate
  } as AssessmentResult & { interactionType: InteractionType };
}

/**
 * Determine assessment phase and next action using simple triaging model
 */
async function determineTriagingAction(
  userResponse: string,
  answerQuality: AnswerQuality, 
  context: CarsonSessionContext,
  requirements: SubtopicRequirements,
  status: SubtopicStatus,
  lastCarsonMessage: string
): Promise<{ phase: AssessmentPhase; nextAction: NextAction; statusUpdate: Partial<SubtopicStatus> }> {
  
  const questionsUsed = status.questionsUsed + 1;
  
  // **ESCAPE VALVE**: Hard stop at max questions
  if (questionsUsed >= requirements.maxQuestions) {
    return {
      phase: 'complete',
      nextAction: 'complete_subtopic',
      statusUpdate: { questionsUsed }
    };
  }
  
  // **PHASE 1: INITIAL ASSESSMENT** - Comprehensive gap analysis on first question
  if (!status.hasInitialAssessment) {
    const gapAnalysis = await analyzeGaps(
      userResponse, 
      context.subtopics[context.currentSubtopicIndex].title,
      context.topic || "Medical Topic"
    );
    
    return {
      phase: 'initial_assessment',
      nextAction: gapAnalysis.criticalGaps.length > 0 ? 'continue_conversation' : 
                  (answerQuality === 'confused' ? 'explain' : 'continue_conversation'),
      statusUpdate: { 
        questionsUsed,
        hasInitialAssessment: true,
        gapAnalysis
      }
    };
  }
  
  // **PHASE 2: TARGETED REMEDIATION** - Address gaps by priority
  const gaps = status.gapAnalysis!;
  const unaddressedCritical = gaps.criticalGaps.filter(gap => !status.addressedGaps.includes(gap));
  const unaddressedImportant = gaps.importantGaps.filter(gap => !status.addressedGaps.includes(gap));
  
  // Address critical gaps first
  if (unaddressedCritical.length > 0) {
    const statusUpdate: Partial<SubtopicStatus> = { questionsUsed };
    
    if (['excellent', 'good'].includes(answerQuality)) {
      // Gap addressed successfully
      statusUpdate.addressedGaps = [...status.addressedGaps, unaddressedCritical[0]];
    }
    
    return {
      phase: 'targeted_remediation',
      nextAction: answerQuality === 'confused' ? 'explain' : 'continue_conversation',
      statusUpdate
    };
  }
  
  // Then address important gaps if we have time/questions
  if (unaddressedImportant.length > 0 && questionsUsed < requirements.maxQuestions - 1) {
    const statusUpdate: Partial<SubtopicStatus> = { questionsUsed };
    
    if (['excellent', 'good'].includes(answerQuality)) {
      statusUpdate.addressedGaps = [...status.addressedGaps, unaddressedImportant[0]];
    }
    
    return {
      phase: 'targeted_remediation', 
      nextAction: answerQuality === 'confused' ? 'explain' : 'continue_conversation',
      statusUpdate
    };
  }
  
  // **PHASE 3: APPLICATION** - Test clinical reasoning if required and time allows
  if (requirements.mustTestApplication && !status.hasTestedApplication && 
      questionsUsed < requirements.maxQuestions) {
    return {
      phase: 'application',
      nextAction: answerQuality === 'confused' ? 'explain' : 'continue_conversation',
      statusUpdate: { 
        questionsUsed,
        hasTestedApplication: true 
      }
    };
  }
  
  // **PHASE 4: GAP ACKNOWLEDGMENT** - Acknowledge unaddressed gaps before completing
  const unaddressedMinor = gaps.minorGaps.filter(gap => !status.addressedGaps.includes(gap));
  const unaddressedImportantRemaining = gaps.importantGaps.filter(gap => !status.addressedGaps.includes(gap));
  
  if ((unaddressedImportantRemaining.length > 0 || unaddressedMinor.length > 0) && 
      !status.acknowledgedGaps.length) {
    // Acknowledge what we're not covering
    const allUnaddressed = [...unaddressedImportantRemaining, ...unaddressedMinor];
    return {
      phase: 'gap_acknowledgment',
      nextAction: 'continue_conversation', // Generate acknowledgment response
      statusUpdate: { 
        questionsUsed,
        acknowledgedGaps: allUnaddressed 
      }
    };
  }
  
  // **COMPLETE**: All critical gaps addressed, application tested (if required), gaps acknowledged
  return {
    phase: 'complete',
    nextAction: 'complete_subtopic',
    statusUpdate: { questionsUsed }
  };
}

// Legacy function removed - replaced by new Phase 1 refactor determineNextAction

// Update the reasoning generation to use contextual responses instead of template-based ones
function generateReasoningForAssessment(
  answerQuality: AnswerQuality,
  nextAction: NextAction,
  context: CarsonSessionContext,
  specificGaps?: string,
  phase?: AssessmentPhase
): string {
  const currentSubtopic = context.subtopics[context.currentSubtopicIndex];
  const subtopicTitle = currentSubtopic?.title || "Unknown Subtopic";

  switch (nextAction) {
    case 'continue_conversation':
      return generateContextualResponse('question', {
        subtopic: subtopicTitle,
        questionType: 'follow_up',
        answerQuality: answerQuality,
        isStruggling: answerQuality === 'confused' || answerQuality === 'incorrect',
        specificGaps,
        topic: context.topic,
        phase: phase
      });

    case 'give_cue':
      return generateContextualResponse('cue', {
        subtopic: subtopicTitle,
        answerQuality: answerQuality,
        isStruggling: answerQuality === 'confused' || answerQuality === 'incorrect',
        specificGaps,
        topic: context.topic
      });

    case 'explain':
      return generateContextualResponse('explanation', {
        subtopic: subtopicTitle,
        answerQuality: answerQuality,
        isStruggling: true,
        specificGaps,
        topic: context.topic
      });

    case 'check_understanding':
      return generateContextualResponse('feedback', {
        subtopic: subtopicTitle,
        answerQuality: answerQuality,
        isStruggling: false,
        specificGaps,
        topic: context.topic
      });

    case 'complete_subtopic':
      return generateContextualResponse('transition', {
        subtopic: context.subtopics[context.currentSubtopicIndex + 1]?.title || "the next topic",
        answerQuality: answerQuality,
        isStruggling: false,
        specificGaps,
        topic: context.topic
      });

    default:
      return generateOriginalResponse(nextAction as ResponseType, { subtopic: subtopicTitle });
  }
}

export function updateSessionAfterAssessment(
  context: CarsonSessionContext,
  assessment: AssessmentResult
): Partial<CarsonSessionContext> {
  const updates: Partial<CarsonSessionContext> = {
    questionsAskedInCurrentSubtopic: context.questionsAskedInCurrentSubtopic + 1
  };
  
  // Increment correctAnswersInCurrentSubtopic for good/excellent answers
  const isCorrectAnswer = ['excellent', 'good'].includes(assessment.answerQuality);
  if (isCorrectAnswer) {
    updates.correctAnswersInCurrentSubtopic = context.correctAnswersInCurrentSubtopic + 1;
  }
  
  // Update subtopic state based on next action
  switch (assessment.nextAction) {
    case 'continue_conversation':
      updates.currentQuestionType = 'follow_up';
      updates.currentSubtopicState = 'assessing';
      break;
      
    case 'give_cue':
      // Stay in current question type but provide guidance
      updates.currentSubtopicState = 'assessing';
      break;
      
    case 'explain':
      updates.currentSubtopicState = 'explaining';
      break;
      
    case 'check_understanding':
      updates.currentQuestionType = 'checkin';
      updates.currentSubtopicState = 'checking';
      break;
      
    case 'complete_subtopic':
      updates.currentSubtopicState = 'complete';
      updates.shouldTransition = true;
      break;
  }
  
  // Update subtopic-level tracking
  const shouldMarkNeedsExplanation = ['incorrect', 'confused'].includes(assessment.answerQuality);
  const currentSubtopicIndex = context.currentSubtopicIndex;
  const updatedSubtopics = [...context.subtopics];
  
  if (updatedSubtopics[currentSubtopicIndex]) {
    const currentSubtopic = updatedSubtopics[currentSubtopicIndex];
    
    // **NEW**: Apply triaging status updates
    const baseStatus = currentSubtopic.triagingStatus || initializeSubtopicStatus();
    let updatedTriagingStatus = baseStatus;
    if (assessment.statusUpdate) {
      updatedTriagingStatus = {
        ...baseStatus,
        ...assessment.statusUpdate
      };
    }
    
    updatedSubtopics[currentSubtopicIndex] = {
      ...currentSubtopic,
      needsExplanation: shouldMarkNeedsExplanation || currentSubtopic.needsExplanation,
      questionsAsked: currentSubtopic.questionsAsked + 1,
      correctAnswers: isCorrectAnswer ? 
        currentSubtopic.correctAnswers + 1 : 
        currentSubtopic.correctAnswers,
      triagingStatus: updatedTriagingStatus // **NEW**: Store the triaging status
    };
    updates.subtopics = updatedSubtopics;
  }
  
  return updates;
}

// **ENHANCED**: Context-aware question generation for confident students
function generateContextualResponse(
  type: ResponseType,
  context: {
    subtopic?: string;
    answerQuality?: AnswerQuality;
    questionType?: string;
    isStruggling?: boolean;
    specificGaps?: string; // Enhanced: what specifically was missing
    topic?: string; // Add topic for advanced questions
    phase?: AssessmentPhase; // Current assessment phase
  }
): string {
  const { answerQuality, isStruggling, specificGaps, topic, subtopic } = context;
  
  // Determine student confidence level
  let confidenceLevel: 'confident' | 'struggling' | 'partially_right';
  
  if (isStruggling || answerQuality === 'confused' || answerQuality === 'incorrect') {
    confidenceLevel = 'struggling';
  } else if (answerQuality === 'partial') {
    confidenceLevel = 'partially_right';
  } else {
    confidenceLevel = 'confident';
  }
  
  switch (type) {
    case 'question':
      // **KEY IMPROVEMENT**: Use specific gaps for targeted questions
      if (confidenceLevel === 'partially_right' && specificGaps) {
        const acknowledgment = dynamicResponses.partially_right.acknowledgments[
          Math.floor(Math.random() * dynamicResponses.partially_right.acknowledgments.length)
        ];
        // Generate gap-specific question instead of generic follow-up
        return `${acknowledgment} ${generateGapSpecificQuestion(specificGaps, subtopic)}`;
      }
      
      if (confidenceLevel === 'confident') {
        const acknowledgment = dynamicResponses.confident.acknowledgments[
          Math.floor(Math.random() * dynamicResponses.confident.acknowledgments.length)
        ];
        const challenge = dynamicResponses.confident.challenges[
          Math.floor(Math.random() * dynamicResponses.confident.challenges.length)
        ];
        const questionDepth = context.questionType === 'child' ? 'deeper' : 'reasoning';
        // **ENHANCED**: Use advanced questions with topic context
        return `${acknowledgment} ${challenge} ${generateReasoningQuestion(subtopic, questionDepth, topic)}`;
      }
      
      if (confidenceLevel === 'struggling') {
        const supportive = dynamicResponses.struggling.supportive_intros[
          Math.floor(Math.random() * dynamicResponses.struggling.supportive_intros.length)
        ];
        return `${supportive} ${generateSimpleQuestion()}`;
      }
      break;
      
    case 'cue':
      if (specificGaps) {
      const guidance = gentleGuidance[Math.floor(Math.random() * gentleGuidance.length)];
        return `${guidance} ${generateSpecificHint(specificGaps)}`;
      }
      return generateOriginalCue(context);
      
    case 'explanation':
      if (confidenceLevel === 'struggling') {
        const intro = dynamicResponses.struggling.supportive_intros[
          Math.floor(Math.random() * dynamicResponses.struggling.supportive_intros.length)
        ];
        const explanation = dynamicResponses.struggling.explanations[
          Math.floor(Math.random() * dynamicResponses.struggling.explanations.length)
        ];
        const keyPoint = generateKeyPoint(context.subtopic, false);
        return `${intro} ${explanation} ${keyPoint}`;
      }
      return generateOriginalExplanation(context);

    default:
      return generateOriginalResponse(type, context);
  }
  
  return generateOriginalResponse(type, context);
}

// **NEW**: Generate questions that target specific gaps
function generateGapSpecificQuestion(specificGaps: string, subtopic?: string): string {
  // Convert gap description into a targeted question
  const gapHints = [
    `What about ${specificGaps.toLowerCase()}? How might that factor in?`,
    `You mentioned several factors, but what about ${specificGaps.toLowerCase()}?`,
    `Think about ${specificGaps.toLowerCase()} - how does that relate to ${subtopic || 'this condition'}?`,
    `Consider ${specificGaps.toLowerCase()}. A patient with this history would have what additional risk?`,
    `Good list! Now think about infectious causes - specifically ${specificGaps.toLowerCase()}.`
  ];
  
  return gapHints[Math.floor(Math.random() * gapHints.length)];
}

// **ENHANCED**: Generate reasoning-based "why" and "how" questions with advanced types
function generateReasoningQuestion(subtopic?: string, depth: 'surface' | 'deeper' | 'reasoning' = 'reasoning', topic?: string): string {
  // If we have context, use advanced question types
  if (subtopic && topic) {
    const allQuestionTypes = ['clinical_vignette', 'differential', 'mechanism', 'priority', 'application'] as const;
    
    // **NEW**: Filter question types by subtopic context
    const contextuallyAppropriateTypes = filterQuestionTypesByContext([...allQuestionTypes], subtopic);
    
    // Weight question types based on depth AND context
    let weightedTypes: (typeof allQuestionTypes[number])[] = [];
    
    switch (depth) {
      case 'surface':
        // Prefer mechanism and priority if allowed by context
        const surfacePreferred = ['mechanism', 'priority'];
        weightedTypes = contextuallyAppropriateTypes.filter(type => surfacePreferred.includes(type));
        if (weightedTypes.length === 0) weightedTypes = contextuallyAppropriateTypes;
        break;
      case 'deeper':
        // Prefer application and clinical vignettes if allowed by context
        const deeperPreferred = ['clinical_vignette', 'differential', 'application'];
        weightedTypes = contextuallyAppropriateTypes.filter(type => deeperPreferred.includes(type));
        if (weightedTypes.length === 0) weightedTypes = contextuallyAppropriateTypes;
        break;
      case 'reasoning':
        // Use all contextually appropriate types
        weightedTypes = [...contextuallyAppropriateTypes, ...contextuallyAppropriateTypes]; // Double weight
        break;
    }
    
    const selectedType = weightedTypes[Math.floor(Math.random() * weightedTypes.length)];
    return generateAdvancedQuestion(subtopic, topic, selectedType);
  }
  
  // **NEW**: Context-aware fallback questions
  const context = getSubtopicContext(subtopic || '');
  const contextRules = context !== 'general' ? SUBTOPIC_CONTEXT_MAP[context] : null;
  
  // Generate questions appropriate to the subtopic context
  const whyQuestions = contextRules ? [
    `Why do you think that ${contextRules.keywords[0]} is important?`,
    `What's the underlying ${contextRules.keywords[0]} here?`,
    `Why would that ${contextRules.keywords[1]} be significant?`,
    `What makes this ${contextRules.keywords[0]} particularly relevant?`,
    `Why is understanding this ${contextRules.keywords[0]} crucial?`
  ] : [
    `Why do you think that happens?`,
    `What's the underlying mechanism there?`,
    `Why would that increase the risk?`,
    `What makes that factor so important?`,
    `Why do you think some patients are more vulnerable?`
  ];
  
  // **NEW**: Domain-specific fallback questions
  const domainSpecificWhyQuestions: Record<string, string[]> = {
    biochemistry: [
      `Why is this enzymatic step rate-limiting?`,
      `Why would this pathway be upregulated?`,
      `Why do these cofactors bind in this order?`,
      `Why is this reaction thermodynamically favorable?`
    ],
    pharmacology: [
      `Why does this drug have this specific mechanism?`,
      `Why would genetic variants affect drug response?`,
      `Why is this pharmacokinetic property important?`,
      `Why do these drug interactions occur?`
    ],
    anatomy: [
      `Why is this anatomical relationship clinically important?`,
      `Why did this structure develop this way embryologically?`,
      `Why is this innervation pattern significant?`,
      `Why do these anatomical variations occur?`
    ],
    epidemiology: [
      `Why would this population have higher risk?`,
      `Why is this study design appropriate?`,
      `Why might these results be biased?`,
      `Why do these epidemiological patterns exist?`
    ]
  };
  
  // Use domain-specific questions if available
  const finalWhyQuestions = domainSpecificWhyQuestions[context] || whyQuestions;
  
  const howQuestions = contextRules && !contextRules.forbiddenQuestionTypes.includes('application') ? [
    `How would you explain this ${contextRules.keywords[0]} to a patient?`,
    `How does this ${contextRules.keywords[0]} affect your approach?`,
    `How would you prioritize these ${contextRules.keywords[1]} factors?`,
    `How would you use this ${contextRules.keywords[0]} knowledge in practice?`,
    `How might this ${contextRules.keywords[0]} change your thinking?`
  ] : [
    `How would you explain that mechanism?`,
    `How do these factors interact?`,
    `How would you prioritize these different aspects?`,
    `How would you connect these concepts?`,
    `How might this influence your understanding?`
  ];
  
  const clinicalReasoningQuestions = [
    `Walk me through your thinking about this ${contextRules?.keywords[0] || 'concept'}.`,
    `What would make you most concerned about this ${contextRules?.keywords[0] || 'finding'}?`,
    `How would you weight these different ${contextRules?.keywords[1] || 'factors'}?`,
    `What patterns do you see in this ${contextRules?.keywords[0] || 'area'}?`,
    `How would this influence your understanding of ${contextRules?.keywords[0] || 'the topic'}?`
  ];
  
  switch (depth) {
    case 'surface': 
      return finalWhyQuestions[Math.floor(Math.random() * finalWhyQuestions.length)];
    case 'deeper': 
      return howQuestions[Math.floor(Math.random() * howQuestions.length)];
    case 'reasoning': 
      return clinicalReasoningQuestions[Math.floor(Math.random() * clinicalReasoningQuestions.length)];
    default: 
      return finalWhyQuestions[Math.floor(Math.random() * finalWhyQuestions.length)];
  }
}

// **NEW**: Generate simpler questions for struggling students
function generateSimpleQuestion(): string {
  const simpleQuestions = [
    `Let's start with the basics - what do you know about this?`,
    `Can you tell me what comes to mind first?`,
    `What's the most important thing to remember here?`,
    `Let's break this down - what's one key point?`,
    `What would you tell a classmate about this?`
  ];
  
  return simpleQuestions[Math.floor(Math.random() * simpleQuestions.length)];
}

// **NEW**: Generate specific hints based on what's missing
function generateSpecificHint(specificGaps: string): string {
  const hintPatterns = [
    `Think about patients with a history of ${specificGaps.toLowerCase()}.`,
    `Consider how ${specificGaps.toLowerCase()} might damage the tubes.`,
    `Remember that ${specificGaps.toLowerCase()} is a major risk factor here.`,
    `Don't forget about ${specificGaps.toLowerCase()} - it's quite common.`,
    `${specificGaps} is something we see frequently in these cases.`
  ];
  
  return hintPatterns[Math.floor(Math.random() * hintPatterns.length)];
}

// Original response generators (fallbacks)
function generateOriginalExplanation(context: { subtopic?: string; needsAnalogy?: boolean }): string {
      const intro = supportiveIntros[Math.floor(Math.random() * supportiveIntros.length)];
      const explanation = generateKeyPoint(context.subtopic, context.needsAnalogy);
      return `${intro} ${explanation}`;
}

function generateOriginalQuestion(context: any): string {
  const acknowledgment = acknowledgments[Math.floor(Math.random() * acknowledgments.length)];
  const bridge = contextBridges[Math.floor(Math.random() * contextBridges.length)];
  const question = generateMedicalQuestion(context.subtopic, context.questionType);
  return `${acknowledgment} ${bridge} ${question}`;
}

function generateOriginalCue(context: { subtopic?: string }): string {
  const guidance = gentleGuidance[Math.floor(Math.random() * gentleGuidance.length)];
  const hint = generateCueHint();
  return `${guidance} ${hint}`;
}

function generateOriginalResponse(type: ResponseType, context: { subtopic?: string }): string {
  // Original generateConciseResponse logic for other types
  switch (type) {
    case 'feedback':
      const encouragementWithConnection = encouragementsWithConnection[Math.floor(Math.random() * encouragementsWithConnection.length)];
      const conceptName = getConceptName(context.subtopic);
      return `${encouragementWithConnection} ${conceptName}.`;
      
    case 'transition':
      const celebration = celebrationsWithBridge[Math.floor(Math.random() * celebrationsWithBridge.length)];
      const nextTopic = getNextTopicName(context.subtopic);
      return `${celebration} ${nextTopic}.`;
      
    default:
      return "What's your thinking on this?";
  }
}

function getConceptName(subtopic?: string): string {
  if (!subtopic) return "the concept";
  
  // Extract key concept from subtopic
  if (subtopic.toLowerCase().includes('definition')) return "the definition";
  if (subtopic.toLowerCase().includes('risk')) return "the risk factors";
  if (subtopic.toLowerCase().includes('presentation')) return "the presentation";
  if (subtopic.toLowerCase().includes('management')) return "the management";
  
  return "this concept";
}

function getNextTopicName(currentSubtopic?: string): string {
  // Simple mapping for common progressions
  const progressions: Record<string, string> = {
    'Definition and Types': 'risk factors',
    'Risk Factors': 'clinical presentation', 
    'Clinical Presentation': 'management',
    'Management': 'the next topic'
  };
  
  return progressions[currentSubtopic || ''] || 'the next area';
}

function generateMedicalQuestion(subtopic?: string, questionType?: string): string {
  // Generate focused medical questions
  const questions = {
    'Definition and Types': [
      "How would you define this condition?",
      "What are the main types?",
      "What characterizes this clinically?"
    ],
    'Risk Factors': [
      "What increases the risk?",
      "Who's most vulnerable?", 
      "What should we screen for?"
    ],
    'Clinical Presentation': [
      "How does this present?",
      "What would you see?",
      "What symptoms concern you?"
    ],
    'Management': [
      "How would you manage this?",
      "What's your priority?",
      "What intervention is needed?"
    ]
  };
  
  const topicQuestions = questions[subtopic as keyof typeof questions] || [
    "What else comes to mind?",
    "What's your thinking?",
    "How would you approach this?"
  ];
  
  return topicQuestions[Math.floor(Math.random() * topicQuestions.length)];
}

function getRelevantAnalogy(subtopic?: string): string {
  if (!subtopic) return "";
  
  if (subtopic.toLowerCase().includes('previa') || subtopic.toLowerCase().includes('bleeding')) {
    return medicalAnalogies.bleeding;
  }
  if (subtopic.toLowerCase().includes('delivery') || subtopic.toLowerCase().includes('management')) {
    return medicalAnalogies.delivery;
  }
  if (subtopic.toLowerCase().includes('circulation') || subtopic.toLowerCase().includes('flow')) {
    return medicalAnalogies.circulation;
  }
  
  return medicalAnalogies.placenta;
}

function generateCueHint(): string {
  return "Consider the mechanism here.";
}

function generateKeyPoint(subtopic?: string, needsAnalogy?: boolean): string {
  if (needsAnalogy) {
    const analogy = getRelevantAnalogy(subtopic);
    return `${analogy} the key is understanding the pathophysiology.`;
  }
  return "The key is understanding the pathophysiology.";
}

// **NEW**: Advanced question generation for clinical reasoning
function generateAdvancedQuestion(subtopic: string, topic: string, questionType: 'clinical_vignette' | 'differential' | 'mechanism' | 'priority' | 'application'): string {
  // **NEW**: Check if this is a non-clinical domain that needs specialized question generation
  const context = getSubtopicContext(subtopic);
  
  // Use domain-specific generators for non-clinical contexts
  if (questionType === 'mechanism') {
    switch (context) {
      case 'biochemistry':
        return generateBiochemistryQuestion(subtopic, topic);
      case 'pharmacology':
        return generatePharmacologyQuestion(subtopic, topic);
      case 'anatomy':
        return generateAnatomyQuestion(subtopic, topic);
      case 'physiology':
        return generatePhysiologyQuestion(subtopic, topic);
      case 'genetics':
        return generateGeneticsQuestion(subtopic, topic);
      case 'microbiology':
        return generateMicrobiologyQuestion(subtopic, topic);
      case 'immunology':
        return generateImmunologyQuestion(subtopic, topic);
    }
  }
  
  if (questionType === 'differential') {
    switch (context) {
      case 'epidemiology':
        return generateEpidemiologyQuestion(subtopic, topic);
      case 'public health':
        return generatePublicHealthQuestion(subtopic, topic);
    }
  }
  
  // Default to original clinical question generators
  switch (questionType) {
    case 'clinical_vignette':
      return generateClinicalVignette(subtopic, topic);
    case 'differential':
      return generateDifferentialQuestion(subtopic, topic);
    case 'mechanism':
      return generateMechanismQuestion(subtopic, topic);
    case 'priority':
      return generatePriorityQuestion(subtopic, topic);
    case 'application':
      return generateApplicationQuestion(subtopic, topic);
    default:
      return generateReasoningQuestion(subtopic, 'reasoning');
  }
}

function generateClinicalVignette(subtopic: string, topic: string): string {
  const vignettes = {
    'risk factors': [
      `A 32-year-old woman presents to the ED with pelvic pain. Her history includes chlamydia treatment 2 years ago and she uses an IUD. How do these factors change your index of suspicion for ${topic}?`,
      `You're counseling a 28-year-old who's planning pregnancy. She has a history of PID and one previous ${topic}. How would you discuss her risks?`,
      `A patient mentions she had tubal surgery for endometriosis. When taking her history, what other risk factors would you specifically ask about for ${topic}?`
    ],
    'diagnosis': [
      `A woman presents with amenorrhea and spotting. Beta-hCG is 1,200. Transvaginal ultrasound shows no intrauterine pregnancy. Walk me through your next diagnostic steps.`,
      `You have a patient with a beta-hCG of 800 that rises to only 950 in 48 hours. What does this pattern suggest and how would you proceed?`,
      `A patient has right lower quadrant pain and a positive pregnancy test. Her last menstrual period was 7 weeks ago. What's your immediate concern and diagnostic approach?`
    ],
    'management': [
      `You've diagnosed a stable ${topic} with beta-hCG of 2,000. The patient asks about treatment options. How do you counsel her about medical vs. surgical management?`,
      `A patient with ${topic} is hemodynamically unstable. What's your immediate management priority and why?`,
      `A patient received methotrexate for ${topic} but her beta-hCG isn't dropping appropriately. What factors would influence your next decision?`
    ]
  };

  const subtopicLower = subtopic.toLowerCase();
  let relevantVignettes: string[] = [];

  if (subtopicLower.includes('risk') || subtopicLower.includes('factor')) {
    relevantVignettes = vignettes['risk factors'];
  } else if (subtopicLower.includes('diagnosis') || subtopicLower.includes('presentation')) {
    relevantVignettes = vignettes['diagnosis'];
  } else if (subtopicLower.includes('management') || subtopicLower.includes('treatment')) {
    relevantVignettes = vignettes['management'];
  } else {
    // Default to risk factors for other subtopics
    relevantVignettes = vignettes['risk factors'];
  }

  return relevantVignettes[Math.floor(Math.random() * relevantVignettes.length)];
}

function generateDifferentialQuestion(subtopic: string, topic: string): string {
  const differentialQuestions = [
    `A patient presents with pelvic pain and a positive pregnancy test. How would you differentiate ${topic} from other causes? What's your approach?`,
    `What clinical features would make you more suspicious of ${topic} versus threatened abortion in early pregnancy?`,
    `A patient has unilateral pelvic pain. How do you distinguish ${topic} from ovarian pathology or appendicitis?`,
    `What combination of symptoms and signs would be most concerning for ${topic} in a woman of reproductive age?`,
    `How would you prioritize your differential diagnosis for a woman with amenorrhea, spotting, and pelvic pain?`
  ];
  
  return differentialQuestions[Math.floor(Math.random() * differentialQuestions.length)];
}

function generateMechanismQuestion(subtopic: string, topic: string): string {
  const mechanismQuestions = [
    `Explain the pathophysiology behind why PID increases the risk of ${topic}. What's happening at the cellular level?`,
    `Why do patients with ${topic} often have lower-than-expected beta-hCG levels? Walk me through the mechanism.`,
    `How does tubal damage from previous surgery lead to ${topic}? What's the underlying process?`,
    `Why might a patient with ${topic} present with shoulder pain? Explain the anatomical pathway.`,
    `What's the mechanism behind the classic "stepladder" rise in beta-hCG seen in ${topic}?`
  ];
  
  return mechanismQuestions[Math.floor(Math.random() * mechanismQuestions.length)];
}

function generatePriorityQuestion(subtopic: string, topic: string): string {
  const priorityQuestions = [
    `In managing ${topic}, what's your absolute first priority and why?`,
    `A patient with suspected ${topic} is hypotensive. What's your immediate action sequence?`,
    `How do you prioritize lab tests and imaging for suspected ${topic}? What's most urgent?`,
    `When counseling a patient about ${topic} risk factors, which ones would you emphasize most and why?`,
    `In emergency management of ${topic}, what's the most critical decision point?`
  ];
  
  return priorityQuestions[Math.floor(Math.random() * priorityQuestions.length)];
}

function generateApplicationQuestion(subtopic: string, topic: string): string {
  const applicationQuestions = [
    `How would you use your knowledge of ${topic} risk factors in routine gynecologic care?`,
    `A medical student asks you how to remember the key features of ${topic}. How would you teach them?`,
    `How would you counsel a patient with previous ${topic} who wants to conceive again?`,
    `What preventive strategies could reduce ${topic} incidence in your patient population?`,
    `How would you explain ${topic} to a patient in terms they can understand?`
  ];
  
  return applicationQuestions[Math.floor(Math.random() * applicationQuestions.length)];
}

// **NEW**: Domain-specific question generators for non-clinical contexts
function generateBiochemistryQuestion(subtopic: string, topic: string): string {
  const biochemQuestions = [
    `Walk me through the enzymatic steps in this ${topic} pathway. What happens at each stage?`,
    `What would happen to this ${topic} pathway if you inhibited the rate-limiting enzyme?`,
    `How does the regulation of ${topic} change under different metabolic conditions?`,
    `What cofactors or coenzymes are essential for this ${topic} process and why?`,
    `How does the thermodynamics of this ${topic} reaction drive the overall pathway?`
  ];
  
  return biochemQuestions[Math.floor(Math.random() * biochemQuestions.length)];
}

function generatePharmacologyQuestion(subtopic: string, topic: string): string {
  const pharmacQuestions = [
    `How does the mechanism of action of ${topic} lead to its therapeutic effects?`,
    `What pharmacokinetic properties of ${topic} determine its dosing schedule?`,
    `How would you expect drug interactions to affect ${topic} metabolism or efficacy?`,
    `What factors influence the bioavailability and distribution of ${topic}?`,
    `How do genetic polymorphisms affect individual responses to ${topic}?`
  ];
  
  return pharmacQuestions[Math.floor(Math.random() * pharmacQuestions.length)];
}

function generateAnatomyQuestion(subtopic: string, topic: string): string {
  const anatomyQuestions = [
    `Describe the spatial relationships between ${topic} and surrounding structures.`,
    `How does the embryological development of ${topic} explain its adult anatomy?`,
    `What blood supply and innervation patterns characterize ${topic}?`,
    `How do anatomical variations in ${topic} affect its function or clinical significance?`,
    `What anatomical landmarks help identify ${topic} during examination or procedures?`
  ];
  
  return anatomyQuestions[Math.floor(Math.random() * anatomyQuestions.length)];
}

function generatePhysiologyQuestion(subtopic: string, topic: string): string {
  const physiologyQuestions = [
    `How does the body maintain homeostasis when ${topic} function is challenged?`,
    `What feedback mechanisms regulate ${topic} under normal conditions?`,
    `How do changes in one aspect of ${topic} affect the entire system?`,
    `What adaptive responses occur when ${topic} is under physiological stress?`,
    `How does ${topic} integrate with other physiological systems?`
  ];
  
  return physiologyQuestions[Math.floor(Math.random() * physiologyQuestions.length)];
}

function generateEpidemiologyQuestion(subtopic: string, topic: string): string {
  const epidemiologyQuestions = [
    `How would you interpret incidence and prevalence data for ${topic} in different populations?`,
    `What study design would best answer questions about ${topic} risk factors?`,
    `How do demographic factors influence the epidemiology of ${topic}?`,
    `What biases might affect studies investigating ${topic}?`,
    `How would you calculate and interpret measures of association for ${topic}?`
  ];
  
  return epidemiologyQuestions[Math.floor(Math.random() * epidemiologyQuestions.length)];
}

function generatePublicHealthQuestion(subtopic: string, topic: string): string {
  const publicHealthQuestions = [
    `What population-level interventions could reduce the burden of ${topic}?`,
    `How would you design a screening program for ${topic} in the community?`,
    `What policy changes could improve prevention of ${topic}?`,
    `How do social determinants of health influence ${topic} outcomes?`,
    `What community resources would support people affected by ${topic}?`
  ];
  
  return publicHealthQuestions[Math.floor(Math.random() * publicHealthQuestions.length)];
}

function generateGeneticsQuestion(subtopic: string, topic: string): string {
  const geneticsQuestions = [
    `How would you predict inheritance patterns for ${topic} in a family pedigree?`,
    `What molecular mechanisms explain the genetic basis of ${topic}?`,
    `How do different types of mutations affect ${topic} expression or function?`,
    `What genetic counseling considerations apply to ${topic}?`,
    `How do genetic and environmental factors interact in ${topic}?`
  ];
  
  return geneticsQuestions[Math.floor(Math.random() * geneticsQuestions.length)];
}

function generateMicrobiologyQuestion(subtopic: string, topic: string): string {
  const microbiologyQuestions = [
    `What characteristics help identify ${topic} in laboratory settings?`,
    `How does ${topic} evade host immune responses?`,
    `What environmental factors affect ${topic} growth and survival?`,
    `How does ${topic} develop resistance to antimicrobial agents?`,
    `What virulence factors make ${topic} pathogenic?`
  ];
  
  return microbiologyQuestions[Math.floor(Math.random() * microbiologyQuestions.length)];
}

function generateImmunologyQuestion(subtopic: string, topic: string): string {
  const immunologyQuestions = [
    `How does the immune system recognize and respond to ${topic}?`,
    `What happens when immune tolerance breaks down in relation to ${topic}?`,
    `How do different immune cell types coordinate their response to ${topic}?`,
    `What molecular signals regulate the immune response to ${topic}?`,
    `How does ${topic} affect both innate and adaptive immunity?`
  ];
  
  return immunologyQuestions[Math.floor(Math.random() * immunologyQuestions.length)];
}

/**
 * Generate metacognitive questions to help students understand their learning
 */
export function generateMetacognitiveQuestion(
  context: CarsonSessionContext,
  answerQuality: AnswerQuality
): string {
  const currentSubtopic = context.subtopics[context.currentSubtopicIndex];
  
  switch (answerQuality) {
    case 'confused':
    case 'incorrect':
      const strugglingQuestions = [
        `I can see ${currentSubtopic.title} is tricky. What specifically feels confusing about it?`,
        `Let's step back - what part of ${currentSubtopic.title} makes sense to you, and what part doesn't?`,
        `No problem. What would help you understand ${currentSubtopic.title} better? Examples? Different explanation?`,
        `This stuff is tough. What's your biggest question about ${currentSubtopic.title}?`
      ];
      return strugglingQuestions[Math.floor(Math.random() * strugglingQuestions.length)];
      
    case 'partial':
      const partialQuestions = [
        `You've got some good points. What do you think might be missing?`,
        `Good start! What other aspects of ${currentSubtopic.title} should we cover?`,
        `Right so far. If you were teaching this to a classmate, what else would you mention?`,
        `You're on track. What questions do you still have about ${currentSubtopic.title}?`
      ];
      return partialQuestions[Math.floor(Math.random() * partialQuestions.length)];
      
    case 'good':
    case 'excellent':
      const reflectionQuestions = [
        `Good work. How confident do you feel about using this ${currentSubtopic.title} knowledge with real patients?`,
        `Nice. What's one thing about ${currentSubtopic.title} that surprised you or changed how you think about it?`,
        `Right. If you had to identify one key takeaway about ${currentSubtopic.title}, what would it be?`,
        `Solid. What connections do you see between ${currentSubtopic.title} and other medical concepts you know?`
      ];
      return reflectionQuestions[Math.floor(Math.random() * reflectionQuestions.length)];
  }
}

/**
 * Generate self-assessment prompts to gauge student confidence
 */
export function generateSelfAssessmentPrompt(subtopic: string): string {
  const prompts = [
    `On a scale of 1-10, how confident do you feel about ${subtopic}? What would help you get to a 10?`,
    `How ready do you feel to teach ${subtopic} to a fellow student? What would you focus on?`,
    `If you saw a patient tomorrow with ${subtopic}-related issues, what would you feel most/least confident about?`,
    `What's one thing about ${subtopic} you'd like to understand better before moving on?`
  ];
  
  return prompts[Math.floor(Math.random() * prompts.length)];
}

/**
 * Detect the type of interaction to route appropriately
 */
export type InteractionType = 
  | 'medical_response'      // Normal learning/assessment
  | 'emotional_support'     // Student frustrated/stressed
  | 'off_topic'            // Questions outside current topic
  | 'personal_casual'      // Personal questions about Carson
  | 'medical_advice'       // Seeking personal medical advice
  | 'challenge_authority'  // Disagreeing with Carson
  | 'meta_learning'        // Study strategies/exam questions
  | 'give_up'             // Avoidance/wanting to quit
  | 'technical_issue'     // Platform/technical problems
  | 'conversational'      // General conversational responses

export interface InteractionClassification {
  type: InteractionType;
  confidence: number;
  suggestedResponse?: string;
  requiresAssessment: boolean;
}

/**
 * Classify student interaction type before assessment
 */
export function classifyInteraction(
  userResponse: string, 
  context: CarsonSessionContext
): InteractionClassification {
  const response = userResponse.toLowerCase().trim();
  
  // Emotional/Frustrated responses
  const emotionalPatterns = [
    /^(this is (too )?hard|i can'?t do this|i'?m (so )?confused)/,
    /^(i hate|i don'?t like|this sucks|this is boring)/,
    /^(i'?m (so )?(stressed|frustrated|overwhelmed))/,
    /^(i feel (so )?(stupid|dumb|lost))/,
    /^(i'?m never going to|i can'?t understand)/,
    /^(i give up|i quit|i'?m done)/
  ];
  
  if (emotionalPatterns.some(pattern => pattern.test(response))) {
    return {
      type: 'emotional_support',
      confidence: 0.9,
      requiresAssessment: false,
      suggestedResponse: generateConfusionSupport(response, context.topic, context.subtopics[context.currentSubtopicIndex]?.title)
    };
  }
  
  // Give up/Avoidance
  const giveUpPatterns = [
    /^(let'?s skip|can we skip|i don'?t want to)/,
    /^(this is boring|can we do something else)/,
    /^(i'?m done|let'?s move on|next topic)/
  ];
  
  if (giveUpPatterns.some(pattern => pattern.test(response))) {
    return {
      type: 'give_up',
      confidence: 0.8,
      requiresAssessment: false,
      suggestedResponse: generateMotivationalResponse(context)
    };
  }
  
  // Personal/Casual questions
  const personalPatterns = [
    /^(are you|what'?s your|how'?s your|do you have)/,
    /^(are you a real doctor|what'?s your background)/,
    /^(how are you|good morning|hello)/,
    /^(nice to meet you|thanks for helping)/
  ];
  
  if (personalPatterns.some(pattern => pattern.test(response))) {
    return {
      type: 'personal_casual',
      confidence: 0.7,
      requiresAssessment: false,
      suggestedResponse: generatePersonalResponse()
    };
  }
  
  // Medical advice seeking
  const advicePatterns = [
    /^(i have|my symptoms|should i take|can you diagnose)/,
    /^(what should i do|is this normal|am i)/,
    /^(i'?m experiencing|i feel|my doctor said)/
  ];
  
  if (advicePatterns.some(pattern => pattern.test(response))) {
    return {
      type: 'medical_advice',
      confidence: 0.9,
      requiresAssessment: false,
      suggestedResponse: generateBoundaryResponse()
    };
  }
  
  // Challenge authority
  const challengePatterns = [
    /^(i think you'?re wrong|that'?s not right|my professor said)/,
    /^(i disagree|that'?s incorrect|my textbook says)/,
    /^(are you sure|i don'?t think so)/
  ];
  
  if (challengePatterns.some(pattern => pattern.test(response))) {
    return {
      type: 'challenge_authority',
      confidence: 0.8,
      requiresAssessment: false,
      suggestedResponse: generateAuthorityResponse()
    };
  }
  
  // Meta-learning questions
  const metaPatterns = [
    /^(how should i study|what'?s the best way|will this be on)/,
    /^(how long will|when will|should i memorize)/,
    /^(study tips|any advice|how do i remember)/
  ];
  
  if (metaPatterns.some(pattern => pattern.test(response))) {
    return {
      type: 'meta_learning',
      confidence: 0.8,
      requiresAssessment: false,
      suggestedResponse: generateMetaLearningResponse(context)
    };
  }
  
  // Technical issues
  const technicalPatterns = [
    /^(my voice|the app|i can'?t see|it'?s not working)/,
    /^(technical|sound|audio|screen)/,
    /^(slow|loading|crashed)/
  ];
  
  if (technicalPatterns.some(pattern => pattern.test(response))) {
    return {
      type: 'technical_issue',
      confidence: 0.9,
      requiresAssessment: false,
      suggestedResponse: generateTechnicalResponse()
    };
  }
  
  // Off-topic medical questions
  if (isOffTopicMedical(response, context.topic)) {
    return {
      type: 'off_topic',
      confidence: 0.7,
      requiresAssessment: false,
      suggestedResponse: generateRedirectionResponse(context)
    };
  }
  
  // Default to medical response if none match
  return {
    type: 'medical_response',
    confidence: 0.6,
    requiresAssessment: true
  };
}

// Helper functions for generating responses
function generateConfusionSupport(userResponse: string, topic: string, subtopic?: string): string {
  const response = userResponse.toLowerCase().trim();
  
  // More precise detection that aligns with our isStruggling patterns
  let supportType = 'general';
  let confidenceLevel = 'low'; // low, partial, seeking_validation
  
  // Direct struggling - lowest confidence, needs most support
  if (/^(i don'?t know|not sure|no idea|unsure|i'?m not sure)/.test(response) ||
      /^(confused|lost|stuck)/.test(response) ||
      /don'?t understand|not following|makes no sense/.test(response)) {
    supportType = 'completely_lost';
    confidenceLevel = 'low';
  }
  
  // Deflection patterns - partial knowledge, seeking help
  else if (/^(can you give me a hint|hint|clue)/.test(response) ||
           /^(help|i need help)/.test(response)) {
    supportType = 'needs_guidance';
    confidenceLevel = 'partial';
  }
  
  // Fishing patterns - has some knowledge, seeking validation
  else if (/\?$/.test(response) || // Ends with question mark
           /^(is it|could it be|might it be|does it|can it|would it)/.test(response) ||
           /right\?$|correct\?$/.test(response)) {
    supportType = 'seeking_validation';
    confidenceLevel = 'seeking_validation';
  }
  
  // Uncertainty markers - partial knowledge but unsure
  else if (/^(i'?m not sure, but|maybe|perhaps)/.test(response) ||
           /^(i think it might|it could be|possibly)/.test(response) ||
           /^(i think|i believe|i guess)/.test(response)) {
    supportType = 'uncertain_knowledge';
    confidenceLevel = 'partial';
  }
  
  // Vague responses - some understanding but lack specifics
  else if (/^(it'?s related to|something about|has to do with)/.test(response) ||
           /^(the|a|some)\s+\w+$/.test(response) ||
           /^(um|uh|well|so)/.test(response)) {
    supportType = 'vague_knowledge';
    confidenceLevel = 'partial';
  }
  
  // Very short responses - likely confused
  else if (response.length < 8 && !/^(yes|no|yeah|nope)$/.test(response)) {
    supportType = 'minimal_response';
    confidenceLevel = 'low';
  }
  
  const supportResponses = {
    completely_lost: [
      `Totally fair - ${subtopic || topic} is genuinely complex stuff. No one expects you to just know this.`,
      `Good to be honest about it. ${subtopic || topic} trips up a lot of people initially.`,
      `Yeah, ${subtopic || topic} isn't intuitive. Let me walk you through it.`
    ],
    
    seeking_validation: [
      `You're thinking about it the right way. That's exactly how you should approach ${subtopic || topic}.`,
      `Good instinct with that question. You're working through ${subtopic || topic} logically.`,
      `Right approach - asking the right questions about ${subtopic || topic}.`
    ],
    
    uncertain_knowledge: [
      `You're in the right ballpark with ${subtopic || topic}. Let me help you pin it down.`,
      `Close - you've got pieces of ${subtopic || topic} but let me fill in the gaps.`,
      `You're thinking about ${subtopic || topic} correctly, just need to connect the dots.`
    ],
    
    needs_guidance: [
      `Sure. So with ${subtopic || topic}, the key thing to remember is this.`,
      `Absolutely. Here's how I think about ${subtopic || topic}.`,
      `Of course. ${subtopic || topic} basically works like this.`
    ],
    
    vague_knowledge: [
      `Right general area. Now let's get specific about how ${subtopic || topic} actually works.`,
      `Good connection. Let me help you get more precise about ${subtopic || topic}.`,
      `You've got the broad concept. Now for the specifics of ${subtopic || topic}.`
    ],
    
    minimal_response: [
      `No problem. ${subtopic || topic} can be a lot to process at first.`,
      `Fair enough. Let me give you the key points about ${subtopic || topic}.`,
      `All good. Here's what you need to know about ${subtopic || topic}.`
    ],
    
    general: [
      `Alright, so ${subtopic || topic} is basically this.`,
      `Okay, let me explain ${subtopic || topic}.`,
      `Right, so here's how ${subtopic || topic} works.`
    ]
  };
  
  const responses = supportResponses[supportType as keyof typeof supportResponses];
  return responses[Math.floor(Math.random() * responses.length)];
}

function generateMotivationalResponse(context: CarsonSessionContext): string {
  const currentTopic = context.topic || "this topic";
  return `Look, ${currentTopic} can definitely feel like a lot at first. But here's the thing - you've already shown you understand some key concepts. Want to try a different angle? Maybe we can look at this through a real case that shows why this stuff actually matters.`;
}

function generatePersonalResponse(): string {
  const responses = [
    "I'm Carson - just an AI that's been trained to think like a doctor. Not actually human, but I've been designed to help you work through medical concepts the way a good attending would.",
    "Thanks for asking! I'm an AI, but I've been built to approach medical education like a real physician mentor would. My goal is helping you think through cases and concepts.",
    "I'm Carson - an AI designed to work with medical students. While I'm not human, I try to approach teaching the way good doctors do - direct, honest, and focused on helping you understand."
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}

function generateBoundaryResponse(): string {
  return "I can't give you personal medical advice - that's not what I'm here for. I'm designed for medical education and learning. If you've got health concerns, definitely talk to a real doctor. But I'm happy to help you understand medical concepts and work through cases!";
}

function generateAuthorityResponse(): string {
  const responses = [
    "Fair point - medicine definitely has areas where sources disagree or approaches differ. What specifically did your professor say? Let's compare the different perspectives and see where they align or diverge.",
    "Good that you're thinking critically about this. Different sources sometimes emphasize different aspects. Tell me more about what you heard elsewhere - let's work through the differences.",
    "Interesting - that's actually a good sign that you're engaging with multiple sources. What was the alternative take? Medicine often has nuances worth exploring."
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}

function generateMetaLearningResponse(context: CarsonSessionContext): string {
  const responses = [
    "Good question about study approach. For this kind of material, I'd focus on understanding mechanisms first, then building up to applications. Active recall - testing yourself rather than just reading - tends to stick better. What's been working for you so far?",
    "Smart to think about learning strategy. For medical topics, connecting to real cases usually helps retention. Also, trying to explain concepts to someone else is a great test of understanding. Want to try that approach with what we're covering?",
    "That's actually really important to think about. For complex medical concepts, building frameworks first, then adding details, usually works well. We can practice that approach together as we go through this."
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}

function generateTechnicalResponse(): string {
  return "Sorry you're having tech issues. Try refreshing or checking your connection if things aren't working smoothly. Voice not working? No problem - just type. The important thing is we can keep going with whatever works best for you.";
}

function generateRedirectionResponse(context: CarsonSessionContext): string {
  const currentTopic = context.topic || "our current topic";
  return `Interesting question, and I can see how that connects to medical thinking. Right now we're working through ${currentTopic}, and I want to make sure you really get this before we move on. Once we've got a solid foundation here, we can definitely explore other areas. Sound good?`;
}

function isOffTopicMedical(response: string, currentTopic?: string): boolean {
  if (!currentTopic) return false;
  
  const medicalTerms = ['diagnosis', 'treatment', 'symptom', 'disease', 'condition', 'patient', 'clinical'];
  const containsMedicalTerms = medicalTerms.some(term => response.includes(term));
  const mentionsCurrentTopic = currentTopic.split(' ').some(word => 
    response.toLowerCase().includes(word.toLowerCase())
  );
  
  return containsMedicalTerms && !mentionsCurrentTopic && response.length > 20;
}

function generateEmotionalSupport(response: string): string {
  const supportMessages = [
    "That's completely normal - this is exactly what learning looks like. No one expects you to know everything, especially not complex medical concepts.",
    "Perfect honesty! That's actually the best place to start learning from. Every attending physician has been exactly where you are right now.",
    "Good for being upfront about that. It's way better to say 'I don't know' than to guess - that's real doctor thinking.",
    "No worries at all. These concepts are genuinely challenging, and admitting when you don't know something is a strength, not a weakness.",
    "Totally fine - this is why we're here! Not knowing something just means we get to learn it together. That's the whole point."
  ];
  
  return supportMessages[Math.floor(Math.random() * supportMessages.length)];
}

// **NEW**: Subtopic context enforcement mapping
const SUBTOPIC_CONTEXT_MAP = {
  // ===== CLINICAL MEDICINE CONTEXTS =====
  pathophysiology: {
    allowedQuestionTypes: ['mechanism', 'differential'],
    keywords: ['mechanism', 'pathophysio', 'process', 'cellular', 'molecular'],
    forbiddenQuestionTypes: ['management', 'treatment', 'application'],
    enforcePrompt: 'Focus on mechanisms and processes only'
  },
  definition: {
    allowedQuestionTypes: ['mechanism', 'differential'],
    keywords: ['definition', 'what is', 'characterized by', 'classification'],
    forbiddenQuestionTypes: ['management', 'treatment', 'application'],
    enforcePrompt: 'Focus on definitions and classifications only'
  },
  'risk factors': {
    allowedQuestionTypes: ['clinical_vignette', 'differential', 'priority'],
    keywords: ['risk', 'factor', 'predispos', 'increase', 'likelihood'],
    forbiddenQuestionTypes: ['management', 'treatment'],
    enforcePrompt: 'Focus on risk factors and predisposing conditions only'
  },
  presentation: {
    allowedQuestionTypes: ['clinical_vignette', 'differential'],
    keywords: ['symptom', 'sign', 'present', 'clinical', 'manifestation'],
    forbiddenQuestionTypes: ['management', 'treatment'],
    enforcePrompt: 'Focus on clinical presentation and symptoms only'
  },
  diagnosis: {
    allowedQuestionTypes: ['clinical_vignette', 'differential', 'priority'],
    keywords: ['diagnos', 'test', 'workup', 'imaging', 'lab'],
    forbiddenQuestionTypes: ['treatment', 'management'],
    enforcePrompt: 'Focus on diagnostic approach and workup only'
  },
  management: {
    allowedQuestionTypes: ['clinical_vignette', 'application', 'priority'],
    keywords: ['treatment', 'manage', 'therapy', 'intervention'],
    forbiddenQuestionTypes: ['mechanism'],
    enforcePrompt: 'Focus on treatment and management only'
  },
  
  // ===== BASIC SCIENCE CONTEXTS =====
  biochemistry: {
    allowedQuestionTypes: ['mechanism', 'differential'],
    keywords: ['biochemistry', 'enzyme', 'pathway', 'metabolism', 'reaction', 'molecular', 'protein', 'substrate'],
    forbiddenQuestionTypes: ['clinical_vignette', 'management', 'treatment', 'application'],
    enforcePrompt: 'Focus on molecular mechanisms, enzymatic pathways, and biochemical processes only'
  },
  pharmacology: {
    allowedQuestionTypes: ['mechanism', 'differential', 'application'],
    keywords: ['pharmacology', 'drug', 'medication', 'receptor', 'kinetics', 'metabolism', 'interaction', 'adverse'],
    forbiddenQuestionTypes: ['clinical_vignette', 'management'],
    enforcePrompt: 'Focus on drug mechanisms, pharmacokinetics, and drug interactions only'
  },
  anatomy: {
    allowedQuestionTypes: ['mechanism', 'differential'],
    keywords: ['anatomy', 'structure', 'location', 'relationship', 'innervation', 'blood supply', 'embryology'],
    forbiddenQuestionTypes: ['clinical_vignette', 'management', 'treatment', 'application'],
    enforcePrompt: 'Focus on anatomical structures, relationships, and embryological development only'
  },
  physiology: {
    allowedQuestionTypes: ['mechanism', 'differential'],
    keywords: ['physiology', 'function', 'regulation', 'homeostasis', 'control', 'response', 'adaptation'],
    forbiddenQuestionTypes: ['clinical_vignette', 'management', 'treatment', 'application'],
    enforcePrompt: 'Focus on normal physiological functions and regulatory mechanisms only'
  },
  
  // ===== POPULATION HEALTH CONTEXTS =====
  epidemiology: {
    allowedQuestionTypes: ['differential', 'priority'],
    keywords: ['epidemiology', 'incidence', 'prevalence', 'risk', 'population', 'study', 'cohort', 'case-control'],
    forbiddenQuestionTypes: ['mechanism', 'clinical_vignette', 'management', 'treatment'],
    enforcePrompt: 'Focus on population health data, study design, and epidemiological concepts only'
  },
  'public health': {
    allowedQuestionTypes: ['differential', 'priority', 'application'],
    keywords: ['public health', 'prevention', 'screening', 'policy', 'community', 'intervention', 'health promotion'],
    forbiddenQuestionTypes: ['mechanism', 'clinical_vignette', 'management'],
    enforcePrompt: 'Focus on population-level interventions, prevention strategies, and health policy only'
  },
  biostatistics: {
    allowedQuestionTypes: ['differential', 'priority'],
    keywords: ['statistics', 'biostatistics', 'data', 'analysis', 'significance', 'power', 'sample size', 'bias'],
    forbiddenQuestionTypes: ['mechanism', 'clinical_vignette', 'management', 'treatment', 'application'],
    enforcePrompt: 'Focus on statistical concepts, study design, and data analysis only'
  },
  
  // ===== SPECIALTY CONTEXTS =====
  genetics: {
    allowedQuestionTypes: ['mechanism', 'differential'],
    keywords: ['genetics', 'inheritance', 'mutation', 'gene', 'chromosome', 'allele', 'hereditary', 'genomic'],
    forbiddenQuestionTypes: ['clinical_vignette', 'management', 'treatment', 'application'],
    enforcePrompt: 'Focus on genetic principles, inheritance patterns, and molecular genetics only'
  },
  microbiology: {
    allowedQuestionTypes: ['mechanism', 'differential'],
    keywords: ['microbiology', 'bacteria', 'virus', 'fungi', 'parasite', 'infection', 'organism', 'resistance'],
    forbiddenQuestionTypes: ['clinical_vignette', 'management', 'treatment', 'application'],
    enforcePrompt: 'Focus on microbial characteristics, life cycles, and resistance mechanisms only'
  },
  immunology: {
    allowedQuestionTypes: ['mechanism', 'differential'],
    keywords: ['immunology', 'immune', 'antibody', 'antigen', 'lymphocyte', 'response', 'hypersensitivity'],
    forbiddenQuestionTypes: ['clinical_vignette', 'management', 'treatment', 'application'],
    enforcePrompt: 'Focus on immune mechanisms, cellular responses, and immunological processes only'
  }
};

/**
 * **NEW**: Determine subtopic context category from title
 */
function getSubtopicContext(subtopicTitle: string): keyof typeof SUBTOPIC_CONTEXT_MAP | 'general' {
  const title = subtopicTitle.toLowerCase();
  
  // Clinical medicine contexts
  if (title.includes('pathophysio') || title.includes('mechanism')) return 'pathophysiology';
  if (title.includes('definition') || title.includes('types') || title.includes('classification')) return 'definition';
  if (title.includes('risk') || title.includes('factor') || title.includes('predispos')) return 'risk factors';
  if (title.includes('presentation') || title.includes('symptom') || title.includes('clinical')) return 'presentation';
  if (title.includes('diagnos') || title.includes('workup') || title.includes('test')) return 'diagnosis';
  if (title.includes('management') || title.includes('treatment') || title.includes('therapy')) return 'management';
  
  // Basic science contexts
  if (title.includes('biochemistry') || title.includes('enzyme') || title.includes('pathway') || title.includes('metabolism')) return 'biochemistry';
  if (title.includes('pharmacology') || title.includes('drug') || title.includes('medication') || title.includes('kinetics')) return 'pharmacology';
  if (title.includes('anatomy') || title.includes('structure') || title.includes('innervation') || title.includes('embryology')) return 'anatomy';
  if (title.includes('physiology') || title.includes('function') || title.includes('regulation') || title.includes('homeostasis')) return 'physiology';
  
  // Population health contexts
  if (title.includes('epidemiology') || title.includes('incidence') || title.includes('prevalence') || title.includes('population')) return 'epidemiology';
  if (title.includes('public health') || title.includes('prevention') || title.includes('screening') || title.includes('policy')) return 'public health';
  if (title.includes('biostatistics') || title.includes('statistics') || title.includes('data analysis') || title.includes('study design')) return 'biostatistics';
  
  // Specialty contexts
  if (title.includes('genetics') || title.includes('inheritance') || title.includes('mutation') || title.includes('gene')) return 'genetics';
  if (title.includes('microbiology') || title.includes('bacteria') || title.includes('virus') || title.includes('infection')) return 'microbiology';
  if (title.includes('immunology') || title.includes('immune') || title.includes('antibody') || title.includes('antigen')) return 'immunology';
  
  return 'general';
}

/**
 * **NEW**: Filter question types based on subtopic context
 */
function filterQuestionTypesByContext(
  questionTypes: ('clinical_vignette' | 'differential' | 'mechanism' | 'priority' | 'application')[],
  subtopicTitle: string
): ('clinical_vignette' | 'differential' | 'mechanism' | 'priority' | 'application')[] {
  const context = getSubtopicContext(subtopicTitle);
  
  if (context === 'general') return questionTypes; // No filtering for general subtopics
  
  const contextRules = SUBTOPIC_CONTEXT_MAP[context];
  const allowedTypes = questionTypes.filter(type => 
    contextRules.allowedQuestionTypes.includes(type) && 
    !contextRules.forbiddenQuestionTypes.includes(type)
  );
  
  // Fallback to differential if no allowed types
  return allowedTypes.length > 0 ? allowedTypes : ['differential'];
}

/**
 * Phase 1 Refactor: Focused Medical Assessment
 * This function ONLY assesses medical accuracy - no flow decisions
 */
async function assessMedicalAccuracy(
  userResponse: string,
  subtopicTitle: string,
  topic: string,
  expectedConcepts?: string[]
): Promise<MedicalAssessment> {
  
  // Quick check for obvious struggling
  if (isStruggling(userResponse)) {
    return {
      isCorrect: false,
      confidence: 0.9,
      missingConcepts: expectedConcepts || [],
      assessmentType: 'struggling',
      reasoning: 'Student appears confused or struggling'
    };
  }

  // Fast fallback for very short responses
  if (!userResponse?.trim() || userResponse.trim().length < 3) {
    return {
      isCorrect: false,
      confidence: 0.8,
      missingConcepts: expectedConcepts || [],
      assessmentType: 'insufficient',
      reasoning: 'Response too brief for assessment'
    };
  }

  // Use hybrid rule-based assessment for reliability and speed
  // This avoids JSON parsing issues and is more consistent
  return hybridMedicalAssessment(userResponse, expectedConcepts, subtopicTitle, topic);
}

/**
 * Fallback medical assessment when LLM fails - now uses hybrid intelligence
 */
function fallbackMedicalAssessment(userResponse: string, expectedConcepts?: string[]): MedicalAssessment {
  // Use the new hybrid assessment system for more sophisticated evaluation
  return hybridMedicalAssessment(userResponse, expectedConcepts);
}

/**
 * Phase 1 Refactor: Pure Orchestration Logic
 * This function ONLY determines what to do next - no LLM calls
 */
function determineNextAction(
  medicalAssessment: MedicalAssessment,
  interaction: InteractionClassification,
  subtopicStatus: SubtopicStatus,
  context: CarsonSessionContext
): OrchestrationResult {
  
  // Handle non-medical interactions first
  if (!interaction.requiresAssessment) {
    return {
      nextAction: 'handle_interaction',
      reasoning: interaction.suggestedResponse || "Handling non-medical interaction",
      shouldContinueSubtopic: true,
      statusUpdate: {}
    };
  }

  const questionsUsed = subtopicStatus.questionsUsed + 1;
  const requirements = generateSubtopicRequirements(
    context.subtopics[context.currentSubtopicIndex].title, 
    context.topic || "Medical Topic"
  );

  // **ESCAPE VALVE**: Hard stop at max questions
  if (questionsUsed >= requirements.maxQuestions) {
    return {
      nextAction: 'complete_subtopic',
      reasoning: 'Maximum questions reached for this subtopic',
      shouldContinueSubtopic: false,
      statusUpdate: { questionsUsed }
    };
  }

  // **STRUGGLING STUDENTS**: Provide support immediately
  if (medicalAssessment.assessmentType === 'struggling') {
    return {
      nextAction: 'provide_support',
      reasoning: 'Student needs emotional support and explanation',
      shouldContinueSubtopic: true,
      statusUpdate: { questionsUsed }
    };
  }

  // **CONFIDENTLY WRONG**: Special handling
  if (detectConfidentlyWrong(context.history.slice(-1)[0]?.content || '', medicalAssessment)) {
    return {
      nextAction: 'gentle_correction',
      reasoning: 'Student is confident but incorrect - needs gentle clarification',
      shouldContinueSubtopic: true,
      statusUpdate: { questionsUsed }
    };
  }

  // **INITIAL ASSESSMENT PHASE**
  if (!subtopicStatus.hasInitialAssessment) {
    return {
      nextAction: medicalAssessment.isCorrect ? 'continue_conversation' : 'explain_gaps',
      reasoning: 'Completing initial assessment of student knowledge',
      shouldContinueSubtopic: true,
      statusUpdate: { 
        questionsUsed,
        hasInitialAssessment: true,
        gapAnalysis: {
          criticalGaps: medicalAssessment.isCorrect ? [] : medicalAssessment.missingConcepts.slice(0, 2),
          importantGaps: medicalAssessment.isCorrect ? [] : medicalAssessment.missingConcepts.slice(2, 4),
          minorGaps: [],
          strengthAreas: medicalAssessment.isCorrect ? ['Demonstrates solid understanding'] : []
        }
      }
    };
  }

  // **ONGOING ASSESSMENT**: Check if we can complete
  if (medicalAssessment.isCorrect && questionsUsed >= 2) {
    return {
      nextAction: 'complete_subtopic',
      reasoning: 'Student demonstrates competency, ready to move on',
      shouldContinueSubtopic: false,
      statusUpdate: { questionsUsed }
    };
  }

  // **CONTINUE CONVERSATION**: Default case
  return {
    nextAction: medicalAssessment.isCorrect ? 'continue_conversation' : 'explain_gaps',
    reasoning: medicalAssessment.isCorrect ? 'Building on correct understanding' : 'Addressing knowledge gaps',
    shouldContinueSubtopic: true,
    statusUpdate: { questionsUsed }
  };
}

/**
 * Detect confidently wrong responses
 */
function detectConfidentlyWrong(userResponse: string, assessment: MedicalAssessment): boolean {
  if (assessment.isCorrect || assessment.confidence < 0.7) return false;
  
  const confidenceMarkers = [
    /^(definitely|absolutely|i'm sure|certainly)/i,
    /^(the answer is|it's clearly|obviously)/i,
    /\.$/, // Ends with period (confident tone)
    /^(yes,|no,)/i // Definitive answers
  ];
  
  return confidenceMarkers.some(pattern => pattern.test(userResponse.trim()));
}

/**
 * Types for Phase 1 refactor
 */
interface MedicalAssessment {
  isCorrect: boolean;
  confidence: number; // 0-1
  missingConcepts: string[];
  assessmentType: 'correct' | 'incorrect' | 'partial' | 'struggling' | 'insufficient';
  reasoning: string;
}

interface OrchestrationResult {
  nextAction: NextAction;
  reasoning: string;
  shouldContinueSubtopic: boolean;
  statusUpdate: Partial<SubtopicStatus>;
}

/**
 * Phase 1 Refactor: New Clean Assessment Function
 * Replaces the complex assessUserResponse with separated concerns
 */
export async function assessUserResponseV2(
  userResponse: string, 
  context: CarsonSessionContext
): Promise<AssessmentResult | null> {
  
  // Step 1: Classify interaction type (existing function)
  const interaction = classifyInteraction(userResponse, context);
  
  // Step 2: Handle conversational responses early
  if (isConversationalResponse(userResponse, context.history.slice(-1)[0]?.content)) {
    return null; // Don't assess conversational responses
  }
  
  // Step 3: Get current subtopic info
  const currentSubtopic = context.subtopics[context.currentSubtopicIndex];
  const subtopicTitle = currentSubtopic?.title || "Unknown Subtopic";
  const requirements = generateSubtopicRequirements(subtopicTitle, context.topic || "Medical Topic");
  
  // Step 4: Get expected concepts for this subtopic
  const expectedConcepts = getExpectedConcepts(subtopicTitle, context.topic || "Medical Topic");
  
  // Step 5: FOCUSED medical assessment (single responsibility)
  const medicalAssessment = await assessMedicalAccuracy(
    userResponse, 
    subtopicTitle, 
    context.topic || "Medical Topic",
    expectedConcepts
  );
  
  // Step 6: Get current subtopic status
  const status: SubtopicStatus = currentSubtopic.triagingStatus || initializeSubtopicStatus();
  
  // Step 7: PURE orchestration logic (no LLM calls)
  const orchestration = determineNextAction(medicalAssessment, interaction, status, context);
  
  // Step 8: Map to legacy AssessmentResult format for compatibility
  return {
    answerQuality: mapToAnswerQuality(medicalAssessment),
    nextAction: orchestration.nextAction,
    reasoning: orchestration.reasoning,
    isStruggling: medicalAssessment.assessmentType === 'struggling',
    specificGaps: medicalAssessment.missingConcepts.join(', ') || undefined,
    interactionType: interaction.type,
    currentPhase: getCurrentPhase(status, medicalAssessment),
    statusUpdate: orchestration.statusUpdate
  } as AssessmentResult & { interactionType: InteractionType };
}

/**
 * Helper: Get expected concepts for a subtopic
 */
function getExpectedConcepts(subtopicTitle: string, topic: string): string[] {
  const title = subtopicTitle.toLowerCase();
  const topicLower = topic.toLowerCase();
  
  // Build expected concepts based on subtopic type
  const concepts: string[] = [];
  
  if (title.includes('definition') || title.includes('types')) {
    concepts.push(`Definition of ${topic}`, `Classification system`, `Key characteristics`);
  }
  
  if (title.includes('risk') || title.includes('factor')) {
    concepts.push(`Major risk factors`, `Population at risk`, `Preventable factors`);
  }
  
  if (title.includes('pathophysio') || title.includes('mechanism')) {
    concepts.push(`Underlying mechanism`, `Physiological process`, `Cascade of events`);
  }
  
  if (title.includes('presentation') || title.includes('clinical')) {
    concepts.push(`Classic symptoms`, `Physical exam findings`, `Clinical presentation patterns`);
  }
  
  if (title.includes('diagnos') || title.includes('workup')) {
    concepts.push(`Diagnostic criteria`, `Key tests`, `Differential diagnosis`);
  }
  
  if (title.includes('management') || title.includes('treatment')) {
    concepts.push(`First-line treatment`, `Management priorities`, `Monitoring parameters`);
  }
  
  return concepts.length > 0 ? concepts : [`Core ${topic} concepts`];
}

/**
 * Helper: Map medical assessment to legacy AnswerQuality
 */
function mapToAnswerQuality(assessment: MedicalAssessment): AnswerQuality {
  switch (assessment.assessmentType) {
    case 'correct': return assessment.confidence > 0.8 ? 'excellent' : 'good';
    case 'partial': return 'partial';
    case 'struggling': return 'confused';
    case 'insufficient': return 'confused';
    case 'incorrect': return 'incorrect';
    default: return 'partial';
  }
}

/**
 * Helper: Determine current assessment phase
 */
function getCurrentPhase(status: SubtopicStatus, assessment: MedicalAssessment): AssessmentPhase {
  if (!status.hasInitialAssessment) return 'initial_assessment';
  if (status.gapAnalysis?.criticalGaps && status.gapAnalysis.criticalGaps.length > 0) return 'targeted_remediation';
  if (!status.hasTestedApplication) return 'application';
  return 'complete';
}

/**
 * Phase 2: Fresh Subtopic Memory System
 * Clean slate for each subtopic to reduce cognitive load on LLM
 */

/**
 * Reset context for a new subtopic - fresh start approach
 */
export function resetSubtopicContext(
  currentSession: CarsonSessionContext,
  newSubtopicIndex: number
): Partial<CarsonSessionContext> {
  const newSubtopic = currentSession.subtopics[newSubtopicIndex];
  
  if (!newSubtopic) {
    throw new Error(`Subtopic at index ${newSubtopicIndex} not found`);
  }

  // Keep only essential context, discard conversation history
  const freshContext: Partial<CarsonSessionContext> = {
    currentSubtopicIndex: newSubtopicIndex,
    currentSubtopicState: 'assessing',
    questionsAskedInCurrentSubtopic: 0,
    correctAnswersInCurrentSubtopic: 0,
    currentQuestionType: 'follow_up',
    shouldTransition: false,
    
    // Fresh history - only keep topic introduction, discard subtopic conversations
    history: currentSession.history.slice(0, 2), // Keep initial topic setup only
    
    // Reset current subtopic status
    subtopics: currentSession.subtopics.map((subtopic, index) => {
      if (index === newSubtopicIndex) {
        return {
          ...subtopic,
          triagingStatus: initializeSubtopicStatus(),
          history: [], // Fresh conversation history for this subtopic
          questionsAsked: 0,
          correctAnswers: 0,
          needsExplanation: false,
          status: 'unassessed' as const
        };
      }
      return subtopic; // Keep other subtopics unchanged
    })
  };

  return freshContext;
}

/**
 * Phase 2: Parallel Processing for Assessment
 * Run multiple assessment tasks simultaneously
 */
export async function assessUserResponseV2Parallel(
  userResponse: string,
  context: CarsonSessionContext
): Promise<AssessmentResult | null> {
  
  // Step 1: Start parallel operations
  const parallelTasks = Promise.all([
    // Task 1: Classify interaction type
    Promise.resolve(classifyInteraction(userResponse, context)),
    
    // Task 2: Check if conversational
    Promise.resolve(isConversationalResponse(userResponse, context.history.slice(-1)[0]?.content)),
    
    // Task 3: Get subtopic info and requirements
    Promise.resolve({
      currentSubtopic: context.subtopics[context.currentSubtopicIndex],
      requirements: generateSubtopicRequirements(
        context.subtopics[context.currentSubtopicIndex]?.title || "Unknown",
        context.topic || "Medical Topic"
      )
    })
  ]);

  const [interaction, isConversational, subtopicInfo] = await parallelTasks;

  // Early return for conversational responses
  if (isConversational) {
    return null;
  }

  const { currentSubtopic, requirements } = subtopicInfo;
  const subtopicTitle = currentSubtopic?.title || "Unknown Subtopic";

  // Step 2: Parallel medical assessment and concept generation
  const assessmentTasks = Promise.all([
    // Task 1: Medical assessment (focused LLM call) - using original stable function
    assessMedicalAccuracy(
      userResponse,
      subtopicTitle,
      context.topic || "Medical Topic",
      getExpectedConcepts(subtopicTitle, context.topic || "Medical Topic")
    ),
    
    // Task 2: Get current subtopic status
    Promise.resolve(currentSubtopic.triagingStatus || initializeSubtopicStatus())
  ]);

  const [medicalAssessment, status] = await assessmentTasks;

  // Step 3: Pure orchestration logic (no LLM calls)
  const orchestration = determineNextAction(medicalAssessment, interaction, status, context);

  // Step 4: Return result
  return {
    answerQuality: mapToAnswerQuality(medicalAssessment),
    nextAction: orchestration.nextAction,
    reasoning: orchestration.reasoning,
    isStruggling: medicalAssessment.assessmentType === 'struggling',
    specificGaps: medicalAssessment.missingConcepts.join(', ') || undefined,
    interactionType: interaction.type,
    currentPhase: getCurrentPhase(status, medicalAssessment),
    statusUpdate: orchestration.statusUpdate
  } as AssessmentResult & { interactionType: InteractionType };
}

/**
 * Phase 2: Cached Prompt Templates for Speed
 */
const CACHED_PROMPT_TEMPLATES = new Map<string, string>();

export function getCachedPromptTemplate(
  templateKey: string,
  generator: () => string
): string {
  if (!CACHED_PROMPT_TEMPLATES.has(templateKey)) {
    CACHED_PROMPT_TEMPLATES.set(templateKey, generator());
  }
  return CACHED_PROMPT_TEMPLATES.get(templateKey)!;
}

/**
 * Pre-generate expected concepts for common subtopic patterns
 */
const CONCEPT_CACHE = new Map<string, string[]>();

function getCachedExpectedConcepts(subtopicTitle: string, topic: string): string[] {
  const cacheKey = `${topic.toLowerCase()}_${subtopicTitle.toLowerCase()}`;
  
  if (!CONCEPT_CACHE.has(cacheKey)) {
    const concepts = getExpectedConcepts(subtopicTitle, topic);
    CONCEPT_CACHE.set(cacheKey, concepts);
  }
  
  return CONCEPT_CACHE.get(cacheKey)!;
}

/**
 * Phase 2: Optimized Medical Assessment with Caching
 */
async function assessMedicalAccuracyOptimized(
  userResponse: string,
  subtopicTitle: string,
  topic: string,
  expectedConcepts?: string[]
): Promise<MedicalAssessment> {
  
  // Quick checks first (no LLM needed)
  if (isStruggling(userResponse)) {
    return {
      isCorrect: false,
      confidence: 0.9,
      missingConcepts: expectedConcepts || [],
      assessmentType: 'struggling',
      reasoning: 'Student appears confused or struggling'
    };
  }

  if (!userResponse?.trim() || userResponse.trim().length < 3) {
    return {
      isCorrect: false,
      confidence: 0.8,
      missingConcepts: expectedConcepts || [],
      assessmentType: 'insufficient',
      reasoning: 'Response too brief for assessment'
    };
  }

  // Use cached prompt template
  const promptTemplate = getCachedPromptTemplate(
    'medical_assessment',
    () => `Assess this medical response for accuracy about {subtopic} in the context of {topic}.

Student Response: "{userResponse}"
{expectedConceptsSection}

Evaluate ONLY medical accuracy and completeness. Respond in JSON format:
{
  "isCorrect": boolean,
  "confidence": 0.0-1.0,
  "missingConcepts": ["concept1", "concept2"],
  "reasoning": "Brief explanation of accuracy assessment"
}

Assessment:`
  );

  // Fill template efficiently
  const assessmentPrompt = promptTemplate
    .replace('{subtopic}', subtopicTitle)
    .replace('{topic}', topic)
    .replace('{userResponse}', userResponse)
    .replace('{expectedConceptsSection}', 
      expectedConcepts ? `Expected Key Concepts: ${expectedConcepts.join(', ')}` : ''
    );

  // Use the same reliable hybrid assessment for consistency
  return hybridMedicalAssessment(userResponse, expectedConcepts, subtopicTitle, topic);
}

/**
 * Phase 2: Session Transition Management
 */
export function transitionToNextSubtopic(
  session: CarsonSessionContext,
  completedSubtopicIndex: number
): Partial<CarsonSessionContext> {
  
  const nextIndex = completedSubtopicIndex + 1;
  
  // Mark current subtopic as complete
  const updatedSubtopics = [...session.subtopics];
  if (updatedSubtopics[completedSubtopicIndex]) {
    updatedSubtopics[completedSubtopicIndex] = {
      ...updatedSubtopics[completedSubtopicIndex],
      status: 'understood' as const
    };
  }

  // Check if we've completed all subtopics
  if (nextIndex >= session.subtopics.length) {
    return {
      subtopics: updatedSubtopics,
      isComplete: true,
      shouldTransition: false
    };
  }

  // Fresh context for next subtopic
  const freshContext = resetSubtopicContext(
    { ...session, subtopics: updatedSubtopics },
    nextIndex
  );

  return {
    ...freshContext,
    subtopics: updatedSubtopics
  };
}

/**
 * HYBRID INTELLIGENCE ASSESSMENT ENGINE
 * Combines multiple assessment strategies for accuracy and speed
 */

// Enhanced Medical Terminology Database
const MEDICAL_VOCABULARY = {
  // Basic medical terms
  basic: ['patient', 'diagnosis', 'treatment', 'symptom', 'condition', 'clinical', 'medical', 'disease', 'syndrome'],
  
  // Advanced medical terminology
  advanced: ['pathophysiology', 'etiology', 'prognosis', 'differential', 'manifestation', 'comorbidity', 
             'contraindication', 'therapeutic', 'pharmacokinetics', 'biomarker', 'phenotype'],
  
  // Process and mechanism terms
  process: ['mechanism', 'process', 'pathway', 'cascade', 'regulation', 'metabolism', 'synthesis', 
            'degradation', 'signaling', 'feedback', 'homeostasis'],
  
  // Anatomy and physiology
  anatomy: ['organ', 'tissue', 'system', 'structure', 'function', 'anatomical', 'physiological', 
            'cellular', 'molecular', 'vascular', 'neural', 'muscular'],
  
  // Clinical practice terms
  clinical: ['assessment', 'evaluation', 'examination', 'investigation', 'intervention', 'monitoring', 
             'follow-up', 'referral', 'consultation', 'management', 'protocol'],
  
  // Pharmacology
  pharmacology: ['medication', 'drug', 'therapeutic', 'dosage', 'administration', 'absorption', 
                 'distribution', 'elimination', 'half-life', 'interaction', 'adverse', 'contraindication'],
  
  // Research and evidence
  evidence: ['study', 'research', 'evidence', 'trial', 'efficacy', 'effectiveness', 'outcome', 
             'statistical', 'significant', 'correlation', 'causation', 'meta-analysis'],

  // Cardiovascular
  cardiovascular: ['cardiac', 'heart', 'coronary', 'vascular', 'blood pressure', 'hypertension', 'hypotension',
                   'arrhythmia', 'myocardial', 'ischemia', 'stenosis', 'atherosclerosis', 'embolism'],
  
  // Respiratory
  respiratory: ['pulmonary', 'lung', 'respiratory', 'airway', 'ventilation', 'oxygenation', 'pneumonia',
                'asthma', 'copd', 'bronchial', 'alveolar', 'pleural'],
  
  // Neurological
  neurological: ['neurological', 'brain', 'spinal', 'neuron', 'synaptic', 'cognitive', 'seizure',
                 'stroke', 'meningitis', 'encephalitis', 'neuropathy'],
  
  // Gastrointestinal
  gastrointestinal: ['gastrointestinal', 'hepatic', 'gastric', 'intestinal', 'digestive', 'bowel',
                     'liver', 'pancreatic', 'biliary', 'peptic', 'inflammatory'],
  
  // Endocrine
  endocrine: ['hormonal', 'endocrine', 'diabetes', 'thyroid', 'insulin', 'glucose', 'metabolic',
              'adrenal', 'pituitary', 'pancreatic', 'hormone'],
  
  // Obstetrics/Gynecology
  obstetric: ['pregnancy', 'prenatal', 'fetal', 'maternal', 'obstetric', 'gynecological', 'uterine',
              'placental', 'cervical', 'ovarian', 'menstrual', 'preeclampsia', 'eclampsia'],
  
  // Infectious Disease
  infectious: ['infection', 'bacterial', 'viral', 'fungal', 'antibiotic', 'antimicrobial', 'sepsis',
               'immunocompromised', 'pathogen', 'microorganism', 'contagious'],
  
  // Oncology
  oncology: ['cancer', 'malignant', 'benign', 'tumor', 'metastasis', 'carcinoma', 'chemotherapy',
             'radiation', 'oncology', 'biopsy', 'staging', 'prognosis']
};

// Enhanced Topic-Specific Knowledge Patterns
const TOPIC_SPECIFIC_PATTERNS = {
  // Preeclampsia-specific patterns
  preeclampsia: {
    keyTerms: ['preeclampsia', 'eclampsia', 'hellp', 'proteinuria', 'hypertension', 'placenta', 'maternal', 'fetal'],
    mechanisms: ['placental dysfunction', 'endothelial dysfunction', 'vasospasm', 'inflammatory response'],
    symptoms: ['headache', 'visual disturbances', 'epigastric pain', 'edema', 'oliguria'],
    complications: ['seizures', 'stroke', 'liver dysfunction', 'coagulopathy', 'fetal growth restriction'],
    management: ['magnesium sulfate', 'antihypertensive', 'delivery', 'corticosteroids', 'monitoring']
  },
  
  // Diabetes-specific patterns  
  diabetes: {
    keyTerms: ['diabetes', 'insulin', 'glucose', 'glycemic', 'hyperglycemia', 'hypoglycemia', 'hba1c'],
    mechanisms: ['insulin resistance', 'beta cell dysfunction', 'glucose metabolism', 'pancreatic'],
    symptoms: ['polyuria', 'polydipsia', 'polyphagia', 'fatigue', 'blurred vision'],
    complications: ['neuropathy', 'nephropathy', 'retinopathy', 'cardiovascular disease', 'ketoacidosis'],
    management: ['metformin', 'insulin therapy', 'lifestyle modification', 'blood glucose monitoring']
  },
  
  // Hypertension-specific patterns
  hypertension: {
    keyTerms: ['hypertension', 'blood pressure', 'systolic', 'diastolic', 'cardiovascular', 'vascular'],
    mechanisms: ['peripheral resistance', 'cardiac output', 'renin-angiotensin', 'sympathetic nervous system'],
    symptoms: ['asymptomatic', 'headache', 'dyspnea', 'chest pain', 'epistaxis'],
    complications: ['stroke', 'myocardial infarction', 'heart failure', 'kidney disease', 'retinopathy'],
    management: ['ace inhibitors', 'diuretics', 'calcium channel blockers', 'lifestyle changes']
  },
  
  // Asthma-specific patterns
  asthma: {
    keyTerms: ['asthma', 'bronchial', 'airway', 'respiratory', 'allergic', 'inflammatory'],
    mechanisms: ['bronchospasm', 'inflammation', 'mucus hypersecretion', 'airway remodeling'],
    symptoms: ['wheezing', 'dyspnea', 'chest tightness', 'cough', 'nocturnal symptoms'],
    complications: ['status asthmaticus', 'respiratory failure', 'pneumothorax', 'atelectasis'],
    management: ['bronchodilators', 'corticosteroids', 'leukotriene inhibitors', 'peak flow monitoring']
  }
};

// Clinical Decision-Making Patterns
const CLINICAL_REASONING_PATTERNS = {
  diagnostic: {
    positive: ['differential diagnosis', 'rule out', 'consider', 'workup', 'investigate', 'assess for',
               'clinical presentation', 'history and physical', 'laboratory studies', 'imaging'],
    negative: ['definitely', 'obviously', 'clearly', 'always', 'never', 'impossible', 'certain']
  },
  
  therapeutic: {
    positive: ['evidence-based', 'guidelines recommend', 'first-line', 'contraindicated', 'monitor for',
               'titrate', 'dose adjustment', 'side effects', 'efficacy', 'safety profile'],
    negative: ['cure', 'fix', 'heal completely', 'permanent solution', 'guarantee']
  },
  
  prognostic: {
    positive: ['prognosis depends', 'risk factors', 'outcome varies', 'long-term', 'surveillance',
               'follow-up', 'complications may include', 'mortality risk'],
    negative: ['will definitely', 'always fatal', 'completely benign', 'no risk']
  }
};

// Reasoning Pattern Database
const REASONING_PATTERNS = {
  // Causal reasoning
  causal: ['because', 'since', 'due to', 'caused by', 'results from', 'leads to', 'results in', 
           'triggers', 'induces', 'precipitates', 'contributes to'],
  
  // Comparative reasoning
  comparative: ['compared to', 'versus', 'rather than', 'instead of', 'unlike', 'similar to', 
                'differs from', 'in contrast', 'whereas', 'however'],
  
  // Conditional reasoning
  conditional: ['if', 'when', 'unless', 'provided that', 'assuming', 'given that', 'in case of', 
                'should', 'would', 'could', 'might'],
  
  // Sequential reasoning
  sequential: ['first', 'then', 'next', 'subsequently', 'following', 'after', 'before', 
               'initially', 'finally', 'eventually'],
  
  // Evidential reasoning
  evidential: ['indicates', 'suggests', 'demonstrates', 'shows', 'reveals', 'confirms', 
               'supports', 'contradicts', 'implies', 'establishes']
};

// Concept-Specific Assessment Patterns
const CONCEPT_PATTERNS = {
  pathophysiology: {
    requiredElements: ['mechanism', 'process', 'cascade', 'pathway', 'dysfunction'],
    positiveIndicators: ['cellular', 'molecular', 'biochemical', 'physiological', 'systemic'],
    negativeIndicators: ['simple', 'just', 'only', 'basic'],
    minimumLength: 40
  },
  
  diagnosis: {
    requiredElements: ['symptoms', 'signs', 'criteria', 'differential', 'assessment'],
    positiveIndicators: ['clinical', 'examination', 'investigation', 'evaluation', 'workup'],
    negativeIndicators: ['guess', 'assume', 'probably', 'maybe'],
    minimumLength: 30
  },
  
  treatment: {
    requiredElements: ['management', 'intervention', 'therapy', 'protocol', 'approach'],
    positiveIndicators: ['therapeutic', 'effective', 'evidence-based', 'guidelines', 'monitoring'],
    negativeIndicators: ['cure', 'fix', 'heal', 'make better'],
    minimumLength: 35
  },
  
  pharmacology: {
    requiredElements: ['mechanism', 'action', 'receptor', 'pathway', 'effect'],
    positiveIndicators: ['pharmacokinetics', 'pharmacodynamics', 'bioavailability', 'half-life'],
    negativeIndicators: ['works', 'helps', 'fixes', 'makes'],
    minimumLength: 30
  },
  
  risk_factors: {
    requiredElements: ['risk', 'factor', 'predispose', 'increase', 'likelihood'],
    positiveIndicators: ['epidemiological', 'statistical', 'association', 'correlation'],
    negativeIndicators: ['always', 'never', 'everyone', 'nobody'],
    minimumLength: 25
  }
};

/**
 * Hybrid Medical Assessment Engine
 * Combines multiple assessment strategies for optimal accuracy and speed
 */
function hybridMedicalAssessment(
  userResponse: string, 
  expectedConcepts?: string[],
  subtopicTitle?: string,
  topic?: string
): MedicalAssessment {
  const response = userResponse.toLowerCase().trim();
  const length = response.length;
  
  // Stage 1: Quick Quality Filters
  const quickFilters = applyQuickQualityFilters(response, length);
  if (quickFilters.shouldReturn) {
    return quickFilters.assessment!;
  }
  
  // Stage 2: Multi-Strategy Assessment
  const vocabularyScore = assessMedicalVocabulary(response);
  const reasoningScore = assessReasoningPatterns(response);
  const conceptScore = assessConceptSpecificPatterns(response, subtopicTitle, topic);
  const structureScore = assessResponseStructure(response, length);
  const accuracyScore = assessFactualAccuracy(response, expectedConcepts, subtopicTitle, topic);
  const clinicalReasoningScore = assessClinicalReasoningPatterns(response, subtopicTitle);
  
  // Stage 3: Confidence Weighting System
  const finalAssessment = combineAssessmentScores({
    vocabulary: vocabularyScore,
    reasoning: reasoningScore,
    concept: conceptScore,
    structure: structureScore,
    accuracy: accuracyScore,
    clinicalReasoning: clinicalReasoningScore
  }, expectedConcepts, response);
  
  return finalAssessment;
}

/**
 * Topic-Specific Pattern Assessment
 */
function assessTopicSpecificPatterns(response: string, topic?: string): AssessmentScore {
  if (!topic) {
    return { score: 0, confidence: 0.5, evidence: [], reasoning: 'No topic context provided' };
  }
  
  const topicKey = topic.toLowerCase();
  const topicPattern = TOPIC_SPECIFIC_PATTERNS[topicKey as keyof typeof TOPIC_SPECIFIC_PATTERNS];
  
  if (!topicPattern) {
    return { score: 0, confidence: 0.5, evidence: [], reasoning: 'No specific pattern for this topic' };
  }
  
  let score = 0;
  let evidence: string[] = [];
  const totalCategories = 5; // keyTerms, mechanisms, symptoms, complications, management
  
  // Check key terms (25% weight)
  const keyTermsFound = topicPattern.keyTerms.filter(term => response.includes(term));
  score += (keyTermsFound.length / topicPattern.keyTerms.length) * 0.25;
  evidence.push(...keyTermsFound.map(term => `key:${term}`));
  
  // Check mechanisms (25% weight)
  const mechanismsFound = topicPattern.mechanisms.filter(mechanism => 
    mechanism.split(' ').some(word => response.includes(word))
  );
  score += (mechanismsFound.length / topicPattern.mechanisms.length) * 0.25;
  evidence.push(...mechanismsFound.map(mech => `mech:${mech.split(' ')[0]}`));
  
  // Check symptoms (20% weight)
  const symptomsFound = topicPattern.symptoms.filter(symptom => response.includes(symptom));
  score += (symptomsFound.length / topicPattern.symptoms.length) * 0.2;
  evidence.push(...symptomsFound.map(symp => `symp:${symp}`));
  
  // Check complications (15% weight)
  const complicationsFound = topicPattern.complications.filter(comp => response.includes(comp));
  score += (complicationsFound.length / topicPattern.complications.length) * 0.15;
  evidence.push(...complicationsFound.map(comp => `comp:${comp}`));
  
  // Check management (15% weight)
  const managementFound = topicPattern.management.filter(mgmt => response.includes(mgmt));
  score += (managementFound.length / topicPattern.management.length) * 0.15;
  evidence.push(...managementFound.map(mgmt => `mgmt:${mgmt}`));
  
  const totalFound = keyTermsFound.length + mechanismsFound.length + symptomsFound.length + 
                    complicationsFound.length + managementFound.length;
  
  return {
    score: Math.min(score, 1),
    confidence: totalFound > 0 ? 0.8 : 0.3,
    evidence: evidence,
    reasoning: `Topic-specific patterns for ${topic}: ${totalFound} relevant elements found`
  };
}

/**
 * Clinical Reasoning Pattern Assessment
 */
function assessClinicalReasoningPatterns(response: string, subtopicTitle?: string): AssessmentScore {
  let score = 0;
  let evidence: string[] = [];
  
  // Determine the context (diagnostic, therapeutic, or prognostic)
  const context = identifyReasoningContext(subtopicTitle || '');
  const patterns = CLINICAL_REASONING_PATTERNS[context];
  
  if (!patterns) {
    return { score: 0.5, confidence: 0.5, evidence: [], reasoning: 'Unknown reasoning context' };
  }
  
  // Check for positive clinical reasoning indicators (80% weight)
  const positiveFound = patterns.positive.filter(pattern => response.includes(pattern));
  const positiveScore = Math.min(positiveFound.length / patterns.positive.length, 1) * 0.8;
  score += positiveScore;
  evidence.push(...positiveFound.map(p => `+${p}`));
  
  // Penalize negative indicators (20% penalty)
  const negativeFound = patterns.negative.filter(pattern => response.includes(pattern));
  const negativePenalty = (negativeFound.length / patterns.negative.length) * 0.2;
  score = Math.max(0, score - negativePenalty);
  evidence.push(...negativeFound.map(n => `-${n}`));
  
  // Bonus for clinical uncertainty language (appropriate in medical context)
  const uncertaintyPatterns = ['may', 'might', 'could', 'possible', 'likely', 'consider', 'suggest'];
  const uncertaintyFound = uncertaintyPatterns.filter(pattern => response.includes(pattern));
  if (uncertaintyFound.length > 0 && negativeFound.length === 0) {
    score += 0.1; // Small bonus for appropriate uncertainty
    evidence.push(...uncertaintyFound.map(u => `?${u}`));
  }
  
  return {
    score: Math.min(score, 1),
    confidence: positiveFound.length > 0 ? 0.75 : 0.4,
    evidence: evidence,
    reasoning: `Clinical reasoning (${context}): ${positiveFound.length} positive, ${negativeFound.length} negative indicators`
  };
}

function identifyReasoningContext(subtopicTitle: string): keyof typeof CLINICAL_REASONING_PATTERNS {
  const title = subtopicTitle.toLowerCase();
  
  if (title.includes('diagnosis') || title.includes('clinical') || title.includes('assessment')) {
    return 'diagnostic';
  }
  if (title.includes('treatment') || title.includes('management') || title.includes('therapy')) {
    return 'therapeutic';
  }
  if (title.includes('prognosis') || title.includes('outcome') || title.includes('complications')) {
    return 'prognostic';
  }
  
  return 'diagnostic'; // Default
}

/**
 * Stage 1: Quick Quality Filters
 */
function applyQuickQualityFilters(response: string, length: number): { shouldReturn: boolean; assessment?: MedicalAssessment } {
  // Struggling responses
  if (isStruggling(response)) {
    return {
      shouldReturn: true,
      assessment: {
        isCorrect: false,
        confidence: 0.9,
        missingConcepts: ['Student needs support and guidance'],
        assessmentType: 'struggling',
        reasoning: 'Student appears confused or struggling'
      }
    };
  }
  
  // Insufficient responses
  if (length < 3) {
    return {
      shouldReturn: true,
      assessment: {
        isCorrect: false,
        confidence: 0.8,
        missingConcepts: ['Response too brief for meaningful assessment'],
        assessmentType: 'insufficient',
        reasoning: 'Response too brief for assessment'
      }
    };
  }
  
  // Very short but potentially meaningful responses
  if (length < 15) {
    const shortMeaningfulPatterns = [
      /^(yes|no|correct|incorrect|true|false)$/,
      /^(acute|chronic|benign|malignant)$/,
      /^(hypertension|diabetes|cancer|infection)$/
    ];
    
    if (!shortMeaningfulPatterns.some(pattern => pattern.test(response))) {
      return {
        shouldReturn: true,
        assessment: {
          isCorrect: false,
          confidence: 0.7,
          missingConcepts: ['Need more detailed explanation'],
          assessmentType: 'insufficient',
          reasoning: 'Response too brief to demonstrate understanding'
        }
      };
    }
  }
  
  return { shouldReturn: false };
}

/**
 * Stage 2A: Medical Vocabulary Assessment
 */
function assessMedicalVocabulary(response: string): AssessmentScore {
  let score = 0;
  let maxScore = 0;
  let evidence: string[] = [];
  
  // Check each vocabulary category
  Object.entries(MEDICAL_VOCABULARY).forEach(([category, terms]) => {
    const categoryWeight = getCategoryWeight(category);
    const foundTerms = terms.filter(term => response.includes(term));
    
    if (foundTerms.length > 0) {
      const categoryScore = Math.min(foundTerms.length / terms.length, 1) * categoryWeight;
      score += categoryScore;
      evidence.push(...foundTerms);
    }
    
    maxScore += categoryWeight;
  });
  
  const normalizedScore = score / maxScore;
  
  return {
    score: normalizedScore,
    confidence: normalizedScore > 0.3 ? 0.8 : 0.6,
    evidence: evidence,
    reasoning: `Medical vocabulary usage: ${evidence.length} relevant terms found`
  };
}

/**
 * Stage 2B: Reasoning Pattern Assessment
 */
function assessReasoningPatterns(response: string): AssessmentScore {
  let score = 0;
  let maxScore = 0;
  let evidence: string[] = [];
  
  // Check each reasoning pattern category
  Object.entries(REASONING_PATTERNS).forEach(([category, patterns]) => {
    const categoryWeight = getReasoningWeight(category);
    const foundPatterns = patterns.filter(pattern => response.includes(pattern));
    
    if (foundPatterns.length > 0) {
      const categoryScore = Math.min(foundPatterns.length / patterns.length, 1) * categoryWeight;
      score += categoryScore;
      evidence.push(...foundPatterns);
    }
    
    maxScore += categoryWeight;
  });
  
  const normalizedScore = score / maxScore;
  
  return {
    score: normalizedScore,
    confidence: normalizedScore > 0.2 ? 0.7 : 0.5,
    evidence: evidence,
    reasoning: `Reasoning patterns: ${evidence.length} logical connectors found`
  };
}

/**
 * Stage 2C: Concept-Specific Pattern Assessment with Topic-Awareness
 */
function assessConceptSpecificPatterns(response: string, subtopicTitle?: string, topic?: string): AssessmentScore {
  if (!subtopicTitle) {
    return { score: 0.5, confidence: 0.5, evidence: [], reasoning: 'No specific concept context provided' };
  }
  
  // Determine concept type from subtopic
  const conceptType = identifyConceptType(subtopicTitle);
  const pattern = CONCEPT_PATTERNS[conceptType];
  
  if (!pattern) {
    return { score: 0.5, confidence: 0.5, evidence: [], reasoning: 'Unknown concept type' };
  }
  
  let score = 0;
  let evidence: string[] = [];
  
  // Check required elements
  const requiredFound = pattern.requiredElements.filter(element => response.includes(element));
  const requiredScore = requiredFound.length / pattern.requiredElements.length;
  score += requiredScore * 0.4; // 40% weight for required elements
  evidence.push(...requiredFound);
  
  // Check positive indicators
  const positiveFound = pattern.positiveIndicators.filter(indicator => response.includes(indicator));
  const positiveScore = Math.min(positiveFound.length / pattern.positiveIndicators.length, 1);
  score += positiveScore * 0.3; // 30% weight for positive indicators
  evidence.push(...positiveFound);
  
  // **NEW**: Topic-specific pattern matching
  const topicSpecificScore = assessTopicSpecificPatterns(response, topic);
  score += topicSpecificScore.score * 0.2; // 20% weight for topic-specific patterns
  evidence.push(...topicSpecificScore.evidence);
  
  // Check negative indicators (penalize)
  const negativeFound = pattern.negativeIndicators.filter(indicator => response.includes(indicator));
  const negativePenalty = negativeFound.length / pattern.negativeIndicators.length * 0.1; // Reduced penalty
  score = Math.max(0, score - negativePenalty);
  
  // Length requirement
  const lengthBonus = response.length >= pattern.minimumLength ? 0.1 : 0;
  score += lengthBonus;
  
  return {
    score: Math.min(score, 1),
    confidence: requiredFound.length > 0 || topicSpecificScore.score > 0.3 ? 0.8 : 0.4,
    evidence: evidence,
    reasoning: `Concept-specific assessment for ${conceptType}: ${evidence.length} relevant elements${topicSpecificScore.score > 0 ? ' + topic-specific patterns' : ''}`
  };
}

/**
 * Stage 2D: Response Structure Assessment
 */
function assessResponseStructure(response: string, length: number): AssessmentScore {
  let score = 0;
  let evidence: string[] = [];
  
  // Length scoring (optimal range: 30-150 characters)
  const lengthScore = length >= 30 && length <= 150 ? 1 : 
                     length >= 15 && length <= 200 ? 0.7 : 0.4;
  score += lengthScore * 0.3;
  
  // Sentence structure
  const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 5);
  const sentenceScore = sentences.length >= 2 ? 1 : sentences.length === 1 ? 0.7 : 0.3;
  score += sentenceScore * 0.2;
  
  // Coherence indicators
  const coherenceMarkers = ['first', 'second', 'also', 'additionally', 'furthermore', 'moreover', 'however', 'therefore'];
  const foundCoherence = coherenceMarkers.filter(marker => response.includes(marker));
  const coherenceScore = Math.min(foundCoherence.length / 3, 1);
  score += coherenceScore * 0.2;
  evidence.push(...foundCoherence);
  
  // Specificity indicators
  const specificityMarkers = ['specifically', 'particularly', 'especially', 'notably', 'primarily', 'mainly'];
  const foundSpecificity = specificityMarkers.filter(marker => response.includes(marker));
  const specificityScore = Math.min(foundSpecificity.length / 2, 1);
  score += specificityScore * 0.15;
  evidence.push(...foundSpecificity);
  
  // Precision indicators (numbers, percentages, specific terms)
  const precisionPatterns = [/\d+/, /%/, /\b(high|low|increased|decreased)\b/];
  const precisionFound = precisionPatterns.filter(pattern => pattern.test(response));
  const precisionScore = Math.min(precisionFound.length / 2, 1);
  score += precisionScore * 0.15;
  
  return {
    score: Math.min(score, 1),
    confidence: 0.7,
    evidence: evidence,
    reasoning: `Structure assessment: ${sentences.length} sentences, ${evidence.length} organizational markers`
  };
}

/**
 * Stage 2E: Factual Accuracy Assessment
 */
function assessFactualAccuracy(response: string, expectedConcepts?: string[], subtopicTitle?: string, topic?: string): AssessmentScore {
  if (!expectedConcepts || expectedConcepts.length === 0) {
    return { score: 0.5, confidence: 0.3, evidence: [], reasoning: 'No expected concepts provided for comparison' };
  }
  
  let score = 0;
  let evidence: string[] = [];
  
  // Direct concept matching
  const directMatches = expectedConcepts.filter(concept => 
    response.includes(concept.toLowerCase())
  );
  evidence.push(...directMatches);
  
  // Semantic concept matching (simple keyword matching)
  const semanticMatches = expectedConcepts.filter(concept => {
    const keywords = concept.toLowerCase().split(/\s+/);
    return keywords.some(keyword => response.includes(keyword));
  });
  
  const uniqueSemanticMatches = semanticMatches.filter(match => !directMatches.includes(match));
  evidence.push(...uniqueSemanticMatches.map(match => `~${match}`));
  
  // Calculate accuracy score
  const totalMatches = directMatches.length + (uniqueSemanticMatches.length * 0.5);
  score = Math.min(totalMatches / expectedConcepts.length, 1);
  
  // Bonus for comprehensive coverage
  if (score > 0.7) {
    score = Math.min(score + 0.1, 1);
  }
  
  return {
    score: score,
    confidence: directMatches.length > 0 ? 0.8 : 0.4,
    evidence: evidence,
    reasoning: `Factual accuracy: ${directMatches.length} direct + ${uniqueSemanticMatches.length} semantic matches`
  };
}

/**
 * Stage 3: Confidence Weighting System
 */
function combineAssessmentScores(
  scores: {
    vocabulary: AssessmentScore;
    reasoning: AssessmentScore;
    concept: AssessmentScore;
    structure: AssessmentScore;
    accuracy: AssessmentScore;
    clinicalReasoning: AssessmentScore;
  },
  expectedConcepts?: string[],
  response?: string
): MedicalAssessment {
  
  // Dynamic weighting based on available information
  const weights = calculateDynamicWeights(scores, expectedConcepts);
  
  // Calculate weighted score
  const weightedScore = 
    scores.vocabulary.score * weights.vocabulary +
    scores.reasoning.score * weights.reasoning +
    scores.concept.score * weights.concept +
    scores.structure.score * weights.structure +
    scores.accuracy.score * weights.accuracy +
    scores.clinicalReasoning.score * weights.clinicalReasoning;
  
  // Calculate overall confidence
  const overallConfidence = Math.min(
    (scores.vocabulary.confidence * weights.vocabulary +
     scores.reasoning.confidence * weights.reasoning +
     scores.concept.confidence * weights.concept +
     scores.structure.confidence * weights.structure +
     scores.accuracy.confidence * weights.accuracy +
     scores.clinicalReasoning.confidence * weights.clinicalReasoning), 1
  );
  
  // Determine assessment type and correctness
  const { isCorrect, assessmentType, missingConcepts } = determineAssessmentOutcome(
    weightedScore, 
    overallConfidence, 
    scores, 
    expectedConcepts
  );
  
  // Generate comprehensive reasoning
  const reasoning = generateHybridReasoning(scores, weightedScore, overallConfidence);
  
  return {
    isCorrect,
    confidence: overallConfidence,
    missingConcepts,
    assessmentType,
    reasoning
  };
}

/**
 * Helper Functions
 */

interface AssessmentScore {
  score: number;
  confidence: number;
  evidence: string[];
  reasoning: string;
}

function getCategoryWeight(category: string): number {
  const weights: Record<string, number> = {
    basic: 0.1,
    advanced: 0.3,
    process: 0.25,
    anatomy: 0.2,
    clinical: 0.25,
    pharmacology: 0.3,
    evidence: 0.2,
    // Domain-specific vocabularies
    cardiovascular: 0.35,
    respiratory: 0.35,
    neurological: 0.35,
    gastrointestinal: 0.35,
    endocrine: 0.35,
    obstetric: 0.35,
    infectious: 0.35,
    oncology: 0.35
  };
  return weights[category] || 0.1;
}

function getReasoningWeight(category: string): number {
  const weights: Record<string, number> = {
    causal: 0.3,
    comparative: 0.2,
    conditional: 0.15,
    sequential: 0.2,
    evidential: 0.25
  };
  return weights[category] || 0.1;
}

function identifyConceptType(subtopicTitle: string): keyof typeof CONCEPT_PATTERNS {
  const title = subtopicTitle.toLowerCase();
  
  if (title.includes('pathophysiology') || title.includes('mechanism')) return 'pathophysiology';
  if (title.includes('diagnosis') || title.includes('clinical')) return 'diagnosis';
  if (title.includes('treatment') || title.includes('management')) return 'treatment';
  if (title.includes('pharmacology') || title.includes('drug')) return 'pharmacology';
  if (title.includes('risk') || title.includes('factor')) return 'risk_factors';
  
  return 'pathophysiology'; // Default
}

function calculateDynamicWeights(
  scores: any,
  expectedConcepts?: string[]
): { vocabulary: number; reasoning: number; concept: number; structure: number; accuracy: number; clinicalReasoning: number } {
  
  // Base weights
  let weights = {
    vocabulary: 0.2,
    reasoning: 0.2,
    concept: 0.2,
    structure: 0.1,
    accuracy: 0.1,
    clinicalReasoning: 0.2
  };
  
  // Adjust based on available information
  if (expectedConcepts && expectedConcepts.length > 0) {
    weights.accuracy = 0.25;
    weights.vocabulary = 0.15;
    weights.reasoning = 0.15;
    weights.concept = 0.15;
    weights.structure = 0.1;
    weights.clinicalReasoning = 0.2;
  }
  
  // Boost high-confidence scores
  if (scores.concept.confidence > 0.8) {
    weights.concept += 0.1;
    weights.structure -= 0.05;
    weights.vocabulary -= 0.05;
  }
  
  // Boost clinical reasoning for clinical topics
  if (scores.clinicalReasoning && scores.clinicalReasoning.confidence > 0.7) {
    weights.clinicalReasoning += 0.1;
    weights.structure -= 0.05;
    weights.vocabulary -= 0.05;
  }
  
  return weights;
}

function determineAssessmentOutcome(
  weightedScore: number,
  confidence: number,
  scores: any,
  expectedConcepts?: string[]
): { isCorrect: boolean; assessmentType: MedicalAssessment['assessmentType']; missingConcepts: string[] } {
  
  // High confidence, high score
  if (confidence > 0.7 && weightedScore > 0.7) {
    return {
      isCorrect: true,
      assessmentType: 'correct',
      missingConcepts: []
    };
  }
  
  // Medium confidence/score
  if (confidence > 0.5 && weightedScore > 0.4) {
    const missingConcepts = generateMissingConcepts(scores, expectedConcepts);
    return {
      isCorrect: false,
      assessmentType: 'partial',
      missingConcepts
    };
  }
  
  // Low performance
  if (weightedScore < 0.3 || confidence < 0.4) {
    return {
      isCorrect: false,
      assessmentType: 'incorrect',
      missingConcepts: expectedConcepts || ['Fundamental concepts need review']
    };
  }
  
  // Default case
  return {
    isCorrect: false,
    assessmentType: 'partial',
    missingConcepts: generateMissingConcepts(scores, expectedConcepts)
  };
}

function generateMissingConcepts(scores: any, expectedConcepts?: string[]): string[] {
  const missing: string[] = [];
  
  if (scores.vocabulary.score < 0.3) {
    missing.push('Medical terminology needs improvement');
  }
  
  if (scores.reasoning.score < 0.3) {
    missing.push('Logical reasoning and connections');
  }
  
  if (scores.concept.score < 0.4) {
    missing.push('Key concept understanding');
  }
  
  if (scores.accuracy.score < 0.5 && expectedConcepts) {
    missing.push('Specific factual knowledge');
  }
  
  return missing.length > 0 ? missing : ['Areas for improvement identified'];
}

function generateHybridReasoning(scores: any, weightedScore: number, confidence: number): string {
  const components: string[] = [];
  
  if (scores.vocabulary.score > 0.5) {
    components.push(`Strong medical vocabulary (${scores.vocabulary.evidence.length} terms)`);
  }
  
  if (scores.reasoning.score > 0.4) {
    components.push(`Good logical reasoning (${scores.reasoning.evidence.length} patterns)`);
  }
  
  if (scores.concept.score > 0.5) {
    components.push(`Appropriate concept understanding`);
  }
  
  if (scores.accuracy.score > 0.6) {
    components.push(`Factually accurate content`);
  }
  
  const baseReasoning = components.length > 0 
    ? `Hybrid assessment: ${components.join(', ')}` 
    : 'Basic assessment completed';
  
  return `${baseReasoning} (Score: ${(weightedScore * 100).toFixed(0)}%, Confidence: ${(confidence * 100).toFixed(0)}%)`;
}

