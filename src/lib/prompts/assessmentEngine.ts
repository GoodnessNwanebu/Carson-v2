import { CarsonSessionContext } from './carsonTypes';
import { callLLM } from './llm-service';
import { 
  classifyInteraction, 
  isConversationalResponse,
  InteractionType 
} from './interactionHandler';
import { 
  assessMedicalAccuracy, 
  AnswerQuality, 
  MedicalAssessmentResult,
  // PHASE 3: Advanced clinical reasoning
  assessAdvancedClinicalReasoning
} from './medicalAssessment';
import { 
  NextAction,
  AssessmentPhase,
  SubtopicStatus,
  SubtopicRequirements,
  GapAnalysis,
  initializeSubtopicStatus,
  transitionToNextSubtopic,
  // PHASE 3: Advanced gap analysis
  AdvancedGapAnalysis,
  performAdvancedGapAnalysis,
  // Import fallback function
  getGapAnalysisFallback
} from './triagingOrchestrator';

/**
 * Carson Assessment Engine - Clean Modular Architecture
 * 
 * CLEAN ARCHITECTURE:
 * - interactionHandler.ts - Interaction classification and response generation
 * - medicalAssessment.ts - Medical knowledge assessment with hybrid intelligence
 * - triagingOrchestrator.ts - Sophisticated gap analysis and learning progression
 * - assessmentEngine.ts - Main coordinator (this file)
 * 
 * BENEFITS:
 * - Maintainable (separate concerns)
 * - Sophisticated (preserves educational intelligence)
 * - Testable (focused modules)
 * - Scalable (easy to extend individual components)
 */

// Re-export types for compatibility
export type { AnswerQuality, MedicalAssessmentResult } from './medicalAssessment';
export type { NextAction, AssessmentPhase, SubtopicStatus } from './triagingOrchestrator';
export type { InteractionType } from './interactionHandler';

// Internal interface for hybrid assessment functions
interface MedicalAssessment {
  isCorrect: boolean;
  confidence: number;
  missingConcepts: string[];
  assessmentType: 'correct' | 'partial' | 'incorrect' | 'struggling' | 'insufficient';
  reasoning: string;
}

export interface AssessmentResult {
  answerQuality: AnswerQuality;
  nextAction: NextAction;
  reasoning: string;
  isStruggling?: boolean;
  specificGaps?: string;
  interactionType: InteractionType;
  currentPhase?: AssessmentPhase;
  statusUpdate?: Partial<SubtopicStatus>;
  clinicalReasoningLevel?: 'novice' | 'intermediate' | 'advanced';
  domainSpecificInsights?: string[];
}

/**
 * PHASE 3 ENHANCEMENT: Expanded Topic-Specific Assessment Domains
 * Much more comprehensive medical domain coverage
 */
const EXPANDED_MEDICAL_DOMAINS = {
  // Core clinical domains
  cardiology: {
    topics: ['myocardial infarction', 'heart failure', 'arrhythmias', 'hypertension', 'coronary artery disease'],
    keyPatterns: ['hemodynamics', 'ejection fraction', 'cardiac output', 'preload', 'afterload'],
    assessmentFocus: 'pathophysiology and clinical management'
  },
  
  obstetrics_gynecology: {
    topics: ['pregnancy complications', 'labor and delivery', 'gynecologic disorders', 'reproductive health'],
    keyPatterns: ['maternal-fetal', 'gestational', 'hormonal', 'reproductive cycle'],
    assessmentFocus: 'risk assessment and clinical decision-making'
  },
  
  emergency_medicine: {
    topics: ['trauma', 'acute cardiac events', 'respiratory emergencies', 'toxicology'],
    keyPatterns: ['triage', 'acute management', 'stabilization', 'time-sensitive'],
    assessmentFocus: 'rapid assessment and prioritization'
  },
  
  internal_medicine: {
    topics: ['diabetes', 'chronic diseases', 'infectious diseases', 'preventive care'],
    keyPatterns: ['chronic management', 'systems-based', 'evidence-based', 'patient-centered'],
    assessmentFocus: 'comprehensive care and long-term management'
  },
  
  // Specialty domains
  neurology: {
    topics: ['stroke', 'seizures', 'neurodegenerative diseases', 'headaches'],
    keyPatterns: ['neurological examination', 'cognitive assessment', 'motor function'],
    assessmentFocus: 'clinical correlation and diagnostic reasoning'
  },
  
  psychiatry: {
    topics: ['mood disorders', 'anxiety disorders', 'psychotic disorders', 'substance abuse'],
    keyPatterns: ['mental status', 'psychosocial', 'therapeutic relationship'],
    assessmentFocus: 'assessment and therapeutic approaches'
  },
  
  pediatrics: {
    topics: ['child development', 'pediatric emergencies', 'childhood diseases', 'immunizations'],
    keyPatterns: ['age-appropriate', 'developmental milestones', 'family-centered'],
    assessmentFocus: 'age-specific considerations and family dynamics'
  },
  
  // Basic sciences
  pharmacology: {
    topics: ['drug mechanisms', 'pharmacokinetics', 'drug interactions', 'adverse effects'],
    keyPatterns: ['receptor binding', 'metabolism', 'elimination', 'therapeutic index'],
    assessmentFocus: 'mechanism understanding and clinical application'
  },
  
  pathology: {
    topics: ['cellular pathology', 'inflammation', 'neoplasia', 'genetic disorders'],
    keyPatterns: ['cellular changes', 'tissue architecture', 'molecular mechanisms'],
    assessmentFocus: 'mechanistic understanding and clinical correlation'
  },
  
  // Public health
  epidemiology: {
    topics: ['disease patterns', 'risk factors', 'preventive strategies', 'health policy'],
    keyPatterns: ['population health', 'statistical analysis', 'study design'],
    assessmentFocus: 'analytical thinking and population-level reasoning'
  }
};

