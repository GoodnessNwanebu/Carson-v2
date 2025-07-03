// Study Path Builder - Generates educationally sound subtopic progressions
// Creates the learning path structure that powers the knowledge map
//
// Educational Philosophy:
// - Medical education requires rigorous standards for all students
// - We do not adjust difficulty or content based on perceived student level
// - All students receive the same comprehensive, structured approach to each topic
// - This ensures every student receives the thorough education necessary for medical practice
// - Teaching methodology may adapt based on student responses, but content depth remains consistent

import { Subtopic, StudyPath } from './types';

export interface StudyPathOptions {
  /** Maximum number of subtopics to generate */
  maxSubtopics?: number;
  /** Focus areas to emphasize */
  focusAreas?: string[];
  /** Learning objectives to target */
  learningObjectives?: string[];
}

export interface SubtopicBlueprint {
  title: string;
  description: string;
  difficulty: 'fundamental' | 'intermediate' | 'advanced';
  prerequisites: string[];
  coreGaps: string[];
  estimatedDuration: number; // minutes
  clinicalRelevance: 'high' | 'medium' | 'low';
  category: 'pathophysiology' | 'diagnosis' | 'treatment' | 'complications' | 'prevention';
}

export interface StudyPathValidation {
  isValid: boolean;
  issues: string[];
  suggestions: string[];
  educationalQuality: number; // 0-1 score
  progressionLogic: number; // 0-1 score
}

export class StudyPathBuilder {
  
  /**
   * Generate a complete study path for a medical topic
   * This is the main entry point for creating learning progressions
   */
  static generateStudyPath(
    topic: string, 
    options: StudyPathOptions = {}
  ): StudyPath {
    console.log(`📚 Generating study path for: ${topic}`);
    
    try {
      // Step 1: Identify key subtopics for this topic
      const subtopicBlueprints = this.identifyKeySubtopics(topic, options);
      
      // Step 2: Create logical learning progression
      const orderedBlueprints = this.createLearningProgression(subtopicBlueprints, options);
      
      // Step 3: Convert blueprints to actual subtopics
      const subtopics = this.buildSubtopicsFromBlueprints(orderedBlueprints, topic);
      
      // Step 4: Create study path structure
      const studyPath: StudyPath = {
        topic,
        subtopics,
        totalEstimatedDuration: this.calculateTotalDuration(subtopics),
        difficulty: this.assessOverallDifficulty(subtopics),
        learningObjectives: this.generateLearningObjectives(topic, subtopics),
        createdAt: new Date(),
        lastUpdated: new Date()
      };
      
      // Step 5: Validate educational quality
      const validation = this.validateStudyPath(studyPath);
      if (!validation.isValid) {
        console.warn('Study path validation issues:', validation.issues);
        // Could enhance based on validation, but proceed for now
      }
      
      console.log(`✅ Generated study path with ${subtopics.length} subtopics`);
      return studyPath;
      
    } catch (error) {
      console.error('Study path generation failed:', error);
      return this.createFallbackStudyPath(topic);
    }
  }

  /**
   * Identify the most important subtopics for understanding a medical topic
   * This uses medical education principles to determine core concepts
   */
  private static identifyKeySubtopics(
    topic: string, 
    options: StudyPathOptions
  ): SubtopicBlueprint[] {
    
    // This would ideally use an LLM or knowledge base
    // For now, we'll use rule-based generation with medical education principles
    
    const blueprints: SubtopicBlueprint[] = [];
    const maxSubtopics = options.maxSubtopics || 8;
    
    // Core medical topic patterns
    if (this.isConditionTopic(topic)) {
      blueprints.push(...this.generateConditionSubtopics(topic, options));
    } else if (this.isSystemTopic(topic)) {
      blueprints.push(...this.generateSystemSubtopics(topic, options));
    } else if (this.isProcedureTopic(topic)) {
      blueprints.push(...this.generateProcedureSubtopics(topic, options));
    } else {
      // General medical topic
      blueprints.push(...this.generateGeneralSubtopics(topic, options));
    }
    
    // Filter by focus areas if specified
    const filteredBlueprints = options.focusAreas 
      ? this.filterByFocusAreas(blueprints, options.focusAreas)
      : blueprints;
    
    // Limit to max subtopics, prioritizing by educational importance
    return this.prioritizeSubtopics(filteredBlueprints, maxSubtopics);
  }

