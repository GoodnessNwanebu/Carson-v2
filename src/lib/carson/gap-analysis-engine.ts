// Gap Analysis Engine - Smart gap management with stack system
// This is the core innovation of Carson v3 architecture

import { 
  Gap, 
  SubtopicState, 
  AssessmentResult, 
  ConversationStrategy, 
  Subtopic,
  DEFAULT_CONFIG 
} from './types';

export class GapAnalysisEngine {
  
  /**
   * Initialize gap stack for a new subtopic
   * Sets up all primary gaps that need to be addressed
   */
  static initializeGapStack(subtopic: Subtopic): SubtopicState {
    console.log(`🎯 Initializing gap stack for subtopic: ${subtopic.title}`);
    
    // All expected concepts start as primary gaps
    const primaryGaps = new Set(subtopic.expectedConcepts);
    
    const gapStack: SubtopicState = {
      primaryGaps,
      currentFocus: null,
      completedConcepts: new Set(),
      subtopicId: subtopic.id
    };
    
    console.log(`📊 Gap stack initialized with ${primaryGaps.size} primary gaps:`, 
      Array.from(primaryGaps));
    
    return gapStack;
  }

  /**
   * Update gap stack based on assessment results
   * This is where the magic happens - systematic gap management
   */
  static updateGapStack(
    gapStack: SubtopicState,
    assessment: AssessmentResult,
    subtopic: Subtopic
  ): { 
    updatedGapStack: SubtopicState; 
    identifiedGaps: Gap[]; 
    strategy: ConversationStrategy;
  } {
    
    console.log(`🔄 Updating gap stack for subtopic: ${subtopic.title}`);
    console.log(`📝 Assessment status: ${assessment.status}`);
    console.log(`✅ Concepts correct: ${assessment.conceptsCorrect}`);
    console.log(`❌ Concepts missing: ${assessment.conceptsMissing}`);
    
    // Clone the gap stack to avoid mutations
    const updatedGapStack: SubtopicState = {
      primaryGaps: new Set(gapStack.primaryGaps),
      currentFocus: gapStack.currentFocus,
      completedConcepts: new Set(gapStack.completedConcepts),
      subtopicId: gapStack.subtopicId
    };
    
    // Process concepts that were demonstrated correctly
    assessment.conceptsCorrect.forEach(concept => {
      updatedGapStack.completedConcepts.add(concept);
      updatedGapStack.primaryGaps.delete(concept);
      
      // If this was our current focus, clear it
      if (updatedGapStack.currentFocus === concept) {
        updatedGapStack.currentFocus = null;
      }
    });
    
    // Identify new gaps from missing concepts
    const identifiedGaps: Gap[] = [];
    
    assessment.conceptsMissing.forEach(concept => {
      const gap = this.createGap(concept, subtopic);
      identifiedGaps.push(gap);
      
      // Add to primary gaps if it's in scope
      if (gap.type === 'in_scope') {
        updatedGapStack.primaryGaps.add(concept);
      }
    });
    
    // Determine conversation strategy
    const strategy = this.determineConversationStrategy(
      updatedGapStack,
      assessment,
      subtopic
    );
    
    console.log(`🎯 Updated gap stack:`, {
      primaryGaps: Array.from(updatedGapStack.primaryGaps),
      currentFocus: updatedGapStack.currentFocus,
      completedConcepts: Array.from(updatedGapStack.completedConcepts),
      strategy: strategy.action
    });
    
    return {
      updatedGapStack,
      identifiedGaps,
      strategy
    };
  }

  /**
   * Determine the next conversation strategy based on gap stack state
   */
  private static determineConversationStrategy(
    gapStack: SubtopicState,
    assessment: AssessmentResult,
    subtopic: Subtopic
  ): ConversationStrategy {
    
    // Check if we should transition to next subtopic
    if (this.shouldTransitionSubtopic(gapStack, subtopic)) {
      return {
        action: 'transition',
        nextSubtopic: this.getNextSubtopic(subtopic)
      };
    }
    
    // If we have a current focus, decide whether to continue or move on
    if (gapStack.currentFocus) {
      if (assessment.conceptsCorrect.includes(gapStack.currentFocus)) {
        // Current focus completed, move to next primary gap
        return this.selectNextPrimaryGap(gapStack, subtopic);
      } else {
        // Continue working on current focus (remediation)
        return {
          action: 'remediate',
          focus: gapStack.currentFocus,
          remediationType: this.selectRemediationType(gapStack.currentFocus, assessment)
        };
      }
    }
    
    // No current focus, select next primary gap to work on
    return this.selectNextPrimaryGap(gapStack, subtopic);
  }

