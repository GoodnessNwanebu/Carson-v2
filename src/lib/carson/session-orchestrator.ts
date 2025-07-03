// Session Orchestrator - The Central Brain of Carson v3
// Coordinates all engines and manages conversation flow

import { 
  SessionContext, 
  Turn, 
  OrchestrationResult,
  ConversationContext,
  Subtopic,
  DEFAULT_CONFIG 
} from './types';
import { SessionPersistence } from './persistence';
import { AssessmentEngine } from './assessment-engine';
import { GapAnalysisEngine } from './gap-analysis-engine';
import { ConversationEngine } from './conversation-engine';
import { StudyPathBuilder } from './study-path-builder';

export class SessionOrchestrator {
  
  /**
   * Main turn processing function - the heart of Carson v3
   * Handles complete student input → Carson response flow
   */
  static async processTurn(
    studentMessage: string,
    sessionId?: string
  ): Promise<OrchestrationResult> {
    
    console.log(`🎯 Processing turn for session: ${sessionId || 'new'}`);
    console.log(`👤 Student message: "${studentMessage}"`);
    
    try {
      // 1. Load or create session context
      let sessionContext = await this.getOrCreateSession(sessionId, studentMessage);
      
      // 2. Create student turn
      const studentTurn = this.createStudentTurn(studentMessage, sessionContext);
      sessionContext.conversationHistory.push(studentTurn);
      
      // 3. Get current subtopic
      const currentSubtopic = this.getCurrentSubtopic(sessionContext);
      
      if (!currentSubtopic) {
        throw new Error('No current subtopic found');
      }
      
      // 4. Assess student response within subtopic scope
      const assessment = await AssessmentEngine.assessWithinScope(
        studentMessage,
        currentSubtopic,
        { sessionContext, currentTurn: studentTurn } as ConversationContext
      );
      
      // 5. Update gap stack and get strategy
      const { updatedGapStack, identifiedGaps, strategy } = GapAnalysisEngine.updateGapStack(
        sessionContext.gapStack,
        assessment,
        currentSubtopic
      );
      
      // 6. Update session context with new gap stack and focus
      sessionContext.gapStack = updatedGapStack;
      if (strategy.focus) {
        sessionContext.gapStack.currentFocus = strategy.focus;
      }
      
      // 7. Build conversation context
      const conversationContext: ConversationContext = {
        sessionContext,
        currentTurn: studentTurn,
        assessment,
        strategy,
        gaps: identifiedGaps
      };
      
      // 8. Generate Carson's response
      const carsonResponse = await ConversationEngine.generateResponse(conversationContext);
      
      // 9. Create Carson turn
      const carsonTurn = this.createCarsonTurn(carsonResponse, sessionContext, assessment);
      sessionContext.conversationHistory.push(carsonTurn);
      
      // 10. Update session timestamps
      sessionContext.lastUpdated = new Date();
      
      // 11. Handle subtopic transitions if needed
      if (strategy.action === 'transition' && strategy.nextSubtopic) {
        sessionContext = await this.handleSubtopicTransition(sessionContext, strategy.nextSubtopic);
      }
      
      // 12. Persist session state (Option 1 approach)
      SessionPersistence.saveSession(sessionContext);
      
      // 13. Return orchestration result
      const result: OrchestrationResult = {
        response: carsonResponse,
        updatedContext: sessionContext,
        nextAction: strategy
      };
      
      console.log(`✅ Turn processed successfully`);
      return result;
      
    } catch (error) {
      console.error('Turn processing failed:', error);
      
      // Fallback response to keep conversation alive
      return {
        response: "I apologize, but I'm having trouble processing that right now. Could you help me understand what you're thinking about?",
        updatedContext: sessionContext || this.createEmptySession(),
        nextAction: { action: 'continue' }
      };
    }
  }

  /**
   * Get existing session or create new one
   */
  private static async getOrCreateSession(
    sessionId?: string,
    initialMessage?: string
  ): Promise<SessionContext> {
    
    if (sessionId) {
      const existingSession = SessionPersistence.loadSession(sessionId);
      if (existingSession) {
        console.log(`📖 Loaded existing session: ${sessionId}`);
        return existingSession;
      }
    }
    
    // Create new session
    console.log(`🆕 Creating new session`);
    return this.createNewSession(initialMessage);
  }

  /**
   * Create a new session context
   */
  private static async createNewSession(initialMessage?: string): Promise<SessionContext> {
    const sessionId = this.generateSessionId();
    const topic = await this.extractTopicFromMessage(initialMessage || '');
    const subtopics = this.generateSubtopics(topic);
    
    const firstSubtopic = subtopics[0];
    const gapStack = GapAnalysisEngine.initializeGapStack(firstSubtopic);
    
    const sessionContext: SessionContext = {
      sessionId,
      topic,
      currentSubtopic: firstSubtopic.id,
      createdAt: new Date(),
      lastUpdated: new Date(),
      subtopics,
      conversationHistory: [],
      gapStack
    };
    
    console.log(`🎯 New session created:`, {
      sessionId,
      topic,
      firstSubtopic: firstSubtopic.title,
      totalSubtopics: subtopics.length
    });
    
    return sessionContext;
  }