  /**
   * Create logical learning progression from subtopic blueprints
   * Orders subtopics for optimal learning flow
   */
  private static createLearningProgression(
    blueprints: SubtopicBlueprint[], 
    options: StudyPathOptions
  ): SubtopicBlueprint[] {
    
    console.log('🔄 Creating learning progression...');
    
    // Step 1: Sort by educational progression principles
    const sortedBlueprints = [...blueprints].sort((a, b) => {
      // Primary sort: difficulty (fundamental first)
      const difficultyOrder = { 'fundamental': 0, 'intermediate': 1, 'advanced': 2 };
      const difficultyDiff = difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty];
      if (difficultyDiff !== 0) return difficultyDiff;
      
      // Secondary sort: clinical relevance (high first within same difficulty)
      const relevanceOrder = { 'high': 0, 'medium': 1, 'low': 2 };
      const relevanceDiff = relevanceOrder[a.clinicalRelevance] - relevanceOrder[b.clinicalRelevance];
      if (relevanceDiff !== 0) return relevanceDiff;
      
      // Tertiary sort: category preference (pathophysiology → diagnosis → treatment)
      const categoryOrder = { 
        'pathophysiology': 0, 
        'diagnosis': 1, 
        'treatment': 2, 
        'complications': 3, 
        'prevention': 4 
      };
      return categoryOrder[a.category] - categoryOrder[b.category];
    });
    
    // Step 2: Ensure prerequisite dependencies are respected
    const orderedBlueprints = this.resolvePrerequisites(sortedBlueprints);
    
