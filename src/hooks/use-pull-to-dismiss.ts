import { useRef, useState, useCallback } from 'react';

interface PullToDismissOptions {
  onDismiss: () => void;
  threshold?: number;
}

export function usePullToDismiss({ onDismiss, threshold = 100 }: PullToDismissOptions) {
  const startY = useRef<number | null>(null);
  const currentY = useRef(0);
  const scrollAtTopRef = useRef(true);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const container = e.currentTarget;
    scrollAtTopRef.current = container.scrollTop <= 1;
    startY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (startY.current === null) return;

    const container = e.currentTarget;
    const isAtTop = container.scrollTop <= 1;

    if (isAtTop) {
      scrollAtTopRef.current = true;
      const deltaY = e.touches[0].clientY - startY.current;
      if (deltaY > 0) {
        currentY.current = deltaY;
        setDragOffset(deltaY);
        setIsDragging(true);
        e.preventDefault();
      }
    } else {
      scrollAtTopRef.current = false;
      if (isDragging) {
        setDragOffset(0);
        setIsDragging(false);
      }
    }
  }, [isDragging]);

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