/**
 * PHASE 3: Enhanced Assessment with Advanced Features
 * Integrates all Phase 3 improvements into the main assessment flow
 */
export async function assessUserResponse(
  userResponse: string, 
  context: CarsonSessionContext
): Promise<AssessmentResult | null> {
  
  // Step 1: Classify interaction type (sophisticated existing function)
  const interaction = classifyInteraction(userResponse, context);
  
  if (!interaction.requiresAssessment) {
    return {
      answerQuality: 'conversational' as any,
      nextAction: 'continue_conversation',
      reasoning: interaction.suggestedResponse || "Let's continue with our learning.",
      isStruggling: interaction.type === 'emotional_support' || interaction.type === 'give_up',
      specificGaps: undefined,
      interactionType: interaction.type
    } as AssessmentResult & { interactionType: InteractionType };
  }
  
  // Step 2: Handle conversational responses (sophisticated detection)
  const lastCarsonMessage = context.history
    .filter(msg => msg.role === "assistant")
    .slice(-1)[0]?.content || "";
    
  if (isConversationalResponse(userResponse, lastCarsonMessage)) {
    return null;
  }
  
  // Step 3: OPTIMIZED - Run medical assessment and clinical reasoning in parallel
  const [medicalAssessment, clinicalReasoning] = await Promise.all([
    assessMedicalAccuracyWithLLM(
      userResponse,
      lastCarsonMessage,
      context.topic || "Medical Topic",
      context.subtopics[context.currentSubtopicIndex]?.title || "Unknown Subtopic"
    ),
    Promise.resolve(assessAdvancedClinicalReasoning(
      userResponse,
      context.subtopics[context.currentSubtopicIndex]?.title || "Unknown Subtopic",
      context.topic || "Medical Topic"
    ))
  ]);
  
  // Step 4: Enhanced Orchestration (now with parallel assessment data)
  const orchestration = await sophisticatedTriagingOrchestration(
    userResponse,
    medicalAssessment,
    context,
    lastCarsonMessage
  );
  
  // Step 6: Generate domain insights
  const domainInsights = generateDomainSpecificInsights(
    userResponse,
    context.topic || "Medical Topic",
    context.subtopics[context.currentSubtopicIndex]?.title || "Unknown Subtopic",
    clinicalReasoning
  );
  
  // Step 7: Return enhanced result with Phase 3 features
  return {
    answerQuality: medicalAssessment.quality,
    nextAction: orchestration.nextAction,
    reasoning: generateEnhancedReasoningV4(
      { ...medicalAssessment, clinicalReasoning, domainInsights }, 
      orchestration, 
      context
    ),
    isStruggling: medicalAssessment.quality === 'confused',
    specificGaps: medicalAssessment.specificGaps,
    interactionType: 'medical_response',
    currentPhase: orchestration.phase,
    statusUpdate: orchestration.statusUpdate,
    // PHASE 3: Enhanced metadata
    clinicalReasoningLevel: clinicalReasoning.sophisticationLevel,
    domainSpecificInsights: domainInsights
  } as AssessmentResult & { 
    interactionType: InteractionType;
    clinicalReasoningLevel?: 'novice' | 'intermediate' | 'advanced';
    domainSpecificInsights?: string[];
  };
}

