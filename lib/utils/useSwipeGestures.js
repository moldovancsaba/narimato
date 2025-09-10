import { useEffect, useRef } from 'react';
import { haptics } from './haptics';
import { GESTURE } from '../constants/gestures';

// FUNCTIONAL: Reusable swipe gesture hook attaching touch/pointer/wheel listeners to a DOM element
// STRATEGIC: Centralizes gesture heuristics and feedback for consistency across pages (Play, Swipe-Only) without new dependencies
export function useSwipeGestures({ ref, enabled, onSwipe, allowedDirections = ['left', 'right'] }) {
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const touchStartTimeRef = useRef(0);
  const draggingRef = useRef(false);
  const lockedHorizontalRef = useRef(false);
  const swipeInFlightRef = useRef(false);
  const lastDxRef = useRef(0);
  const wheelDxRef = useRef(0);
  const wheelTimerRef = useRef(null);

  useEffect(() => {
    const el = ref?.current;
    if (!enabled || !el) return;

    const getThresholdPx = () => {
      try {
        const w = el.offsetWidth || window.innerWidth || 320;
        return w * (GESTURE?.SWIPE_THRESHOLD_RATIO || 0.2);
      } catch (_e) {
        return 60; // fallback
      }
    };

    const resetTransform = () => {
      try {
        el.style.transition = 'transform 200ms ease-out';
        el.style.transform = 'translateX(0px) rotate(0deg)';
        setTimeout(() => { if (el) el.style.transition = ''; }, 220);
      } catch (_e) { /* noop */ }
    };

    const microBump = () => {
      try {
        el.classList.remove('micro-bump');
        void el.offsetWidth; // reflow to restart animation
        el.classList.add('micro-bump');
      } catch (_e) { /* noop */ }
    };

    const onTouchStart = (e) => {
      if (swipeInFlightRef.current) return;
      if (e.touches && e.touches.length > 0) {
        const t = e.touches[0];
        touchStartXRef.current = t.clientX;
        touchStartYRef.current = t.clientY;
        touchStartTimeRef.current = Date.now();
        draggingRef.current = true;
        lockedHorizontalRef.current = false;
        try { haptics.light(); } catch (_e) {}
      }
    };

    const onTouchMove = (e) => {
      if (!draggingRef.current) return;
      if (!e.touches || e.touches.length === 0) return;

      const t = e.touches[0];
      const dx = t.clientX - touchStartXRef.current;
      const dy = t.clientY - touchStartYRef.current;

      if (!lockedHorizontalRef.current) {
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
          lockedHorizontalRef.current = true;
        }
      }
      if (lockedHorizontalRef.current && e.cancelable) {
        e.preventDefault();
      }

      const rot = Math.max(-15, Math.min(15, dx / 20));
      try {
        el.style.transform = `translateX(${dx}px) rotate(${rot}deg)`;
        lastDxRef.current = dx;
      } catch (_e) { /* noop */ }
    };

    const onTouchEnd = async (_e) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;

      const dt = Math.max(1, Date.now() - touchStartTimeRef.current);
      const dx = lastDxRef.current || 0;

      const velocity = Math.abs(dx) / dt; // px/ms
      const threshold = getThresholdPx();
      const isSwipe = Math.abs(dx) > threshold || velocity > (GESTURE?.SWIPE_VELOCITY_MIN || 0.3);
      if (!isSwipe) {
        resetTransform();
        return;
      }

      const direction = dx > 0 ? 'right' : 'left';
      if (!allowedDirections.includes(direction)) { resetTransform(); return; }
      if (swipeInFlightRef.current) return;
      swipeInFlightRef.current = true;

      try { haptics.light(); } catch (_e) {}
      microBump();

      try {
        const offX = direction === 'right' ? window.innerWidth : -window.innerWidth;
        el.style.transition = 'transform 180ms ease-out';
        el.style.transform = `translateX(${offX}px) rotate(${direction === 'right' ? 20 : -20}deg)`;
      } catch (_e) { /* noop */ }

      try {
        await onSwipe?.(direction);
      } finally {
        swipeInFlightRef.current = false;
        setTimeout(() => resetTransform(), 200);
      }
    };

    const onPointerDown = (e) => {
      if (swipeInFlightRef.current) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return; // left button only
      touchStartXRef.current = e.clientX;
      touchStartYRef.current = e.clientY;
      touchStartTimeRef.current = Date.now();
      draggingRef.current = true;
      lockedHorizontalRef.current = false;
      lastDxRef.current = 0;
      try { haptics.light(); } catch (_e) {}
      document.body.style.userSelect = 'none';
    };

    const onPointerMove = (e) => {
      if (!draggingRef.current) return;
      const dx = e.clientX - touchStartXRef.current;
      const dy = e.clientY - touchStartYRef.current;
      if (!lockedHorizontalRef.current) {
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
          lockedHorizontalRef.current = true;
        }
      }
      if (lockedHorizontalRef.current && e.cancelable) e.preventDefault();
      const rot = Math.max(-15, Math.min(15, dx / 20));
      try {
        el.style.transform = `translateX(${dx}px) rotate(${rot}deg)`;
        lastDxRef.current = dx;
      } catch (_e) {}
    };

    const onPointerUp = async (_e) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.userSelect = '';

      const dt = Math.max(1, Date.now() - touchStartTimeRef.current);
      const dx = lastDxRef.current || 0;
      const velocity = Math.abs(dx) / dt;
      const threshold = getThresholdPx();
      const isSwipe = Math.abs(dx) > threshold || velocity > (GESTURE?.SWIPE_VELOCITY_MIN || 0.3);
      if (!isSwipe) { resetTransform(); return; }
      const direction = dx > 0 ? 'right' : 'left';
      if (!allowedDirections.includes(direction)) { resetTransform(); return; }
      if (swipeInFlightRef.current) return;
      swipeInFlightRef.current = true;
      try { haptics.light(); } catch (_e) {}
      microBump();
      try {
        const offX = direction === 'right' ? window.innerWidth : -window.innerWidth;
        el.style.transition = 'transform 180ms ease-out';
        el.style.transform = `translateX(${offX}px) rotate(${direction === 'right' ? 20 : -20}deg)`;
      } catch (_e) {}
      try {
        await onSwipe?.(direction);
      } finally {
        swipeInFlightRef.current = false;
        setTimeout(() => resetTransform(), 200);
      }
    };

    const onCancel = () => {
      draggingRef.current = false;
      lastDxRef.current = 0;
      resetTransform();
      document.body.style.userSelect = '';
    };

    const onWheel = async (e) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return; // prioritise horizontal
      const threshold = getThresholdPx();

      wheelDxRef.current += e.deltaX;
      if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
      wheelTimerRef.current = setTimeout(() => { wheelDxRef.current = 0; }, 200);

      if (Math.abs(wheelDxRef.current) > threshold && !swipeInFlightRef.current) {
        if (e.cancelable) e.preventDefault();
        const direction = wheelDxRef.current > 0 ? 'right' : 'left';
        if (!allowedDirections.includes(direction)) { wheelDxRef.current = 0; return; }
        wheelDxRef.current = 0;
        swipeInFlightRef.current = true;
        try { haptics.light(); } catch (_e) {}
        microBump();
        try { await onSwipe?.(direction); }
        finally { swipeInFlightRef.current = false; }
      }
    };

    const onDragStart = (e) => {
      // Prevent browser native drag interfering with touch/pointer gestures
      if (e.cancelable) e.preventDefault();
    };

    // Listeners with passive: false to allow preventDefault during horizontal drags
    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: false });
    el.addEventListener('touchcancel', onCancel, { passive: false });

    el.addEventListener('pointerdown', onPointerDown, { passive: false });
    el.addEventListener('pointermove', onPointerMove, { passive: false });
    el.addEventListener('pointerup', onPointerUp, { passive: false });
    el.addEventListener('pointercancel', onCancel, { passive: false });

    el.addEventListener('wheel', onWheel, { passive: false });

    // Prevent image/card dragstart
    el.addEventListener('dragstart', onDragStart, { passive: false });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onCancel);

      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onCancel);

      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('dragstart', onDragStart);

      if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
      resetTransform();
    };
  }, [ref, enabled, onSwipe]);
}

