"use client";

import { useEffect, useState } from "react";

const refreshDistance = 80;

export function IosPullToRefresh() {
  const [distance, setDistance] = useState(0);

  useEffect(() => {
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isInstalled = window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (!isIos || !isInstalled) return;

    let startX = 0;
    let startY = 0;
    let pulling = false;
    let currentDistance = 0;

    const onTouchStart = (event: TouchEvent) => {
      pulling = event.touches.length === 1 &&
        (document.scrollingElement?.scrollTop ?? window.scrollY) <= 0;
      if (!pulling) return;
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
      currentDistance = 0;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!pulling || event.touches.length !== 1) return;
      const deltaX = event.touches[0].clientX - startX;
      const deltaY = event.touches[0].clientY - startY;
      if (deltaY <= 0 || Math.abs(deltaX) > deltaY) {
        currentDistance = 0;
      } else {
        currentDistance = Math.min(deltaY, refreshDistance);
      }
      setDistance(currentDistance);
    };

    const onTouchEnd = () => {
      if (pulling && currentDistance >= refreshDistance) {
        window.location.reload();
      }
      pulling = false;
      currentDistance = 0;
      setDistance(0);
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd);
    document.addEventListener("touchcancel", onTouchEnd);
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

  if (distance === 0) return null;

  return (
    <div className="ios-pull-indicator" role="status" aria-live="polite">
      {distance >= refreshDistance ? "Suelta para actualizar" : "Desliza para actualizar"}
    </div>
  );
}
