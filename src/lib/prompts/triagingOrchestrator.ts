import { CarsonSessionContext } from './carsonTypes';
import { callLLM } from './llm-service';
import { AnswerQuality, MedicalAssessmentResult } from './medicalAssessment';

/**
 * Triaging Orchestrator
 * Sophisticated gap analysis and learning progression management
 */

export type NextAction = 'continue_conversation' | 'give_cue' | 'explain' | 'check_understanding' | 'complete_subtopic' | 'handle_interaction' | 'provide_support' | 'gentle_correction' | 'explain_gaps';

export type AssessmentPhase = 'initial_assessment' | 'targeted_remediation' | 'application' | 'gap_acknowledgment' | 'complete';

/**
 * Subtopic learning requirements and constraints
 */
export interface SubtopicRequirements {
  maxQuestions: number;           // Hard limit to prevent endless loops
  minQuestionsForMastery: number; // Minimum questions before considering mastery
  mustTestApplication: boolean;   // Whether to include application scenario
}

/**
 * Gap analysis results with priority levels
 */
export interface GapAnalysis {
  criticalGaps: string[];         // Must address - fundamental/dangerous misconceptions
  importantGaps: string[];        // Should address - common/clinically relevant
  minorGaps: string[];           // Nice to address - rare/academic details
  strengthAreas: string[];        // Areas student understands well
}

/**
 * Current status of subtopic learning progression
 */
export interface SubtopicStatus {
  hasInitialAssessment: boolean;  // Whether we've done comprehensive gap analysis
  gapAnalysis?: GapAnalysis;      // Results of initial comprehensive assessment
  addressedGaps: string[];        // Gaps we've successfully addressed
  acknowledgedGaps: string[];     // Gaps we've acknowledged but deferred
  questionsUsed: number;          // Questions used so far in this subtopic
  hasTestedApplication: boolean;  // Whether we've tested clinical application
}

/**
 * Orchestration result with next steps
 */
export interface OrchestrationResult {
  phase: AssessmentPhase;
  nextAction: NextAction;
  statusUpdate: Partial<SubtopicStatus>;
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
      currentQuestionType: 'parent',
      questionsAskedInCurrentSubtopic: 0,
      correctAnswersInCurrentSubtopic: 0,
      currentSubtopicState: 'assessing',
      shouldTransition: false,
      isComplete: false,
    });
    
    // Validate response structure
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
      // Fallback to simple text parsing
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
 * Fallback gap analysis when LLM fails
 */
