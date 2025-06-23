import { callLLM } from './llm-service';

/**
 * Medical Assessment Engine
 * Sophisticated hybrid intelligence for assessing medical knowledge
 */

export type AnswerQuality = 'excellent' | 'good' | 'partial' | 'incorrect' | 'confused';

/**
 * Medical assessment result with quality and gaps
 */
export interface MedicalAssessmentResult {
  quality: AnswerQuality;
  specificGaps?: string;
}

/**
 * Enhanced Medical Terminology Database for sophisticated assessment
 */
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
  
  // Domain-specific vocabularies
  cardiovascular: ['cardiac', 'heart', 'coronary', 'vascular', 'blood pressure', 'hypertension', 'hypotension',
                   'arrhythmia', 'myocardial', 'ischemia', 'stenosis', 'atherosclerosis', 'embolism'],
  
  respiratory: ['pulmonary', 'lung', 'respiratory', 'airway', 'ventilation', 'oxygenation', 'pneumonia',
                'asthma', 'copd', 'bronchial', 'alveolar', 'pleural'],
  
  neurological: ['neurological', 'brain', 'spinal', 'neuron', 'synaptic', 'cognitive', 'seizure',
                 'stroke', 'meningitis', 'encephalitis', 'neuropathy'],
  
  gastrointestinal: ['gastrointestinal', 'hepatic', 'gastric', 'intestinal', 'digestive', 'bowel',
                     'liver', 'pancreatic', 'biliary', 'peptic', 'inflammatory'],
  
  endocrine: ['hormonal', 'endocrine', 'diabetes', 'thyroid', 'insulin', 'glucose', 'metabolic',
              'adrenal', 'pituitary', 'pancreatic', 'hormone'],
  
  obstetric: ['pregnancy', 'prenatal', 'fetal', 'maternal', 'obstetric', 'gynecological', 'uterine',
              'placental', 'cervical', 'ovarian', 'menstrual', 'preeclampsia', 'eclampsia'],
  
  infectious: ['infection', 'bacterial', 'viral', 'fungal', 'antibiotic', 'antimicrobial', 'sepsis',
               'immunocompromised', 'pathogen', 'microorganism', 'contagious'],
  
  oncology: ['cancer', 'malignant', 'benign', 'tumor', 'metastasis', 'carcinoma', 'chemotherapy',
             'radiation', 'oncology', 'biopsy', 'staging', 'prognosis']
};

/**
 * Topic-Specific Knowledge Patterns for contextual assessment
 */
const TOPIC_SPECIFIC_PATTERNS = {
  preeclampsia: {
    keyTerms: ['preeclampsia', 'eclampsia', 'hellp', 'proteinuria', 'hypertension', 'placenta', 'maternal', 'fetal'],
    mechanisms: ['placental dysfunction', 'endothelial dysfunction', 'vasospasm', 'inflammatory response'],
    symptoms: ['headache', 'visual disturbances', 'epigastric pain', 'edema', 'oliguria'],
    complications: ['seizures', 'stroke', 'liver dysfunction', 'coagulopathy', 'fetal growth restriction'],
    management: ['magnesium sulfate', 'antihypertensive', 'delivery', 'corticosteroids', 'monitoring']
  },
  
  diabetes: {
    keyTerms: ['diabetes', 'insulin', 'glucose', 'glycemic', 'hyperglycemia', 'hypoglycemia', 'hba1c'],
    mechanisms: ['insulin resistance', 'beta cell dysfunction', 'glucose metabolism', 'pancreatic'],
    symptoms: ['polyuria', 'polydipsia', 'polyphagia', 'fatigue', 'blurred vision'],
    complications: ['neuropathy', 'nephropathy', 'retinopathy', 'cardiovascular disease', 'ketoacidosis'],
    management: ['metformin', 'insulin therapy', 'lifestyle modification', 'blood glucose monitoring']
  },
  
  hypertension: {
    keyTerms: ['hypertension', 'blood pressure', 'systolic', 'diastolic', 'cardiovascular', 'vascular'],
    mechanisms: ['peripheral resistance', 'cardiac output', 'renin-angiotensin', 'sympathetic nervous system'],
    symptoms: ['asymptomatic', 'headache', 'dyspnea', 'chest pain', 'epistaxis'],
    complications: ['stroke', 'myocardial infarction', 'heart failure', 'kidney disease', 'retinopathy'],
    management: ['ace inhibitors', 'diuretics', 'calcium channel blockers', 'lifestyle changes']
  }
};

