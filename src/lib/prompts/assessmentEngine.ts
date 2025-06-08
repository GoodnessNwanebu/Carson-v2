import { CarsonSessionContext } from './carsonTypes';
import { callLLM } from './llm-service';

// Assessment types
export type AnswerQuality = 'excellent' | 'good' | 'partial' | 'incorrect' | 'confused';
export type NextAction = 'continue_conversation' | 'give_cue' | 'explain' | 'check_understanding' | 'complete_subtopic';

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
  const assessmentPrompt = `You are a medical education expert analyzing a student's comprehensive response about ${subtopicTitle} in the context of ${topic}.

**Student's Response**: ${userResponse}

Analyze their response and categorize ALL knowledge gaps:

CRITICAL GAPS (fundamental/dangerous misconceptions that must be addressed):
- Core pathophysiology they misunderstood
- Dangerous clinical misconceptions
- Fundamental mechanisms they missed

IMPORTANT GAPS (common/clinically relevant areas they should know):
- Common factors/presentations they missed
- Standard diagnostic/treatment approaches not mentioned
- Clinically relevant details they're unclear about

MINOR GAPS (nice-to-know but not immediately critical):
- Rare conditions/factors they didn't mention
- Academic details that aren't clinically essential
- Advanced nuances they haven't learned yet

STRENGTH AREAS (things they clearly understand well):
- Areas they explained correctly and confidently
- Good clinical reasoning they demonstrated

Respond in JSON format:
{
  "criticalGaps": ["list of critical gaps"],
  "importantGaps": ["list of important gaps"], 
  "minorGaps": ["list of minor gaps"],
  "strengthAreas": ["list of strength areas"]
}`;

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
    
    if (!response?.content) {
      throw new Error('No response from LLM');
    }
    
    const parsed = JSON.parse(response.content);
    return {
      criticalGaps: parsed.criticalGaps || [],
      importantGaps: parsed.importantGaps || [],
      minorGaps: parsed.minorGaps || [],
      strengthAreas: parsed.strengthAreas || []
    };
  } catch (error) {
    console.error('Gap analysis failed:', error);
    // Fallback to simple gap identification
    return {
      criticalGaps: [],
      importantGaps: ['Understanding needs clarification'],
      minorGaps: [],
      strengthAreas: []
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
  
  // Get or initialize subtopic status (this would need to be stored in context in a real implementation)
  const status: SubtopicStatus = (subtopic as any).subtopicStatus || initializeSubtopicStatus();
  
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

// **LEGACY**: Simplified version for backwards compatibility
function determineNextAction(answerQuality: AnswerQuality, context: CarsonSessionContext): NextAction {
  const { questionsAskedInCurrentSubtopic, correctAnswersInCurrentSubtopic, currentSubtopicState } = context;
  
  // **HIGHER STANDARDS**: More rigorous requirements like a real attending
  const hasMinimumCorrectAnswers = correctAnswersInCurrentSubtopic >= 3; // Raised from 2
  const hasAskedEnoughQuestions = questionsAskedInCurrentSubtopic >= 3;   // Raised from 2
  const hasGoodSuccessRate = correctAnswersInCurrentSubtopic / Math.max(questionsAskedInCurrentSubtopic, 1) >= 0.8; // Raised from 0.6
  const meetsMasteryThreshold = hasMinimumCorrectAnswers && hasAskedEnoughQuestions && hasGoodSuccessRate;
  
  switch (currentSubtopicState) {
    case 'assessing':
        switch (answerQuality) {
          case 'excellent':
          case 'good':
          // Carson keeps probing until confident they really understand
            if (meetsMasteryThreshold) {
              return 'complete_subtopic';
            } else {
            return 'continue_conversation'; // Natural follow-up probing
            }
          case 'partial':
          // Give some opportunities but provide guidance if struggling
          if (questionsAskedInCurrentSubtopic >= 4) {
            return 'give_cue'; // Help after several attempts
            }
          return 'continue_conversation';
          default: // 'confused' and 'incorrect'
          // When confused, explain clearly
            return 'explain';
        }
      
    case 'explaining':
      // After explanation, always check understanding
      return 'check_understanding';
      
    case 'checking':
      switch (answerQuality) {
        case 'excellent':
        case 'good':
          // Good understanding after explanation = ready to move
          return 'complete_subtopic';
        default:
          // If still confused after explanation, just move on (escape valve)
          return 'complete_subtopic';
      }
  }
  
  return 'continue_conversation'; // Default: keep natural conversation going
}

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
    updatedSubtopics[currentSubtopicIndex] = {
      ...updatedSubtopics[currentSubtopicIndex],
      needsExplanation: shouldMarkNeedsExplanation || updatedSubtopics[currentSubtopicIndex].needsExplanation,
      questionsAsked: updatedSubtopics[currentSubtopicIndex].questionsAsked + 1,
      correctAnswers: isCorrectAnswer ? 
        updatedSubtopics[currentSubtopicIndex].correctAnswers + 1 : 
        updatedSubtopics[currentSubtopicIndex].correctAnswers
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
    const questionTypes = ['clinical_vignette', 'differential', 'mechanism', 'priority', 'application'] as const;
    
    // Weight question types based on depth
    let weightedTypes: (typeof questionTypes[number])[] = [];
    
    switch (depth) {
      case 'surface':
        weightedTypes = ['mechanism', 'mechanism', 'priority']; // More basic reasoning
        break;
      case 'deeper':
        weightedTypes = ['clinical_vignette', 'differential', 'application']; // Applied reasoning
        break;
      case 'reasoning':
        weightedTypes = ['clinical_vignette', 'clinical_vignette', 'differential', 'mechanism', 'priority', 'application']; // Mix of all
        break;
    }
    
    const selectedType = weightedTypes[Math.floor(Math.random() * weightedTypes.length)];
    return generateAdvancedQuestion(subtopic, topic, selectedType);
  }
  
  // Fallback to original simple questions if no context
  const whyQuestions = [
    `Why do you think that happens?`,
    `What's the underlying mechanism there?`,
    `Why would that increase the risk?`,
    `What makes that factor so important?`,
    `Why do you think some patients are more vulnerable?`
  ];
  
  const howQuestions = [
    `How would you explain that to a patient?`,
    `How does that affect clinical management?`,
    `How would you prioritize these different factors?`,
    `How would you use this information in practice?`,
    `How might this change your approach?`
  ];
  
  const clinicalReasoningQuestions = [
    `Walk me through your clinical reasoning here.`,
    `What would make you most concerned in this scenario?`,
    `How would you weight these different factors?`,
    `What patterns do you see emerging?`,
    `How would this influence your differential diagnosis?`
  ];
  
  switch (depth) {
    case 'surface': 
      return whyQuestions[Math.floor(Math.random() * whyQuestions.length)];
    case 'deeper': 
      return howQuestions[Math.floor(Math.random() * howQuestions.length)];
    case 'reasoning': 
      return clinicalReasoningQuestions[Math.floor(Math.random() * clinicalReasoningQuestions.length)];
    default: 
      return whyQuestions[Math.floor(Math.random() * whyQuestions.length)];
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