  /**
   * Extract topic from initial student message
   */
  private static async extractTopicFromMessage(message: string): Promise<string> {
    // Simple keyword extraction for now
    // In full implementation, this could use LLM or NLP
    
    const medicalKeywords = [
      'preeclampsia', 'hypertension', 'diabetes', 'cardiology', 
      'nephrology', 'pregnancy', 'obstetrics', 'gynecology'
    ];
    
    const lowerMessage = message.toLowerCase();
    const foundKeyword = medicalKeywords.find(keyword => 
      lowerMessage.includes(keyword)
    );
    
    return foundKeyword || 'general_medicine';
  }

  /**
   * Generate subtopics for a topic using StudyPathBuilder
   */
  private static generateSubtopics(topic: string): Subtopic[] {
    console.log(`🏗️ Generating subtopics for topic: ${topic}`);
    
    // Use StudyPathBuilder to create educationally sound learning progression
    const studyPath = StudyPathBuilder.generateStudyPath(topic, {
      studentLevel: 'intermediate', // Could be configurable based on user profile
      maxSubtopics: 6, // Optimal for knowledge map display
      focusAreas: [] // Could be customized based on curriculum
    });
    
    console.log(`✅ Generated ${studyPath.subtopics.length} subtopics for ${topic}`);
    return studyPath.subtopics;
  }

  /**
   * Get current subtopic from session context
   */
  private static getCurrentSubtopic(sessionContext: SessionContext): Subtopic | null {
    return sessionContext.subtopics.find(
      s => s.id === sessionContext.currentSubtopic
    ) || null;
  }

  /**
   * Create student turn object
   */
  private static createStudentTurn(message: string, sessionContext: SessionContext): Turn {
    return {
      id: this.generateTurnId(),
      role: 'student',
      content: message,
      timestamp: new Date(),
      metadata: {
        subtopic: sessionContext.currentSubtopic
      }
    };
  }

  /**
   * Create Carson turn object
   */
  private static createCarsonTurn(
    response: string, 
    sessionContext: SessionContext,
    assessment: any
  ): Turn {
    return {
      id: this.generateTurnId(),
      role: 'carson',
      content: response,
      timestamp: new Date(),
      metadata: {
        subtopic: sessionContext.currentSubtopic,
        assessment
      }
    };
  }

  /**
   * Handle subtopic transition
   */
  private static async handleSubtopicTransition(
    sessionContext: SessionContext,
    nextSubtopicId: string
  ): Promise<SessionContext> {
    
    console.log(`🔄 Transitioning from ${sessionContext.currentSubtopic} to ${nextSubtopicId}`);
    
    // Mark current subtopic as completed
    const currentSubtopic = sessionContext.subtopics.find(
      s => s.id === sessionContext.currentSubtopic
    );
    if (currentSubtopic) {
      currentSubtopic.completed = true;
    }
    
    // Find next subtopic
    const nextSubtopic = sessionContext.subtopics.find(s => s.id === nextSubtopicId);
    if (!nextSubtopic) {
      console.warn(`Next subtopic ${nextSubtopicId} not found`);
      return sessionContext;
    }
    
    // Update session context
    sessionContext.currentSubtopic = nextSubtopicId;
    sessionContext.gapStack = GapAnalysisEngine.resetGapStack(nextSubtopic);
    
    return sessionContext;
  }

  /**
   * Create empty session for fallback
   */
  private static createEmptySession(): SessionContext {
    return {
      sessionId: this.generateSessionId(),
      topic: 'unknown',
      currentSubtopic: 'unknown',
      createdAt: new Date(),
      lastUpdated: new Date(),
      subtopics: [],
      conversationHistory: [],
      gapStack: {
        primaryGaps: new Set(),
        currentFocus: null,
        completedConcepts: new Set(),
        subtopicId: 'unknown'
      }
    };
  }

  /**
   * Generate unique session ID
   */
  private static generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique turn ID
   */
  private static generateTurnId(): string {
    return `turn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get session statistics for debugging
   */
  static getSessionStats(sessionContext: SessionContext): {
    totalTurns: number;
    subtopicsCompleted: number;
    currentSubtopicProgress: number;
    sessionDuration: number;
  } {
    const gapStats = GapAnalysisEngine.getGapStackStats(sessionContext.gapStack);
    
    return {
      totalTurns: sessionContext.conversationHistory.length,
      subtopicsCompleted: sessionContext.subtopics.filter(s => s.completed).length,
      currentSubtopicProgress: gapStats.completionRatio,
      sessionDuration: Date.now() - sessionContext.createdAt.getTime()
    };
  }

  /**
   * Load existing session by ID
   */
  static loadSession(sessionId: string): SessionContext | null {
    return SessionPersistence.loadSession(sessionId);
  }

  /**
   * Get all available sessions
   */
  static getAllSessions() {
    return SessionPersistence.getAllSessions();
  }
} 