/**
 * Clinical Decision-Making Patterns for sophisticated reasoning assessment
 */
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

/**
 * Reasoning Pattern Database for logical thinking assessment
 */
const REASONING_PATTERNS = {
  causal: ['because', 'since', 'due to', 'caused by', 'results from', 'leads to', 'results in', 
           'triggers', 'induces', 'precipitates', 'contributes to'],
  
  comparative: ['compared to', 'versus', 'rather than', 'instead of', 'unlike', 'similar to', 
                'differs from', 'in contrast', 'whereas', 'however'],
  
  conditional: ['if', 'when', 'unless', 'provided that', 'assuming', 'given that', 'in case of', 
                'should', 'would', 'could', 'might'],
  
  sequential: ['first', 'then', 'next', 'subsequently', 'following', 'after', 'before', 
               'initially', 'finally', 'eventually'],
  
  evidential: ['indicates', 'suggests', 'demonstrates', 'shows', 'reveals', 'confirms', 
               'supports', 'contradicts', 'implies', 'establishes']
};

/**
 * Assessment interface for hybrid intelligence scoring
 */
interface AssessmentScore {
  score: number;
  confidence: number;
  evidence: string[];
  reasoning: string;
}

/**
 * V3: Focused Medical Assessment with LLM
 * ONLY handles medical accuracy - no business logic
 */
export async function assessMedicalAccuracy(
  userResponse: string,
  carsonQuestion: string,
  topic: string,
  subtopic: string
): Promise<MedicalAssessmentResult> {
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
 * Check if user response indicates struggling
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
 * Sophisticated Fallback Assessment using Hybrid Intelligence
 * When LLM fails, use multiple assessment strategies for reliability
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
 * Hybrid Medical Assessment Engine
 * Combines multiple assessment strategies for optimal accuracy
 */
function hybridMedicalAssessment(userResponse: string): AssessmentScore {
  const response = userResponse.toLowerCase().trim();
  const length = response.length;
  
  // Multi-Strategy Assessment
  const vocabularyScore = assessMedicalVocabulary(response);
  const reasoningScore = assessReasoningPatterns(response);
  const structureScore = assessResponseStructure(response, length);
  const clinicalReasoningScore = assessClinicalReasoningPatterns(response);
  
  // Combine scores with dynamic weighting
  const weights = {
    vocabulary: 0.3,
    reasoning: 0.25,
    structure: 0.2,
    clinicalReasoning: 0.25
  };
  
  const weightedScore = 
    vocabularyScore.score * weights.vocabulary +
    reasoningScore.score * weights.reasoning +
    structureScore.score * weights.structure +
    clinicalReasoningScore.score * weights.clinicalReasoning;
  
  const overallConfidence = Math.min(
    vocabularyScore.confidence * weights.vocabulary +
    reasoningScore.confidence * weights.reasoning +
    structureScore.confidence * weights.structure +
    clinicalReasoningScore.confidence * weights.clinicalReasoning, 1
  );
  
  return {
    score: weightedScore,
    confidence: overallConfidence,
    evidence: [
      ...vocabularyScore.evidence,
      ...reasoningScore.evidence,
      ...structureScore.evidence,
      ...clinicalReasoningScore.evidence
    ],
    reasoning: `Hybrid assessment: vocab(${vocabularyScore.score.toFixed(2)}), reasoning(${reasoningScore.score.toFixed(2)}), structure(${structureScore.score.toFixed(2)}), clinical(${clinicalReasoningScore.score.toFixed(2)})`
  };
}

/**
 * Medical Vocabulary Assessment
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
  
  const normalizedScore = maxScore > 0 ? score / maxScore : 0;
  
  return {
    score: normalizedScore,
    confidence: normalizedScore > 0.3 ? 0.8 : 0.6,
    evidence: evidence,
    reasoning: `Medical vocabulary: ${evidence.length} relevant terms found`
  };
}

/**
 * Reasoning Pattern Assessment
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
  
  const normalizedScore = maxScore > 0 ? score / maxScore : 0;
  
  return {
    score: normalizedScore,
    confidence: normalizedScore > 0.2 ? 0.7 : 0.5,
    evidence: evidence,
    reasoning: `Reasoning patterns: ${evidence.length} logical connectors found`
  };
}

/**
 * Response Structure Assessment
 */
function assessResponseStructure(response: string, length: number): AssessmentScore {
  let score = 0;
  let evidence: string[] = [];
  
  // Length scoring (optimal range: 30-150 characters)
  const lengthScore = length >= 30 && length <= 150 ? 1 : 
                     length >= 15 && length <= 200 ? 0.7 : 0.4;
  score += lengthScore * 0.4;
  
  // Sentence structure
  const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 5);
  const sentenceScore = sentences.length >= 2 ? 1 : sentences.length === 1 ? 0.7 : 0.3;
  score += sentenceScore * 0.3;
  
  // Coherence indicators
  const coherenceMarkers = ['first', 'second', 'also', 'additionally', 'furthermore', 'moreover', 'however', 'therefore'];
  const foundCoherence = coherenceMarkers.filter(marker => response.includes(marker));
  const coherenceScore = Math.min(foundCoherence.length / 3, 1);
  score += coherenceScore * 0.3;
  evidence.push(...foundCoherence);
  
  return {
    score: Math.min(score, 1),
    confidence: 0.7,
    evidence: evidence,
    reasoning: `Structure: ${sentences.length} sentences, ${evidence.length} markers`
  };
}

