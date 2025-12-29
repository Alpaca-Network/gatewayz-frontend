/**
 * Virtual Scrolling Hook
 * Renders only visible messages for smooth performance with 1000+ messages
 *
 * Performance improvement: Smooth scrolling with unlimited messages
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { throttle } from '@/lib/utils';

export interface VirtualScrollOptions {
  itemHeight: number; // Estimated height of each item
  overscan?: number; // Number of items to render outside visible area
  scrollThreshold?: number; // Threshold for scroll events (ms)
}

export interface VirtualScrollResult<T> {
  virtualItems: Array<{
    index: number;
    item: T;
    offsetTop: number;
  }>;
  totalHeight: number;
  containerRef: React.RefObject<HTMLDivElement>;
  scrollToIndex: (index: number, behavior?: ScrollBehavior) => void;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
}

export function useVirtualScroll<T>(
  items: T[],
  options: VirtualScrollOptions
): VirtualScrollResult<T> {
  const {
    itemHeight,
    overscan = 5,
    scrollThreshold = 16, // ~60fps
  } = options;

  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  // Calculate visible range
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );

  // Generate virtual items
  const virtualItems = [];
  for (let i = startIndex; i <= endIndex; i++) {
    if (items[i]) {
      virtualItems.push({
        index: i,
        item: items[i],
        offsetTop: i * itemHeight,
      });
    }
  }

  const totalHeight = items.length * itemHeight;

  // Throttled scroll handler
  const handleScroll = useCallback(
    throttle(() => {
      if (containerRef.current) {
        setScrollTop(containerRef.current.scrollTop);
      }
    }, scrollThreshold),
    []
  );

  // Update container height on resize
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight);
      }
    };

    updateHeight();

    const resizeObserver = new ResizeObserver(updateHeight);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Attach scroll listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);

  // Scroll to specific index
  const scrollToIndex = useCallback(
    (index: number, behavior: ScrollBehavior = 'smooth') => {
      if (containerRef.current) {
        const targetScrollTop = index * itemHeight;
        containerRef.current.scrollTo({
          top: targetScrollTop,
          behavior,
        });
      }
    },
    [itemHeight]
  );

  // Scroll to bottom
  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = 'smooth') => {
      if (containerRef.current) {
        containerRef.current.scrollTo({
          top: containerRef.current.scrollHeight,
          behavior,
        });
      }
    },
    []
  );

  return {
    virtualItems,
    totalHeight,
    containerRef,
    scrollToIndex,
    scrollToBottom,
  };
}