/**
 * V3: Focused Medical Assessment (Renamed from assessWithLLM)
 * ONLY handles medical accuracy - no business logic
 */
async function assessMedicalAccuracyWithLLM(
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
      currentQuestionType: 'parent',
      questionsAskedInCurrentSubtopic: 0,
      correctAnswersInCurrentSubtopic: 0,
      currentSubtopicState: 'assessing',
      shouldTransition: false,
      isComplete: false,
    });
    
    // Validate response structure
    if (!response || !response.content || typeof response.content !== 'string') {
      console.error('LLM assessment: Invalid response structure:', response);
      return {quality: sophisticatedFallbackAssessment(userResponse)};
    }
    
    try {
      // Try to parse as JSON
      const parsed = JSON.parse(response.content);
      
      // Validate the parsed structure
      const validQualities = ['excellent', 'good', 'partial', 'incorrect', 'confused'];
      if (!parsed.quality || !validQualities.includes(parsed.quality)) {
        console.error('LLM assessment: Invalid quality value:', parsed.quality);
        return {quality: sophisticatedFallbackAssessment(userResponse)};
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
      return {quality: sophisticatedFallbackAssessment(userResponse)};
    }
  } catch (error) {
    console.error('LLM assessment failed, falling back to heuristics:', error);
    return {quality: sophisticatedFallbackAssessment(userResponse)};
  }
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
 * V3: Sophisticated Fallback Assessment (Renamed from fallbackAssessment)
 * Reliable fallback when LLM fails
 */
