import { useState, useEffect } from "react";

export const useVisualViewport = (minKeyboardHeight = 300) => {
  const [viewport, setViewport] = useState({
    width: window.visualViewport?.width || window.innerWidth,
    height: window.visualViewport?.height || window.innerHeight,
    isKeyboardOpen: window.screen.height - (window.visualViewport?.height || 0) >= minKeyboardHeight,
  });

  useEffect(() => {
    let pendingUpdate = false;
    const handler = () => {
      if (pendingUpdate) return;
      pendingUpdate = true;
      requestAnimationFrame(() => {
        pendingUpdate = false;
        setViewport({
          width: window.visualViewport?.width || window.innerWidth,
          height: window.visualViewport?.height || window.innerHeight,
          isKeyboardOpen: window.screen.height - (window.visualViewport?.height || 0) >= minKeyboardHeight,
        });
      });
    };
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handler);
      window.visualViewport.addEventListener("scroll", handler);
      return () => {
        window.visualViewport?.removeEventListener("resize", handler);
        window.visualViewport?.removeEventListener("scroll", handler);
      };
    }
  }, [minKeyboardHeight]);

  return viewport;
};
