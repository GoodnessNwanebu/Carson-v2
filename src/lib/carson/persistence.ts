// Local Storage Persistence for Carson v3
// Full state snapshot approach (Option 1)

import { SessionContext } from './types';

const STORAGE_KEYS = {
  SESSION_STATE: 'carson_session_state',
  SESSION_LIST: 'carson_session_list',
} as const;

export class SessionPersistence {
  
  /**
   * Save complete session state to localStorage
   * Called after every turn (Option 1 approach)
   */
  static saveSession(sessionContext: SessionContext): void {
    try {
      // Convert Sets to Arrays for JSON serialization
      const serializedContext = this.serializeSession(sessionContext);
      
      localStorage.setItem(
        `${STORAGE_KEYS.SESSION_STATE}_${sessionContext.sessionId}`,
        JSON.stringify(serializedContext)
      );
      
      // Update session list
      this.updateSessionList(sessionContext.sessionId, sessionContext.topic);
      
      console.log(`💾 Session ${sessionContext.sessionId} saved to localStorage`);
    } catch (error) {
      console.error('Failed to save session to localStorage:', error);
      // In production, we'd want to handle this more gracefully
      // For now, we'll just log the error
    }
  }

  /**
   * Load session state from localStorage
   */
  static loadSession(sessionId: string): SessionContext | null {
    try {
      const storedData = localStorage.getItem(`${STORAGE_KEYS.SESSION_STATE}_${sessionId}`);
      
      if (!storedData) {
        return null;
      }
      
      const parsedData = JSON.parse(storedData);
      const sessionContext = this.deserializeSession(parsedData);
      
      console.log(`📖 Session ${sessionId} loaded from localStorage`);
      return sessionContext;
    } catch (error) {
      console.error('Failed to load session from localStorage:', error);
      return null;
    }
  }

  /**
   * Get all available sessions
   */
  static getAllSessions(): Array<{ sessionId: string; topic: string; lastUpdated: Date }> { 
    try {
      const sessionListData = localStorage.getItem(STORAGE_KEYS.SESSION_LIST);
      
      if (!sessionListData) {
        return [];
      }
      
      const sessionList = JSON.parse(sessionListData);
      return sessionList.map((session: any) => ({
        ...session,
        lastUpdated: new Date(session.lastUpdated)
      }));
    } catch (error) {
      console.error('Failed to get session list:', error);
      return [];
    }
  }

  /**
   * Delete session from localStorage
   */
  static deleteSession(sessionId: string): void {
    try {
      localStorage.removeItem(`${STORAGE_KEYS.SESSION_STATE}_${sessionId}`);
      this.removeFromSessionList(sessionId);
      console.log(`🗑️ Session ${sessionId} deleted from localStorage`);
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  }

  /**
   * Clear all sessions (useful for debugging)
   */
  static clearAllSessions(): void {
    try {
      const sessions = this.getAllSessions();
      sessions.forEach(session => {
        localStorage.removeItem(`${STORAGE_KEYS.SESSION_STATE}_${session.sessionId}`);
      });
      localStorage.removeItem(STORAGE_KEYS.SESSION_LIST);
      console.log('🧹 All sessions cleared from localStorage');
    } catch (error) {
      console.error('Failed to clear sessions:', error);
    }
  }

  /**
   * Serialize session for JSON storage (handle Sets, Dates, etc.)
   */
  private static serializeSession(session: SessionContext): any {
    return {
      ...session,
      createdAt: session.createdAt.toISOString(),
      lastUpdated: session.lastUpdated.toISOString(),
      conversationHistory: session.conversationHistory.map(turn => ({
        ...turn,
        timestamp: turn.timestamp.toISOString()
      })),
      gapStack: {
        ...session.gapStack,
        primaryGaps: Array.from(session.gapStack.primaryGaps),
        completedConcepts: Array.from(session.gapStack.completedConcepts),
      },
    };
  }

  /**
   * Deserialize session from JSON storage (restore Sets, Dates, etc.)
   */
  private static deserializeSession(data: any): SessionContext {
    return {
      ...data,
      createdAt: new Date(data.createdAt),
      lastUpdated: new Date(data.lastUpdated),
      conversationHistory: data.conversationHistory.map((turn: any) => ({
        ...turn,
        timestamp: new Date(turn.timestamp)
      })),
      gapStack: {
        ...data.gapStack,
        primaryGaps: new Set(data.gapStack.primaryGaps),
        completedConcepts: new Set(data.gapStack.completedConcepts),
      },
    };
  }

  /**
   * Update the master list of sessions
   */
  private static updateSessionList(sessionId: string, topic: string): void {
    const sessions = this.getAllSessions();
    const existingIndex = sessions.findIndex(s => s.sessionId === sessionId);
    
    const sessionInfo = {
      sessionId,
      topic,
      lastUpdated: new Date()
    };
    
    if (existingIndex >= 0) {
      sessions[existingIndex] = sessionInfo;
    } else {
      sessions.push(sessionInfo);
    }
    
    localStorage.setItem(STORAGE_KEYS.SESSION_LIST, JSON.stringify(sessions));
  }

  /**
   * Remove session from master list
   */
  private static removeFromSessionList(sessionId: string): void {
    const sessions = this.getAllSessions();
    const filtered = sessions.filter(s => s.sessionId !== sessionId);
    localStorage.setItem(STORAGE_KEYS.SESSION_LIST, JSON.stringify(filtered));
  }

  /**
   * Get storage usage info (useful for debugging)
   */
  static getStorageInfo(): { used: number; available: number; sessions: number } {
    let used = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        used += localStorage.getItem(key)?.length || 0;
      }
    }
    
    // Estimate localStorage limit (usually 5-10MB)
    const estimated = 5 * 1024 * 1024; // 5MB
    
    return {
      used,
      available: estimated - used,
      sessions: this.getAllSessions().length
    };
  }
} 