export function getGapAnalysisFallback(userResponse: string): GapAnalysis {
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
 * PHASE 3 ENHANCEMENT: Advanced Gap Analysis System
 * More sophisticated, actionable gap detection for medical education
 */

export interface AdvancedGapAnalysis extends GapAnalysis {
  // Enhanced gap categorization
  conceptualGaps: string[];        // Understanding concepts
  applicationGaps: string[];       // Applying knowledge clinically  
  reasoningGaps: string[];         // Clinical reasoning patterns
  factualGaps: string[];          // Missing factual knowledge
  
  // Learning pathway optimization
  suggestedSequence: string[];     // Optimal order to address gaps
  estimatedTime: number;           // Minutes needed for remediation
  difficulty: 'foundational' | 'intermediate' | 'advanced';
  
  // Remediation strategies
  recommendedApproach: 'explain' | 'examples' | 'practice' | 'review';
  supportingResources: string[];   // What would help this student
}

/**
 * PHASE 3: Sophisticated Medical Gap Analysis
 * Identifies not just WHAT is missing, but HOW to address it effectively
 */
export async function performAdvancedGapAnalysis(
  userResponse: string,
  subtopicTitle: string,
  topic: string,
  context: CarsonSessionContext
): Promise<AdvancedGapAnalysis> {
  
  // Enhanced prompt for more sophisticated gap detection
  const advancedPrompt = `You are an expert medical educator analyzing a student's response for sophisticated gap identification.

**Context:**
- Topic: ${topic}
- Subtopic: ${subtopicTitle}
- Student Level: Medical student
- Student Response: "${userResponse}"

**Advanced Analysis Required:**

1. **Gap Categories** - Classify missing knowledge by type:
   - CONCEPTUAL: Fundamental understanding gaps
   - APPLICATION: Difficulty applying knowledge clinically
   - REASONING: Clinical reasoning/logic gaps  
   - FACTUAL: Missing specific facts/details

2. **Priority Assessment** - Rate each gap:
   - CRITICAL: Dangerous/must address immediately
   - IMPORTANT: Significant learning opportunity
   - MINOR: Nice to know but not essential

3. **Learning Optimization:**
   - Suggest optimal sequence to address gaps
   - Estimate time needed (in minutes)
   - Assess difficulty level
   - Recommend best remediation approach

Respond in JSON format:
{
  "criticalGaps": ["gap1", "gap2"],
  "importantGaps": ["gap1", "gap2"], 
  "minorGaps": ["gap1", "gap2"],
  "strengthAreas": ["strength1", "strength2"],
  "conceptualGaps": ["concept1", "concept2"],
  "applicationGaps": ["application1", "application2"],
  "reasoningGaps": ["reasoning1", "reasoning2"],
  "factualGaps": ["fact1", "fact2"],
  "suggestedSequence": ["first_gap", "second_gap", "third_gap"],
  "estimatedTime": 15,
  "difficulty": "intermediate",
  "recommendedApproach": "examples",
  "supportingResources": ["resource1", "resource2"]
}

Analysis:`;

  try {
    const response = await callLLM({
      sessionId: 'advanced-gap-analysis',
      topic: advancedPrompt,
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

    if (!response?.content) {
      return getAdvancedGapAnalysisFallback(userResponse, subtopicTitle, topic);
    }

    try {
      const parsed = JSON.parse(response.content);
      return validateAndEnhanceGapAnalysis(parsed, userResponse, subtopicTitle);
    } catch (parseError) {
      console.warn('Advanced gap analysis: JSON parse failed, using enhanced fallback');
      return getAdvancedGapAnalysisFallback(userResponse, subtopicTitle, topic);
    }
  } catch (error) {
    console.error('Advanced gap analysis failed:', error);
    return getAdvancedGapAnalysisFallback(userResponse, subtopicTitle, topic);
  }
}

/**
 * PHASE 3: Validate and enhance gap analysis results
 */
function validateAndEnhanceGapAnalysis(
  parsed: any, 
  userResponse: string, 
  subtopicTitle: string
): AdvancedGapAnalysis {
  
  // Ensure all required fields exist
  const analysis: AdvancedGapAnalysis = {
    criticalGaps: Array.isArray(parsed.criticalGaps) ? parsed.criticalGaps : [],
    importantGaps: Array.isArray(parsed.importantGaps) ? parsed.importantGaps : [],
    minorGaps: Array.isArray(parsed.minorGaps) ? parsed.minorGaps : [],
    strengthAreas: Array.isArray(parsed.strengthAreas) ? parsed.strengthAreas : [],
    
    // Enhanced categorization
    conceptualGaps: Array.isArray(parsed.conceptualGaps) ? parsed.conceptualGaps : [],
    applicationGaps: Array.isArray(parsed.applicationGaps) ? parsed.applicationGaps : [],
    reasoningGaps: Array.isArray(parsed.reasoningGaps) ? parsed.reasoningGaps : [],
    factualGaps: Array.isArray(parsed.factualGaps) ? parsed.factualGaps : [],
    
    // Learning optimization
    suggestedSequence: Array.isArray(parsed.suggestedSequence) ? parsed.suggestedSequence : [],
    estimatedTime: typeof parsed.estimatedTime === 'number' ? parsed.estimatedTime : 10,
    difficulty: ['foundational', 'intermediate', 'advanced'].includes(parsed.difficulty) 
      ? parsed.difficulty : 'intermediate',
    recommendedApproach: ['explain', 'examples', 'practice', 'review'].includes(parsed.recommendedApproach)
      ? parsed.recommendedApproach : 'explain',
    supportingResources: Array.isArray(parsed.supportingResources) ? parsed.supportingResources : []
  };
  
  // Intelligent enhancements based on response patterns
  enhanceAnalysisWithPatterns(analysis, userResponse, subtopicTitle);
  
  return analysis;
}

/**
 * PHASE 3: Pattern-based enhancement of gap analysis
 */
function enhanceAnalysisWithPatterns(
  analysis: AdvancedGapAnalysis, 
  userResponse: string, 
  subtopicTitle: string
): void {
  
  const response = userResponse.toLowerCase();
  const responseLength = response.length;
  
  // Detect confidence patterns
  const confidenceMarkers = ['definitely', 'absolutely', 'i know', 'certain'];
  const uncertaintyMarkers = ['maybe', 'i think', 'possibly', 'not sure'];
  
  const isConfident = confidenceMarkers.some(marker => response.includes(marker));
  const isUncertain = uncertaintyMarkers.some(marker => response.includes(marker));
  
  // Adjust approach based on confidence
  if (isConfident && analysis.criticalGaps.length > 0) {
    analysis.recommendedApproach = 'examples'; // Show concrete examples
    analysis.supportingResources.push('Real clinical cases to challenge assumptions');
  } else if (isUncertain) {
    analysis.recommendedApproach = 'explain'; // Build confidence with clear explanations
    analysis.supportingResources.push('Step-by-step reasoning guides');
  }
  
  // Adjust time estimates based on complexity
  if (responseLength < 20) {
    analysis.estimatedTime += 5; // Need more time for very short responses
    analysis.difficulty = 'foundational';
  }
  
  // Domain-specific enhancements
  if (subtopicTitle.toLowerCase().includes('pathophysiology')) {
    analysis.supportingResources.push('Visual mechanism diagrams');
    if (analysis.conceptualGaps.length > 0) {
      analysis.estimatedTime += 3; // Concepts take longer in pathophys
    }
  }
  
  if (subtopicTitle.toLowerCase().includes('management')) {
    analysis.supportingResources.push('Clinical decision algorithms');
    if (analysis.applicationGaps.length > 0) {
      analysis.estimatedTime += 4; // Application practice needed
    }
  }
}

/**
 * PHASE 3: Enhanced fallback for advanced gap analysis
 */
function getAdvancedGapAnalysisFallback(
  userResponse: string, 
  subtopicTitle: string, 
  topic: string
): AdvancedGapAnalysis {
  
  const response = userResponse.toLowerCase().trim();
  const length = response.length;
  
  // Intelligent fallback based on response characteristics
  if (length < 10) {
    return {
      criticalGaps: ['Insufficient detail provided'],
      importantGaps: ['Need comprehensive explanation'],
      minorGaps: [],
      strengthAreas: [],
      conceptualGaps: ['Basic understanding needs development'],
      applicationGaps: ['Clinical application unclear'],
      reasoningGaps: ['Reasoning process not demonstrated'],
      factualGaps: ['Key facts missing'],
      suggestedSequence: ['Basic understanding', 'Key facts', 'Clinical application'],
      estimatedTime: 15,
      difficulty: 'foundational',
      recommendedApproach: 'explain',
      supportingResources: ['Basic concept review', 'Foundational materials']
    };
  }
  
  // Pattern-based fallback analysis
  const medicalTerms = ['pathophysiology', 'mechanism', 'diagnosis', 'treatment', 'patient'];
  const hasMedicalTerms = medicalTerms.some(term => response.includes(term));
  
  if (hasMedicalTerms && length > 50) {
    return {
      criticalGaps: [],
      importantGaps: ['Some concepts need deeper exploration'],
      minorGaps: ['Advanced applications could be expanded'],
      strengthAreas: ['Shows medical vocabulary and engagement'],
      conceptualGaps: [],
      applicationGaps: ['Clinical reasoning could be stronger'],
      reasoningGaps: ['Connect concepts to practice'],
      factualGaps: ['Some details could be more precise'],
      suggestedSequence: ['Clinical reasoning', 'Factual precision', 'Advanced applications'],
      estimatedTime: 8,
      difficulty: 'intermediate',
      recommendedApproach: 'practice',
      supportingResources: ['Case-based practice', 'Clinical scenarios']
    };
  }
  
  // Default fallback
  return {
    criticalGaps: ['Understanding needs clarification'],
    importantGaps: ['Key concepts require attention'],
    minorGaps: [],
    strengthAreas: length > 20 ? ['Attempting meaningful engagement'] : [],
    conceptualGaps: ['Core concepts need reinforcement'],
    applicationGaps: ['Clinical application needs practice'],
    reasoningGaps: ['Reasoning skills need development'],
    factualGaps: ['Important facts missing'],
    suggestedSequence: ['Core concepts', 'Important facts', 'Clinical application'],
    estimatedTime: 12,
    difficulty: 'intermediate',
    recommendedApproach: 'explain',
    supportingResources: ['Conceptual frameworks', 'Practice opportunities']
  };
}

/**
 * V3: Sophisticated Triaging Orchestration
 * ONLY handles business logic - no medical assessment
 */
export async function sophisticatedTriagingOrchestration(
  userResponse: string,
  medicalAssessment: MedicalAssessmentResult,
  context: CarsonSessionContext,
  lastCarsonMessage: string
): Promise<OrchestrationResult> {
  
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

/**
 * Session Transition Management
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
 * Reset context for a new subtopic - fresh start approach
 */
function resetSubtopicContext(
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
    currentQuestionType: 'parent',
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