function sophisticatedFallbackAssessment(userResponse: string): AnswerQuality {
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
 * V3: Sophisticated Triaging Orchestration
 * ONLY handles business logic - no medical assessment
 */
async function sophisticatedTriagingOrchestration(
  userResponse: string,
  medicalAssessment: {quality: AnswerQuality, specificGaps?: string},
  context: CarsonSessionContext,
  lastCarsonMessage: string
): Promise<{ phase: AssessmentPhase; nextAction: NextAction; statusUpdate: Partial<SubtopicStatus> }> {
  
  const answerQuality = medicalAssessment.quality;
  const subtopic = context.subtopics[context.currentSubtopicIndex];
  const requirements = generateSubtopicRequirements(subtopic.title, context.topic || "Medical Topic");
  const status: SubtopicStatus = subtopic.triagingStatus || initializeSubtopicStatus();
  
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
    // OPTIMIZATION: Run gap analysis in parallel with medical assessment (already done above)
    // Use the medical assessment result to inform a faster gap analysis
    const gapAnalysis = await analyzeGapsOptimized(
      userResponse, 
      medicalAssessment, // Pass the already-computed assessment
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

/**
 * Generate requirements for a subtopic based on its title and topic
 */
function generateSubtopicRequirements(subtopicTitle: string, topic: string): SubtopicRequirements {
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
 * OPTIMIZED: Fast gap analysis using medical assessment result
 * Uses heuristics + medical assessment to avoid extra LLM call
 */
async function analyzeGapsOptimized(
  userResponse: string,
  medicalAssessment: {quality: AnswerQuality, specificGaps?: string},
  subtopicTitle: string,
  topic: string
): Promise<GapAnalysis> {
  const response = userResponse.toLowerCase().trim();
  const { quality, specificGaps } = medicalAssessment;
  
  // Fast heuristic-based gap analysis using medical assessment result
  switch (quality) {
    case 'excellent':
      return {
        criticalGaps: [],
        importantGaps: [],
        minorGaps: ['Advanced nuances could be explored'],
        strengthAreas: ['Strong understanding of core concepts', 'Good clinical reasoning']
      };
      
    case 'good':
      return {
        criticalGaps: [],
        importantGaps: specificGaps ? [specificGaps] : ['Some details need refinement'],
        minorGaps: ['Advanced applications could be discussed'],
        strengthAreas: ['Solid foundation', 'Generally correct understanding']
      };
      
    case 'partial':
      const criticalGap = specificGaps || 'Key concepts missing';
      return {
        criticalGaps: [criticalGap],
        importantGaps: ['Comprehensive understanding needs development'],
        minorGaps: [],
        strengthAreas: response.length > 20 ? ['Shows engagement with topic'] : []
      };
      
    case 'incorrect':
      return {
        criticalGaps: ['Fundamental misconceptions need correction'],
        importantGaps: specificGaps ? [specificGaps] : ['Basic concepts need clarification'],
        minorGaps: [],
        strengthAreas: []
      };
      
    case 'confused':
      return {
        criticalGaps: ['Basic understanding needs establishment'],
        importantGaps: ['Confidence building required'],
        minorGaps: [],
        strengthAreas: response.length > 5 ? ['Attempting to engage'] : []
      };
      
    default:
      return getGapAnalysisFallback(userResponse);
  }
}

/**
 * PHASE 3: Generate Domain-Specific Insights
 * Provides specialized feedback based on medical domain
 */
function generateDomainSpecificInsights(
  userResponse: string,
  topic: string,
  subtopic: string,
  clinicalReasoning: ReturnType<typeof assessAdvancedClinicalReasoning>
): string[] {
  
  const insights: string[] = [];
  const response = userResponse.toLowerCase();
  
  // Identify medical domain
  const domain = identifyMedicalDomain(topic);
  const domainConfig = EXPANDED_MEDICAL_DOMAINS[domain];
  
  if (!domainConfig) {
    return ['Continue developing clinical understanding'];
  }
  
  // Domain-specific pattern analysis
  const foundPatterns = domainConfig.keyPatterns.filter(pattern => 
    response.includes(pattern.toLowerCase())
  );
  
  if (foundPatterns.length > 0) {
    insights.push(`Strong ${domain} knowledge: ${foundPatterns.join(', ')}`);
  } else {
    insights.push(`Consider key ${domain} concepts: ${domainConfig.keyPatterns.slice(0, 2).join(', ')}`);
  }
  
  // Clinical reasoning level insights
  switch (clinicalReasoning.sophisticationLevel) {
    case 'advanced':
      insights.push(`Excellent clinical reasoning for ${domain}`);
      break;
    case 'intermediate':
      insights.push(`Developing good ${domain} reasoning skills`);
      break;
    case 'novice':
      insights.push(`Focus on ${domainConfig.assessmentFocus} in ${domain}`);
      break;
  }
  
  return insights.length > 0 ? insights : ['Continue developing domain expertise'];
}

/**
 * PHASE 3: Identify Medical Domain from Topic
 */
function identifyMedicalDomain(topic: string): keyof typeof EXPANDED_MEDICAL_DOMAINS {
  const topicLower = topic.toLowerCase();
  
  // Direct matches
  if (topicLower.includes('cardiac') || topicLower.includes('heart')) return 'cardiology';
  if (topicLower.includes('pregnancy') || topicLower.includes('obstetric')) return 'obstetrics_gynecology';
  if (topicLower.includes('emergency') || topicLower.includes('trauma')) return 'emergency_medicine';
  if (topicLower.includes('diabetes') || topicLower.includes('chronic')) return 'internal_medicine';
  if (topicLower.includes('neuro') || topicLower.includes('stroke')) return 'neurology';
  if (topicLower.includes('psych') || topicLower.includes('mental')) return 'psychiatry';
  if (topicLower.includes('pediatric') || topicLower.includes('child')) return 'pediatrics';
  if (topicLower.includes('drug') || topicLower.includes('pharmaco')) return 'pharmacology';
  if (topicLower.includes('pathology') || topicLower.includes('cellular')) return 'pathology';
  if (topicLower.includes('epidemio') || topicLower.includes('population')) return 'epidemiology';
  
  // Default to internal medicine for general medical topics
  return 'internal_medicine';
}

/**
 * PHASE 3: Enhanced Reasoning Generation (V4)
 * Incorporates all Phase 3 enhancements into the response
 */
function generateEnhancedReasoningV4(
  medicalAssessment: any,
  orchestration: any,
  context: CarsonSessionContext
): string {
  
  const { quality: answerQuality } = medicalAssessment;
  
  // Get basic reasoning (existing function)
  let baseReasoning = generateReasoningForAssessment(
    answerQuality,
    orchestration.nextAction,
    context,
    medicalAssessment.specificGaps,
    orchestration.phase
  );
  
  // PHASE 3: Enhance with clinical reasoning insights
  if (medicalAssessment.clinicalReasoning?.sophisticationLevel === 'advanced') {
    const domain = identifyMedicalDomain(context.topic || '');
    baseReasoning += ` Your clinical reasoning shows advanced ${domain} thinking.`;
  }
  
  // PHASE 3: Add domain-specific guidance
  if (medicalAssessment.domainInsights?.length > 0) {
    const primaryInsight = medicalAssessment.domainInsights[0];
    baseReasoning += ` ${primaryInsight}`;
  }
  
  return baseReasoning;
}

/**
 * Generate reasoning for assessment result
 */
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
        questionType: 'parent',
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
      return "What's your thinking on this?";
  }
}

/**
 * Generate contextual response based on type and context
 */
function generateContextualResponse(
  type: 'question' | 'explanation' | 'cue' | 'feedback' | 'transition',
  context: {
    subtopic?: string;
    answerQuality?: AnswerQuality;
    questionType?: string;
    isStruggling?: boolean;
    specificGaps?: string;
    topic?: string;
    phase?: AssessmentPhase;
  }
): string {
  
  switch (type) {
    case 'question':
      if (context.specificGaps) {
        return `I see you have some understanding. What about ${context.specificGaps.toLowerCase()}? How might that factor in?`;
      }
      return "What's your thinking on this?";
      
    case 'explanation':
      return "Let me help clarify this concept.";
      
    case 'cue':
      if (context.specificGaps) {
        return `Think about ${context.specificGaps.toLowerCase()} - that's an important piece here.`;
      }
      return "Here's something to consider: think about the mechanism here.";
      
    case 'feedback':
      return "Good work on that.";
      
    case 'transition':
      return `Great! Let's move on to ${context.subtopic || 'the next topic'}.`;
      
    default:
      return "What's your thinking on this?";
  }
}

/**
 * Update session context after assessment
 */
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
      updates.currentQuestionType = 'parent';
      updates.currentSubtopicState = 'assessing';
      break;
      
    case 'give_cue':
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
  
  return updates;
}

/**
 * Check if we should test retention of previously mastered subtopics
 */
export function shouldTestRetention(context: CarsonSessionContext): boolean {
  const completedSubtopics = context.subtopics
    .filter((subtopic, index) => index < context.currentSubtopicIndex && subtopic.correctAnswers >= 2);
  
  if (completedSubtopics.length === 0) return false;
  
  // Test retention every 2-3 subtopics
  return context.currentSubtopicIndex > 0 && 
         context.currentSubtopicIndex % 3 === 0 && 
         Math.random() < 0.7; // 70% chance
}

/**
 * Generate retention questions that connect previous learning
 */
export function generateRetentionQuestion(
  context: CarsonSessionContext
): string {
  const completedSubtopics = context.subtopics
    .filter((subtopic, index) => index < context.currentSubtopicIndex && subtopic.correctAnswers >= 2);
    
  if (completedSubtopics.length === 0) return "Let's continue with our current topic.";
  
  const randomSubtopic = completedSubtopics[Math.floor(Math.random() * completedSubtopics.length)];
  const currentSubtopic = context.subtopics[context.currentSubtopicIndex];
  
  const connectionQuestions = [
    `Before we continue with ${currentSubtopic.title}, let's connect this to what we learned about ${randomSubtopic.title}. How do these two areas relate in clinical practice?`,
    `Quick review: We covered ${randomSubtopic.title} earlier. How would that knowledge help you with a patient who also has issues related to ${currentSubtopic.title}?`,
    `Let's make sure this sticks - can you explain how ${randomSubtopic.title} might influence your approach to ${currentSubtopic.title}?`
  ];
  
  return connectionQuestions[Math.floor(Math.random() * connectionQuestions.length)];
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
        `No problem. What would help you understand ${currentSubtopic.title} better? Examples? Different explanation?`
      ];
      return strugglingQuestions[Math.floor(Math.random() * strugglingQuestions.length)];
      
    case 'partial':
      const partialQuestions = [
        `You've got some good points. What do you think might be missing?`,
        `Good start! What other aspects of ${currentSubtopic.title} should we cover?`,
        `Right so far. If you were teaching this to a classmate, what else would you mention?`
      ];
      return partialQuestions[Math.floor(Math.random() * partialQuestions.length)];
      
    case 'good':
    case 'excellent':
      const reflectionQuestions = [
        `Good work. How confident do you feel about using this ${currentSubtopic.title} knowledge with real patients?`,
        `Nice. What's one thing about ${currentSubtopic.title} that surprised you or changed how you think about it?`,
        `Right. If you had to identify one key takeaway about ${currentSubtopic.title}, what would it be?`
      ];
      return reflectionQuestions[Math.floor(Math.random() * reflectionQuestions.length)];
  }
}

// Keep the original function as V3 for backwards compatibility
export const assessUserResponseV3 = assessUserResponse;

// Legacy export for backwards compatibility
export const assessUserResponseV4 = assessUserResponse;
