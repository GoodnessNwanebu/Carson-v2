"use client"

import React, { useState, useRef } from 'react';
import { cn } from '@/lib/utils';

interface ResizablePanelProps {
  direction: 'horizontal' | 'vertical';
  sizes: number[];
  onSizesChange: (sizes: number[]) => void;
  className?: string;
  children: React.ReactNode[];
}

export function ResizablePanel({ 
  direction, 
  sizes, 
  onSizesChange, 
  className, 
  children 
}: ResizablePanelProps) {
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const totalSize = direction === 'horizontal' ? rect.width : rect.height;
    const position = direction === 'horizontal' 
      ? e.clientX - rect.left 
      : e.clientY - rect.top;
    
    const percentage = (position / totalSize) * 100;
    const clampedPercentage = Math.max(10, Math.min(90, percentage));
    
    onSizesChange([clampedPercentage, 100 - clampedPercentage]);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging]);

  return (
    <div 
      ref={containerRef}
      className={cn(
        "flex",
        direction === 'horizontal' ? 'flex-row' : 'flex-col',
        className
      )}
    >
      <div 
        style={{ 
          [direction === 'horizontal' ? 'width' : 'height']: `${sizes[0]}%` 
        }}
        className="overflow-hidden"
      >
        {children[0]}
      </div>
      
      <div
        className={cn(
          "bg-gray-200 hover:bg-gray-300 cursor-pointer flex-shrink-0",
          direction === 'horizontal' ? 'w-1 hover:w-2' : 'h-1 hover:h-2',
          isDragging && "bg-blue-500"
        )}
        onMouseDown={handleMouseDown}
      />
      
      <div 
        style={{ 
          [direction === 'horizontal' ? 'width' : 'height']: `${sizes[1]}%` 
        }}
        className="overflow-hidden"
      >
        {children[1]}
      </div>
    </div>
  );
} 