/**
 * Clinical Reasoning Pattern Assessment
 */
function assessClinicalReasoningPatterns(response: string): AssessmentScore {
  let score = 0;
  let evidence: string[] = [];
  
  // Default to diagnostic context
  const patterns = CLINICAL_REASONING_PATTERNS.diagnostic;
  
  // Check for positive clinical reasoning indicators
  const positiveFound = patterns.positive.filter(pattern => response.includes(pattern));
  const positiveScore = Math.min(positiveFound.length / patterns.positive.length, 1) * 0.8;
  score += positiveScore;
  evidence.push(...positiveFound.map(p => `+${p}`));
  
  // Penalize negative indicators
  const negativeFound = patterns.negative.filter(pattern => response.includes(pattern));
  const negativePenalty = (negativeFound.length / patterns.negative.length) * 0.2;
  score = Math.max(0, score - negativePenalty);
  evidence.push(...negativeFound.map(n => `-${n}`));
  
  // Bonus for appropriate uncertainty language
  const uncertaintyPatterns = ['may', 'might', 'could', 'possible', 'likely', 'consider', 'suggest'];
  const uncertaintyFound = uncertaintyPatterns.filter(pattern => response.includes(pattern));
  if (uncertaintyFound.length > 0 && negativeFound.length === 0) {
    score += 0.1;
    evidence.push(...uncertaintyFound.map(u => `?${u}`));
  }
  
  return {
    score: Math.min(score, 1),
    confidence: positiveFound.length > 0 ? 0.75 : 0.4,
    evidence: evidence,
    reasoning: `Clinical reasoning: ${positiveFound.length} positive, ${negativeFound.length} negative indicators`
  };
}

/**
 * Helper Functions
 */
