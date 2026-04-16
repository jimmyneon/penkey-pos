import { useEffect, useState } from "react";

/**
 * Hook to detect if the virtual keyboard is visible on mobile devices
 * Uses the Visual Viewport API to detect when the viewport shrinks (keyboard appears)
 */
export function useKeyboardVisible() {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) {
      return;
    }

    const viewport = window.visualViewport;
    let initialHeight = viewport.height;

    const handleResize = () => {
      const currentHeight = viewport.height;
      const heightDifference = initialHeight - currentHeight;
      
      // If viewport height decreased by more than 150px, keyboard is likely visible
      // This threshold helps avoid false positives from browser UI changes
      setIsKeyboardVisible(heightDifference > 150);
    };

    const handleScroll = () => {
      // Update on scroll as well, as some browsers fire scroll events when keyboard appears
      handleResize();
    };

    viewport.addEventListener("resize", handleResize);
    viewport.addEventListener("scroll", handleScroll);

    // Initial check
    handleResize();

    return () => {
      viewport.removeEventListener("resize", handleResize);
      viewport.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return isKeyboardVisible;
}