    // Step 3: Apply consistent educational rigor for all students
    return this.finalizeSubtopicProgression(orderedBlueprints);
  }

  /**
   * Convert blueprints to actual Subtopic objects
   */
  private static buildSubtopicsFromBlueprints(
    blueprints: SubtopicBlueprint[], 
    parentTopic: string
  ): Subtopic[] {
    
    return blueprints.map((blueprint, index) => ({
      id: `${parentTopic.toLowerCase().replace(/\s+/g, '-')}-${index + 1}`,
      title: blueprint.title,
      description: blueprint.description,
      primaryGaps: new Set(blueprint.coreGaps),
      completedConcepts: new Set<string>(),
      currentFocus: null,
      isCompleted: false,
      difficulty: blueprint.difficulty,
      estimatedDuration: blueprint.estimatedDuration,
      prerequisites: blueprint.prerequisites,
      clinicalRelevance: blueprint.clinicalRelevance,
      category: blueprint.category
    }));
  }

  /**
   * Generate subtopics for medical conditions (diseases, disorders)
   */
  private static generateConditionSubtopics(
    topic: string, 
    options: StudyPathOptions
  ): SubtopicBlueprint[] {
    
    const blueprints: SubtopicBlueprint[] = [
      {
        title: `Understanding ${topic}`,
        description: `Core definition, epidemiology, and classification of ${topic}`,
        difficulty: 'fundamental',
        prerequisites: [],
        coreGaps: ['definition', 'epidemiology', 'classification', 'prevalence'],
        estimatedDuration: 15,
        clinicalRelevance: 'high',
        category: 'pathophysiology'
      },
      {
        title: `${topic} Pathophysiology`,
        description: `Underlying mechanisms and disease processes`,
        difficulty: 'intermediate',
        prerequisites: [`Understanding ${topic}`],
        coreGaps: ['etiology', 'pathogenesis', 'physiologic_changes', 'cellular_mechanisms'],
        estimatedDuration: 25,
        clinicalRelevance: 'high',
        category: 'pathophysiology'
      },
      {
        title: `Risk Factors for ${topic}`,
        description: `Modifiable and non-modifiable risk factors`,
        difficulty: 'fundamental',
        prerequisites: [`Understanding ${topic}`],
        coreGaps: ['modifiable_risks', 'non_modifiable_risks', 'genetic_factors', 'environmental_factors'],
        estimatedDuration: 20,
        clinicalRelevance: 'high',
        category: 'pathophysiology'
      },
      {
        title: `Clinical Presentation of ${topic}`,
        description: `Signs, symptoms, and clinical manifestations`,
        difficulty: 'intermediate',
        prerequisites: [`${topic} Pathophysiology`],
        coreGaps: ['presenting_symptoms', 'physical_exam_findings', 'clinical_course', 'severity_staging'],
        estimatedDuration: 20,
        clinicalRelevance: 'high',
        category: 'diagnosis'
      },
      {
        title: `Diagnosing ${topic}`,
        description: `Diagnostic criteria, tests, and differential diagnosis`,
        difficulty: 'intermediate',
        prerequisites: [`Clinical Presentation of ${topic}`],
        coreGaps: ['diagnostic_criteria', 'laboratory_tests', 'imaging_studies', 'differential_diagnosis'],
        estimatedDuration: 25,
        clinicalRelevance: 'high',
        category: 'diagnosis'
      },
      {
        title: `Treatment of ${topic}`,
        description: `Management strategies, medications, and interventions`,
        difficulty: 'advanced',
        prerequisites: [`Diagnosing ${topic}`],
        coreGaps: ['first_line_treatment', 'alternative_treatments', 'medication_management', 'monitoring'],
        estimatedDuration: 30,
        clinicalRelevance: 'high',
        category: 'treatment'
      },
      {
        title: `${topic} Complications`,
        description: `Potential complications and their management`,
        difficulty: 'advanced',
        prerequisites: [`Treatment of ${topic}`],
        coreGaps: ['acute_complications', 'chronic_complications', 'complication_prevention', 'emergency_management'],
        estimatedDuration: 20,
        clinicalRelevance: 'medium',
        category: 'complications'
      },
      {
        title: `Prevention of ${topic}`,
        description: `Primary and secondary prevention strategies`,
        difficulty: 'intermediate',
        prerequisites: [`Risk Factors for ${topic}`],
        coreGaps: ['primary_prevention', 'secondary_prevention', 'lifestyle_modifications', 'screening'],
        estimatedDuration: 15,
        clinicalRelevance: 'medium',
        category: 'prevention'
      }
    ];
    
    return blueprints;
  }

  /**
   * Generate subtopics for body systems (cardiovascular, respiratory, etc.)
   */
  private static generateSystemSubtopics(
    topic: string, 
    options: StudyPathOptions
  ): SubtopicBlueprint[] {
    
    const blueprints: SubtopicBlueprint[] = [
      {
        title: `${topic} Anatomy`,
        description: `Structural components and organization`,
        difficulty: 'fundamental',
        prerequisites: [],
        coreGaps: ['anatomical_structures', 'organization', 'relationships', 'variations'],
        estimatedDuration: 25,
        clinicalRelevance: 'high',
        category: 'pathophysiology'
      },
      {
        title: `${topic} Physiology`,
        description: `Normal function and regulatory mechanisms`,
        difficulty: 'intermediate',
        prerequisites: [`${topic} Anatomy`],
        coreGaps: ['normal_function', 'regulatory_mechanisms', 'homeostasis', 'integration'],
        estimatedDuration: 30,
        clinicalRelevance: 'high',
        category: 'pathophysiology'
      },
      {
        title: `Common ${topic} Disorders`,
        description: `Most frequently encountered pathologies`,
        difficulty: 'intermediate',
        prerequisites: [`${topic} Physiology`],
        coreGaps: ['common_conditions', 'prevalence', 'classification', 'impact'],
        estimatedDuration: 25,
        clinicalRelevance: 'high',
        category: 'pathophysiology'
      },
      {
        title: `${topic} Assessment`,
        description: `Clinical evaluation and diagnostic approaches`,
        difficulty: 'intermediate',
        prerequisites: [`${topic} Physiology`],
        coreGaps: ['history_taking', 'physical_examination', 'diagnostic_tests', 'interpretation'],
        estimatedDuration: 20,
        clinicalRelevance: 'high',
        category: 'diagnosis'
      }
    ];
    
    return blueprints;
  }

  /**
   * Generate subtopics for procedures
   */
  private static generateProcedureSubtopics(
    topic: string, 
    options: StudyPathOptions
  ): SubtopicBlueprint[] {
    
    const blueprints: SubtopicBlueprint[] = [
      {
        title: `${topic} Indications`,
        description: `When and why the procedure is performed`,
        difficulty: 'fundamental',
        prerequisites: [],
        coreGaps: ['indications', 'contraindications', 'patient_selection', 'timing'],
        estimatedDuration: 15,
        clinicalRelevance: 'high',
        category: 'diagnosis'
      },
      {
        title: `${topic} Technique`,
        description: `Step-by-step procedure and technical considerations`,
        difficulty: 'advanced',
        prerequisites: [`${topic} Indications`],
        coreGaps: ['procedure_steps', 'technical_details', 'equipment', 'variations'],
        estimatedDuration: 35,
        clinicalRelevance: 'high',
        category: 'treatment'
      },
      {
        title: `${topic} Complications`,
        description: `Potential risks and their management`,
        difficulty: 'advanced',
        prerequisites: [`${topic} Technique`],
        coreGaps: ['immediate_complications', 'delayed_complications', 'risk_factors', 'prevention'],
        estimatedDuration: 20,
        clinicalRelevance: 'high',
        category: 'complications'
      }
    ];
    
    return blueprints;
  }

  /**
   * Generate general subtopics for other medical topics
   */
  private static generateGeneralSubtopics(
    topic: string, 
    options: StudyPathOptions
  ): SubtopicBlueprint[] {
    
    const blueprints: SubtopicBlueprint[] = [
      {
        title: `Introduction to ${topic}`,
        description: `Fundamental concepts and overview`,
        difficulty: 'fundamental',
        prerequisites: [],
        coreGaps: ['basic_concepts', 'definitions', 'scope', 'importance'],
        estimatedDuration: 20,
        clinicalRelevance: 'high',
        category: 'pathophysiology'
      },
      {
        title: `Core Principles of ${topic}`,
        description: `Key principles and mechanisms`,
        difficulty: 'intermediate',
        prerequisites: [`Introduction to ${topic}`],
        coreGaps: ['key_principles', 'mechanisms', 'relationships', 'applications'],
        estimatedDuration: 25,
        clinicalRelevance: 'high',
        category: 'pathophysiology'
      },
      {
        title: `Clinical Applications of ${topic}`,
        description: `Practical applications in clinical practice`,
        difficulty: 'intermediate',
        prerequisites: [`Core Principles of ${topic}`],
        coreGaps: ['clinical_relevance', 'practical_applications', 'case_examples', 'decision_making'],
        estimatedDuration: 25,
        clinicalRelevance: 'high',
        category: 'diagnosis'
      }
    ];
    
    return blueprints;
  }

  // Helper methods for topic classification
  private static isConditionTopic(topic: string): boolean {
    const conditionKeywords = [
      'disease', 'disorder', 'syndrome', 'condition', 'pathology',
      'infection', 'cancer', 'tumor', 'carcinoma', 'failure',
      'hypertension', 'diabetes', 'asthma', 'pneumonia', 'preeclampsia'
    ];
    
    return conditionKeywords.some(keyword => 
      topic.toLowerCase().includes(keyword)
    );
  }

  private static isSystemTopic(topic: string): boolean {
    const systemKeywords = [
      'cardiovascular', 'respiratory', 'nervous', 'endocrine',
      'digestive', 'renal', 'reproductive', 'musculoskeletal',
      'immune', 'system', 'anatomy', 'physiology'
    ];
    
    return systemKeywords.some(keyword => 
      topic.toLowerCase().includes(keyword)
    );
  }

  private static isProcedureTopic(topic: string): boolean {
    const procedureKeywords = [
      'surgery', 'procedure', 'technique', 'operation',
      'biopsy', 'catheterization', 'intubation', 'resection'
    ];
    
    return procedureKeywords.some(keyword => 
      topic.toLowerCase().includes(keyword)
    );
  }

  // Helper methods for progression optimization
  private static filterByFocusAreas(
    blueprints: SubtopicBlueprint[], 
    focusAreas: string[]
  ): SubtopicBlueprint[] {
    // Filter blueprints that match focus areas
    return blueprints.filter(blueprint => 
      focusAreas.some(area => 
        blueprint.title.toLowerCase().includes(area.toLowerCase()) ||
        blueprint.category === area.toLowerCase()
      )
    );
  }

  private static prioritizeSubtopics(
    blueprints: SubtopicBlueprint[], 
    maxCount: number
  ): SubtopicBlueprint[] {
    // Sort by educational priority and take top N
    const prioritized = [...blueprints].sort((a, b) => {
      // High clinical relevance first
      if (a.clinicalRelevance === 'high' && b.clinicalRelevance !== 'high') return -1;
      if (b.clinicalRelevance === 'high' && a.clinicalRelevance !== 'high') return 1;
      
      // Fundamental difficulty first within same relevance
      const difficultyOrder = { 'fundamental': 0, 'intermediate': 1, 'advanced': 2 };
      return difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty];
    });
    
    return prioritized.slice(0, maxCount);
  }

  private static resolvePrerequisites(blueprints: SubtopicBlueprint[]): SubtopicBlueprint[] {
    // Simple prerequisite resolution - ensure prerequisites come before dependents
    const resolved: SubtopicBlueprint[] = [];
    const remaining = [...blueprints];
    
    while (remaining.length > 0) {
      const canAdd = remaining.filter(blueprint => 
        blueprint.prerequisites.every(prereq => 
          resolved.some(resolved => resolved.title === prereq)
        )
      );
      
      if (canAdd.length === 0) {
        // No more can be added due to circular dependencies - add remaining anyway
        resolved.push(...remaining);
        break;
      }
      
      resolved.push(...canAdd);
      canAdd.forEach(added => {
        const index = remaining.indexOf(added);
        remaining.splice(index, 1);
      });
    }
    
    return resolved;
  }

  private static finalizeSubtopicProgression(
    blueprints: SubtopicBlueprint[]
  ): SubtopicBlueprint[] {
    // Return all blueprints with consistent educational rigor for all students
    return blueprints;
  }

  // Utility methods
  private static calculateTotalDuration(subtopics: Subtopic[]): number {
    return subtopics.reduce((total, subtopic) => total + (subtopic.estimatedDuration || 20), 0);
  }

  private static assessOverallDifficulty(subtopics: Subtopic[]): 'beginner' | 'intermediate' | 'advanced' {
    // Medical education should maintain rigorous standards for all students
    return 'advanced';
  }

  private static generateLearningObjectives(topic: string, subtopics: Subtopic[]): string[] {
    return [
      `Understand the fundamental concepts of ${topic}`,
      `Analyze the clinical significance and applications`,
      `Apply knowledge to clinical scenarios`,
      `Evaluate patient presentations and make informed decisions`
    ];
  }

  /**
   * Validate the educational quality of a study path
   */
  private static validateStudyPath(studyPath: StudyPath): StudyPathValidation {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let educationalQuality = 1.0;
    let progressionLogic = 1.0;
    
    // Check for minimum subtopics
    if (studyPath.subtopics.length < 3) {
      issues.push('Too few subtopics for comprehensive understanding');
      suggestions.push('Add more subtopics to cover essential concepts');
      educationalQuality -= 0.3;
    }
    
    // Check for logical progression
    const fundamentalCount = studyPath.subtopics.filter(s => s.difficulty === 'fundamental').length;
    if (fundamentalCount === 0) {
      issues.push('No fundamental concepts - may be too advanced');
      suggestions.push('Include foundational concepts for better understanding');
      progressionLogic -= 0.4;
    }
    
    // Check duration balance
    const totalDuration = studyPath.totalEstimatedDuration;
    if (totalDuration > 300) { // 5 hours
      issues.push('Study path may be too long for single session');
      suggestions.push('Consider breaking into multiple sessions');
      educationalQuality -= 0.1;
    }
    
    return {
      isValid: issues.length === 0,
      issues,
      suggestions,
      educationalQuality: Math.max(0, educationalQuality),
      progressionLogic: Math.max(0, progressionLogic)
    };
  }

  /**
   * Create fallback study path when generation fails
   */
  private static createFallbackStudyPath(topic: string): StudyPath {
    const fallbackSubtopics: Subtopic[] = [
      {
        id: `${topic.toLowerCase().replace(/\s+/g, '-')}-overview`,
        title: `Overview of ${topic}`,
        description: `Introduction to key concepts of ${topic}`,
        primaryGaps: new Set(['definition', 'importance', 'key_concepts']),
        completedConcepts: new Set(),
        currentFocus: null,
        isCompleted: false,
        difficulty: 'fundamental',
        estimatedDuration: 20,
        prerequisites: [],
        clinicalRelevance: 'high',
        category: 'pathophysiology'
      }
    ];
    
    return {
      topic,
      subtopics: fallbackSubtopics,
      totalEstimatedDuration: 20,
      difficulty: 'beginner',
      learningObjectives: [`Understand basic concepts of ${topic}`],
      createdAt: new Date(),
      lastUpdated: new Date()
    };
  }

  // Future slide drawer functions (mentioned but not implemented yet)
  // These will be implemented when we add the slide drawer feature:
  //
  // static generateSlideContent(subtopic: Subtopic): SlideContent[]
  // static createInteractiveElements(subtopic: Subtopic): InteractiveElement[]
  // static generateQuizQuestions(subtopic: Subtopic): QuizQuestion[]
  // static createVisualAids(subtopic: Subtopic): VisualAid[]
  // static buildProgressIndicators(studyPath: StudyPath): ProgressIndicator[]
} 