function getCategoryWeight(category: string): number {
  const weights: Record<string, number> = {
    basic: 0.1,
    advanced: 0.3,
    process: 0.25,
    anatomy: 0.2,
    clinical: 0.25,
    // Domain-specific vocabularies get higher weight
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

function mapHybridScoreToQuality(assessment: AssessmentScore): AnswerQuality {
  const { score, confidence } = assessment;
  
  // High confidence, high score
  if (confidence > 0.7 && score > 0.7) {
    return 'excellent';
  }
  
  // Good performance
  if (confidence > 0.6 && score > 0.5) {
    return 'good';
  }
  
  // Medium performance
  if (confidence > 0.5 && score > 0.3) {
    return 'partial';
  }
  
  // Low performance
  if (score < 0.3 || confidence < 0.4) {
    return 'incorrect';
  }
  
  // Default case
  return 'partial';
}

/**
 * PHASE 3 ENHANCEMENT: Advanced Clinical Reasoning Patterns
 * Sophisticated pattern recognition for medical thinking
 */

// Enhanced Clinical Reasoning Patterns - More Medical-Specific
const ADVANCED_CLINICAL_REASONING = {
  // Diagnostic reasoning patterns
  diagnostic_reasoning: {
    positive: [
      'differential diagnosis', 'rule out', 'consider', 'workup', 'investigate', 
      'assess for', 'clinical presentation', 'history and physical', 'red flags',
      'most likely', 'less likely', 'unlikely but important', 'must exclude',
      'clinical judgment', 'index of suspicion', 'pretest probability'
    ],
    negative: [
      'definitely is', 'obviously', 'clearly', 'always', 'never', 'impossible', 
      'certain', 'no doubt', 'for sure', 'guaranteed'
    ]
  },
  
  // Therapeutic reasoning patterns  
  therapeutic_reasoning: {
    positive: [
      'evidence-based', 'guidelines recommend', 'first-line', 'second-line',
      'contraindicated', 'monitor for', 'titrate', 'dose adjustment', 
      'side effects', 'efficacy', 'safety profile', 'risk-benefit',
      'individualized', 'patient factors', 'comorbidities', 'drug interactions'
    ],
    negative: [
      'cure', 'fix', 'heal completely', 'permanent solution', 'guarantee',
      'always works', 'never fails', 'miracle cure', 'perfect treatment'
    ]
  },
  
  // Risk assessment patterns
  risk_assessment: {
    positive: [
      'risk factors', 'increased risk', 'protective factors', 'relative risk',
      'odds ratio', 'confidence interval', 'statistical significance',
      'clinically significant', 'number needed to treat', 'absolute risk',
      'patient-specific', 'individualized risk', 'stratification'
    ],
    negative: [
      'no risk', 'completely safe', 'zero chance', 'will definitely',
      'never happens', 'always safe', 'impossible risk'
    ]
  },
  
  // Pathophysiological reasoning
  pathophysiology_reasoning: {
    positive: [
      'mechanism', 'pathway', 'cascade', 'upstream', 'downstream',
      'feedback loop', 'homeostasis', 'compensation', 'decompensation',
      'molecular level', 'cellular', 'tissue', 'organ system',
      'physiological response', 'pathological process'
    ],
    negative: [
      'just happens', 'simple', 'basic', 'easy', 'obvious mechanism',
      'no real reason', 'random', 'mysterious'
    ]
  },
  
  // Evidence-based reasoning
  evidence_based: {
    positive: [
      'research shows', 'studies indicate', 'meta-analysis', 'systematic review',
      'randomized controlled trial', 'evidence suggests', 'data supports',
      'clinical trials', 'peer-reviewed', 'level of evidence', 'grade of recommendation',
      'cochrane review', 'evidence quality', 'study limitations'
    ],
    negative: [
      'i heard', 'someone said', 'i think', 'probably', 'maybe',
      'common sense', 'everyone knows', 'obvious', 'anecdotal'
    ]
  },

  // Clinical correlation patterns
  clinical_correlation: {
    positive: [
      'correlates with', 'associated with', 'predicts', 'indicates',
      'suggests', 'consistent with', 'supportive of', 'concordant',
      'clinical significance', 'prognostic value', 'diagnostic value',
      'sensitivity', 'specificity', 'positive predictive value'
    ],
    negative: [
      'definitely means', 'proves', 'confirms absolutely', 'guarantees',
      'no other explanation', 'only possibility', 'certain diagnosis'
    ]
  }
};

// Medical specialty-specific reasoning patterns
const SPECIALTY_REASONING_PATTERNS = {
  cardiology: {
    patterns: ['hemodynamics', 'preload', 'afterload', 'contractility', 'ejection fraction',
              'coronary perfusion', 'myocardial oxygen demand', 'ischemia', 'arrhythmia'],
    reasoning: ['risk stratification', 'functional capacity', 'exercise tolerance']
  },
  
  obstetrics: {
    patterns: ['maternal-fetal', 'gestational age', 'fetal well-being', 'uterine contractions',
              'cervical changes', 'fetal heart rate', 'placental function'],
    reasoning: ['delivery planning', 'fetal monitoring', 'maternal safety']
  },
  
  emergency: {
    patterns: ['triage', 'acuity', 'life-threatening', 'time-sensitive', 'rapid assessment',
              'abc assessment', 'primary survey', 'secondary survey'],
    reasoning: ['priority setting', 'resource allocation', 'disposition planning']
  },
  
  internal_medicine: {
    patterns: ['systems-based', 'multimorbidity', 'polypharmacy', 'functional status',
              'quality of life', 'care coordination', 'chronic disease management'],
    reasoning: ['comprehensive assessment', 'longitudinal care', 'preventive care']
  }
};

/**
 * PHASE 3: Advanced Clinical Reasoning Assessment
 * Much more sophisticated than the original version
 */
export function assessAdvancedClinicalReasoning(
  userResponse: string,
  subtopicTitle: string,
  topic: string
): {
  reasoningScore: number;
  reasoningType: string;
  sophisticationLevel: 'novice' | 'intermediate' | 'advanced';
  clinicalThinking: string[];
  evidence: string[];
  recommendations: string[];
} {
  
  const response = userResponse.toLowerCase();
  
  // Determine primary reasoning context
  const reasoningContext = identifyAdvancedReasoningContext(subtopicTitle);
  const specialtyContext = identifySpecialtyContext(topic);
  
  let totalScore = 0;
  let evidence: string[] = [];
  let clinicalThinking: string[] = [];
  
  // Score each reasoning pattern category
  const categoryScores = Object.entries(ADVANCED_CLINICAL_REASONING).map(([category, patterns]) => {
    const positiveFound = patterns.positive.filter(pattern => response.includes(pattern));
    const negativeFound = patterns.negative.filter(pattern => response.includes(pattern));
    
    const positiveScore = positiveFound.length * 2; // Weight positive patterns highly
    const negativePenalty = negativeFound.length * 1; // Penalty for non-clinical thinking
    
    const categoryScore = Math.max(0, positiveScore - negativePenalty);
    
    if (positiveFound.length > 0) {
      evidence.push(...positiveFound.map(p => `${category}:${p}`));
      clinicalThinking.push(`Shows ${category.replace('_', ' ')}`);
    }
    
    return { category, score: categoryScore, weight: getAdvancedCategoryWeight(category, reasoningContext) };
  });
  
  // Calculate weighted total score
  totalScore = categoryScores.reduce((sum, {score, weight}) => sum + (score * weight), 0);
  
  // Specialty-specific bonus
  const specialtyBonus = assessSpecialtySpecificReasoning(response, specialtyContext);
  totalScore += specialtyBonus.score;
  evidence.push(...specialtyBonus.evidence);
  
  // Normalize score (0-1)
  const maxPossibleScore = 20; // Empirically determined
  const normalizedScore = Math.min(totalScore / maxPossibleScore, 1);
  
  // Determine sophistication level
  const sophisticationLevel = determineSophisticationLevel(
    normalizedScore, 
    clinicalThinking.length, 
    response.length
  );
  
  // Generate recommendations
  const recommendations = generateReasoningRecommendations(
    normalizedScore,
    clinicalThinking,
    reasoningContext
  );
  
  return {
    reasoningScore: normalizedScore,
    reasoningType: reasoningContext,
    sophisticationLevel,
    clinicalThinking,
    evidence,
    recommendations
  };
}

/**
 * PHASE 3: Identify advanced reasoning context
 */
function identifyAdvancedReasoningContext(subtopicTitle: string): string {
  const title = subtopicTitle.toLowerCase();
  
  if (title.includes('diagnosis') || title.includes('differential') || title.includes('assessment')) {
    return 'diagnostic_reasoning';
  }
  if (title.includes('treatment') || title.includes('management') || title.includes('therapy')) {
    return 'therapeutic_reasoning';
  }
  if (title.includes('risk') || title.includes('factor') || title.includes('epidemiology')) {
    return 'risk_assessment';
  }
  if (title.includes('pathophysiology') || title.includes('mechanism') || title.includes('physiology')) {
    return 'pathophysiology_reasoning';
  }
  if (title.includes('evidence') || title.includes('research') || title.includes('study')) {
    return 'evidence_based';
  }
  
  return 'diagnostic_reasoning'; // Default
}

/**
 * PHASE 3: Identify medical specialty context
 */
function identifySpecialtyContext(topic: string): keyof typeof SPECIALTY_REASONING_PATTERNS | 'general' {
  const topicLower = topic.toLowerCase();
  
  if (topicLower.includes('cardiac') || topicLower.includes('heart') || topicLower.includes('coronary')) {
    return 'cardiology';
  }
  if (topicLower.includes('pregnancy') || topicLower.includes('obstetric') || topicLower.includes('fetal')) {
    return 'obstetrics';
  }
  if (topicLower.includes('emergency') || topicLower.includes('acute') || topicLower.includes('trauma')) {
    return 'emergency';
  }
  if (topicLower.includes('internal') || topicLower.includes('chronic') || topicLower.includes('systemic')) {
    return 'internal_medicine';
  }
  
  return 'general';
}

/**
 * PHASE 3: Assess specialty-specific reasoning patterns
 */
function assessSpecialtySpecificReasoning(
  response: string,
  specialtyContext: keyof typeof SPECIALTY_REASONING_PATTERNS | 'general'
): { score: number; evidence: string[] } {
  
  if (specialtyContext === 'general') {
    return { score: 0, evidence: [] };
  }
  
  const specialty = SPECIALTY_REASONING_PATTERNS[specialtyContext];
  const evidence: string[] = [];
  
  // Check for specialty-specific patterns
  const patternsFound = specialty.patterns.filter(pattern => response.includes(pattern));
  evidence.push(...patternsFound.map(p => `specialty:${p}`));
  
  // Check for specialty-specific reasoning
  const reasoningFound = specialty.reasoning.filter(reasoning => response.includes(reasoning));
  evidence.push(...reasoningFound.map(r => `reasoning:${r}`));
  
  const totalFound = patternsFound.length + reasoningFound.length;
  const score = Math.min(totalFound * 0.5, 3); // Bonus up to 3 points
  
  return { score, evidence };
}

/**
 * PHASE 3: Get category weight based on reasoning context
 */
function getAdvancedCategoryWeight(category: string, reasoningContext: string): number {
  const weights: Record<string, Record<string, number>> = {
    diagnostic_reasoning: {
      diagnostic_reasoning: 0.4,
      pathophysiology_reasoning: 0.2,
      evidence_based: 0.2,
      clinical_correlation: 0.2
    },
    therapeutic_reasoning: {
      therapeutic_reasoning: 0.4,
      evidence_based: 0.3,
      risk_assessment: 0.2,
      clinical_correlation: 0.1
    },
    pathophysiology_reasoning: {
      pathophysiology_reasoning: 0.5,
      diagnostic_reasoning: 0.2,
      clinical_correlation: 0.2,
      evidence_based: 0.1
    },
    risk_assessment: {
      risk_assessment: 0.4,
      evidence_based: 0.3,
      diagnostic_reasoning: 0.2,
      clinical_correlation: 0.1
    }
  };
  
  return weights[reasoningContext]?.[category] || 0.1;
}

/**
 * PHASE 3: Determine sophistication level
 */
function determineSophisticationLevel(
  score: number,
  thinkingPatterns: number,
  responseLength: number
): 'novice' | 'intermediate' | 'advanced' {
  
  // Advanced: High score + multiple thinking patterns + substantial response
  if (score > 0.7 && thinkingPatterns >= 3 && responseLength > 100) {
    return 'advanced';
  }
  
  // Intermediate: Moderate score + some thinking patterns
  if (score > 0.4 && thinkingPatterns >= 2) {
    return 'intermediate';
  }
  
  // Novice: Lower scores or simple responses
  return 'novice';
}

/**
 * PHASE 3: Generate reasoning improvement recommendations
 */
function generateReasoningRecommendations(
  score: number,
  clinicalThinking: string[],
  reasoningContext: string
): string[] {
  
  const recommendations: string[] = [];
  
  if (score < 0.3) {
    recommendations.push('Focus on clinical reasoning fundamentals');
    recommendations.push('Practice structured problem-solving approaches');
  }
  
  if (clinicalThinking.length === 0) {
    recommendations.push('Incorporate more clinical thinking language');
    recommendations.push('Consider differential diagnosis approaches');
  }
  
  // Context-specific recommendations
  switch (reasoningContext) {
    case 'diagnostic_reasoning':
      if (!clinicalThinking.some(t => t.includes('diagnostic'))) {
        recommendations.push('Develop systematic diagnostic reasoning skills');
      }
      break;
    case 'therapeutic_reasoning':
      if (!clinicalThinking.some(t => t.includes('therapeutic'))) {
        recommendations.push('Consider evidence-based treatment approaches');
      }
      break;
    case 'pathophysiology_reasoning':
      if (!clinicalThinking.some(t => t.includes('pathophysiology'))) {
        recommendations.push('Connect mechanisms to clinical presentations');
      }
      break;
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Continue developing clinical reasoning skills');
  }
  
  return recommendations;
} 