'use client';
import { useEffect } from 'react';

export default function CustomCursor() {
  useEffect(() => {
    const cursor = document.getElementById('custom-cursor');
    const trail = document.getElementById('cursor-trail');
    if (!cursor || !trail) return;

    let trailX = 0, trailY = 0;
    let rafId: number;

    const moveCursor = (e: MouseEvent) => {
      cursor.style.left = e.clientX + 'px';
      cursor.style.top = e.clientY + 'px';
    };

    const animateTrail = () => {
      const cursorX = parseFloat(cursor.style.left) || 0;
      const cursorY = parseFloat(cursor.style.top) || 0;
      trailX += (cursorX - trailX) * 0.18;
      trailY += (cursorY - trailY) * 0.18;
      trail.style.left = trailX + 'px';
      trail.style.top = trailY + 'px';
      rafId = requestAnimationFrame(animateTrail);
    };

    const onEnter = () => cursor.classList.add('hovering');
    const onLeave = () => cursor.classList.remove('hovering');

    const interactables = 'a, button, input, textarea, select, label, [role="button"]';
    document.addEventListener('mousemove', moveCursor);
    document.addEventListener('mouseover', (e) => {
      if ((e.target as Element).closest(interactables)) onEnter();
      else onLeave();
    });
    rafId = requestAnimationFrame(animateTrail);

    return () => {
      document.removeEventListener('mousemove', moveCursor);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <>
      <div id="custom-cursor" />
      <div id="cursor-trail" />
    </>
  );
}
