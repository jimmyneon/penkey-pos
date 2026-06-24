import { useRef, useState, useCallback } from 'react';

interface PullToDismissOptions {
  onDismiss: () => void;
  threshold?: number;
}

export function usePullToDismiss({ onDismiss, threshold = 100 }: PullToDismissOptions) {
  const startY = useRef<number | null>(null);
  const currentY = useRef(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (startY.current === null) return;
    const deltaY = e.touches[0].clientY - startY.current;
    if (deltaY > 0) {
      currentY.current = deltaY;
      setDragOffset(deltaY);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (currentY.current > threshold) {
      onDismiss();
    }
    setDragOffset(0);
    setIsDragging(false);
    startY.current = null;
    currentY.current = 0;
  }, [onDismiss, threshold]);

  return {
    dragOffset,
    isDragging,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  };
}