  /**
   * Select the next primary gap to focus on
   */
  private static selectNextPrimaryGap(
    gapStack: SubtopicState,
    subtopic: Subtopic
  ): ConversationStrategy {
    
    if (gapStack.primaryGaps.size === 0) {
      return {
        action: 'transition',
        nextSubtopic: this.getNextSubtopic(subtopic)
      };
    }
    
    // For now, select the first primary gap
    // Later we can add prioritization logic (clinical importance, difficulty, etc.)
    const nextGap = Array.from(gapStack.primaryGaps)[0];
    
    // Update current focus (this will be handled by the caller)
    return {
      action: 'continue',
      focus: nextGap
    };
  }

  /**
   * Create a Gap object from a missing concept
   */
  private static createGap(concept: string, subtopic: Subtopic): Gap {
    const isInScope = subtopic.expectedConcepts.includes(concept);
    const severity = this.determineGapSeverity(concept, subtopic);
    
    return {
      concept,
      type: isInScope ? 'in_scope' : 'out_of_scope',
      severity,
      targetSubtopic: isInScope ? undefined : this.findTargetSubtopic(concept),
      attempts: 0
    };
  }

  /**
   * Determine gap severity based on concept importance
   */
  private static determineGapSeverity(
    concept: string,
    subtopic: Subtopic
  ): 'critical' | 'important' | 'minor' {
    
    const weight = subtopic.conceptWeights[concept] || 0.5;
    
    if (weight >= DEFAULT_CONFIG.gapSeverityThresholds.critical) {
      return 'critical';
    } else if (weight >= DEFAULT_CONFIG.gapSeverityThresholds.important) {
      return 'important';
    } else {
      return 'minor';
    }
  }

  /**
   * Select appropriate remediation type based on concept and assessment
   */
  private static selectRemediationType(
    concept: string,
    assessment: AssessmentResult
  ): 'analogy' | 'step-by-step' | 'clinical-example' | 'simplify' {
    
    // Simple logic for now - can be enhanced with more sophisticated selection
    if (assessment.confidence < 0.3) {
      return 'simplify';
    } else if (assessment.confidence < 0.6) {
      return 'step-by-step';
    } else {
      return 'clinical-example';
    }
  }

  /**
   * Check if subtopic should transition based on completion criteria
   */
  private static shouldTransitionSubtopic(
    gapStack: SubtopicState,
    subtopic: Subtopic
  ): boolean {
    
    const totalConcepts = subtopic.expectedConcepts.length;
    const completedConcepts = gapStack.completedConcepts.size;
    const completionRatio = completedConcepts / totalConcepts;
    
    // Check if we've met the completion threshold
    const thresholdMet = completionRatio >= DEFAULT_CONFIG.completionThreshold;
    
    // Check if all critical gaps are covered
    const criticalGapsRemaining = Array.from(gapStack.primaryGaps).filter(concept => {
      const weight = subtopic.conceptWeights[concept] || 0.5;
      return weight >= DEFAULT_CONFIG.gapSeverityThresholds.critical;
    }).length;
    
    const criticalGapsCovered = criticalGapsRemaining === 0;
    
    console.log(`🎯 Transition check:`, {
      completionRatio: completionRatio.toFixed(2),
      thresholdMet,
      criticalGapsCovered,
      shouldTransition: thresholdMet && criticalGapsCovered
    });
    
    return thresholdMet && criticalGapsCovered;
  }

  /**
   * Find which subtopic an out-of-scope concept belongs to
   */
  private static findTargetSubtopic(concept: string): string {
    // For now, return a placeholder
    // In a full implementation, this would search through all subtopics
    return 'unknown_subtopic';
  }

  /**
   * Get the next subtopic in sequence
   */
  private static getNextSubtopic(currentSubtopic: Subtopic): string {
    // Placeholder - in full implementation, this would reference the study path
    return `subtopic_${currentSubtopic.order + 1}`;
  }

  /**
   * Get gap stack statistics for debugging/monitoring
   */
  static getGapStackStats(gapStack: SubtopicState): {
    totalPrimaryGaps: number;
    completedConcepts: number;
    currentFocus: string | null;
    completionRatio: number;
  } {
    return {
      totalPrimaryGaps: gapStack.primaryGaps.size,
      completedConcepts: gapStack.completedConcepts.size,
      currentFocus: gapStack.currentFocus,
      completionRatio: gapStack.completedConcepts.size / 
        (gapStack.primaryGaps.size + gapStack.completedConcepts.size)
    };
  }

  /**
   * Reset gap stack for a new subtopic
   */
  static resetGapStack(subtopic: Subtopic): SubtopicState {
    console.log(`🔄 Resetting gap stack for new subtopic: ${subtopic.title}`);
    return this.initializeGapStack(subtopic);
  }
} 