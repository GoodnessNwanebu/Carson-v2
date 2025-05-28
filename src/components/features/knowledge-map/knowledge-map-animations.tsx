// knowledge-map-animations.tsx

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle, Sparkles } from 'lucide-react';

interface ProgressAnimationProps {
  progress: number;
  status: 'red' | 'yellow' | 'green' | 'unassessed';
  isActive?: boolean;
}

export function ProgressAnimation({ progress, status, isActive }: ProgressAnimationProps) {
  const [animatedProgress, setAnimatedProgress] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedProgress(progress);
    }, 100);
    return () => clearTimeout(timer);
  }, [progress]);

  const getProgressColor = () => {
    switch (status) {
      case 'green': return 'bg-green-500';
      case 'yellow': return 'bg-yellow-500';
      case 'red': return 'bg-red-500';
      default: return 'bg-blue-500';
    }
  };

  return (
    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
      <div 
        className={cn(
          "h-2 rounded-full transition-all duration-700 ease-out",
          getProgressColor(),
          isActive && "shadow-sm"
        )}
        style={{ 
          width: `${animatedProgress}%`,
          transform: isActive ? 'scaleY(1.1)' : 'scaleY(1)'
        }}
      />
    </div>
  );
}

interface StatusChangeAnimationProps {
  status: 'red' | 'yellow' | 'green' | 'unassessed';
  previousStatus?: 'red' | 'yellow' | 'green' | 'unassessed';
  children: React.ReactNode;
}

export function StatusChangeAnimation({ status, previousStatus, children }: StatusChangeAnimationProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (previousStatus && previousStatus !== status) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 600);
      return () => clearTimeout(timer);
    }
  }, [status, previousStatus]);

  return (
    <div className={cn(
      "transition-all duration-300",
      isAnimating && "scale-110"
    )}>
      {children}
    </div>
  );
}

interface CompletionCelebrationProps {
  isVisible: boolean;
  onComplete: () => void;
}

export function CompletionCelebration({ isVisible, onComplete }: CompletionCelebrationProps) {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(onComplete, 2000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onComplete]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
      <div className="bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center space-x-2 animate-bounce">
        <CheckCircle size={20} />
        <span className="font-medium">Subtopic Mastered!</span>
        <Sparkles size={16} className="animate-pulse" />
      </div>
    </div>
  );
}

interface PulseIndicatorProps {
  isActive: boolean;
  color?: 'blue' | 'green' | 'yellow' | 'red';
}

export function PulseIndicator({ isActive, color = 'blue' }: PulseIndicatorProps) {
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500'
  };

  return (
    <div className="relative">
      <div className={cn("w-2 h-2 rounded-full", colorClasses[color])} />
      {isActive && (
        <div className={cn(
          "absolute inset-0 w-2 h-2 rounded-full animate-ping opacity-75",
          colorClasses[color]
        )} />
      )}
    </div>
  );
}

interface SlideInAnimationProps {
  children: React.ReactNode;
  delay?: number;
  direction?: 'left' | 'right' | 'up' | 'down';
}

export function SlideInAnimation({ children, delay = 0, direction = 'up' }: SlideInAnimationProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  const getTransformClass = () => {
    if (!isVisible) {
      switch (direction) {
        case 'left': return 'translate-x-4 opacity-0';
        case 'right': return '-translate-x-4 opacity-0';
        case 'up': return 'translate-y-4 opacity-0';
        case 'down': return '-translate-y-4 opacity-0';
      }
    }
    return 'translate-x-0 translate-y-0 opacity-100';
  };

  return (
    <div className={cn(
      "transition-all duration-500 ease-out",
      getTransformClass()
    )}>
      {children}
    </div>
  );
} 