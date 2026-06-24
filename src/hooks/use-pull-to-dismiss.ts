import { useRef, useState, useCallback, type RefObject } from 'react';

interface PullToDismissOptions {
  onDismiss: () => void;
  threshold?: number;
  scrollContainerRef?: RefObject<HTMLElement | null>;
}

export function usePullToDismiss({ onDismiss, threshold = 100, scrollContainerRef }: PullToDismissOptions) {
  const startY = useRef<number | null>(null);
  const currentY = useRef(0);
  const scrollAtTopRef = useRef(true);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const getScrollTop = useCallback(() => {
    if (scrollContainerRef?.current) {
      return scrollContainerRef.current.scrollTop;
    }
    return 0;
  }, [scrollContainerRef]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    scrollAtTopRef.current = getScrollTop() <= 1;
    startY.current = e.touches[0].clientY;
  }, [getScrollTop]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (startY.current === null) return;

    const isAtTop = getScrollTop() <= 1;
    const deltaY = e.touches[0].clientY - startY.current;

    if (isAtTop && deltaY > 0) {
      if (!scrollAtTopRef.current) {
        startY.current = e.touches[0].clientY;
        scrollAtTopRef.current = true;
        return;
      }
      currentY.current = deltaY;
      setDragOffset(deltaY);
      setIsDragging(true);
      e.preventDefault();
    } else if (!isAtTop) {
      scrollAtTopRef.current = false;
      if (isDragging) {
        setDragOffset(0);
        setIsDragging(false);
      }
    } else {
      if (isDragging) {
        setDragOffset(0);
        setIsDragging(false);
      }
    }
  }, [isDragging, getScrollTop]);

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
