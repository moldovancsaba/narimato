/**
 * NARIMATO — one focus/overlay stack for every modal surface (UI-03).
 *
 * Pure and DOM-injectable so the ordering rules are unit-testable without a
 * browser. `public/js/ui.js` owns one instance; the GDS surfaces mount from the
 * resulting state and the GDS dialog itself provides the Tab trap.
 *
 * Rules:
 *   - Escape resolves the top of the stack only, never a surface beneath it.
 *   - the invoker is recorded on open and restored on close;
 *   - opening over an open overlay inert-marks the previous element;
 *   - a second open of the same name is a no-op (state wins, no duplicate).
 */

export const OVERLAY_NAMES = Object.freeze(['landing', 'guide', 'manual', 'report', 'confirm']);

function focusElement(element) {
  if (!element || typeof element.focus !== 'function') return false;
  try {
    element.focus({ preventScroll: true });
    return true;
  } catch {
    return false;
  }
}

export function createOverlayPort({ document: doc = null, focus = focusElement, onInert = null } = {}) {
  const stack = [];
  const listeners = new Set();

  const activeElement = () => (doc && doc.activeElement ? doc.activeElement : null);

  const emit = () => {
    const snapshot = stack.map((entry) => ({ name: entry.name, invoker: entry.invoker, element: entry.element }));
    for (const listener of [...listeners]) {
      try {
        listener(snapshot);
      } catch {
        /* a broken listener must not break focus management */
      }
    }
    return snapshot;
  };

  const setInert = (element, value) => {
    if (!element || typeof element !== 'object') return;
    try {
      element.inert = !!value;
    } catch {
      /* ignore */
    }
    if (typeof onInert === 'function') onInert(element, !!value);
  };

  const port = {
    /** Current stack, bottom first. */
    stack: () => stack.slice(),
    depth: () => stack.length,
    names: () => stack.map((entry) => entry.name),
    top: () => (stack.length ? stack[stack.length - 1] : null),
    isOpen: (name) => stack.some((entry) => entry.name === name),
    subscribe(listener) {
      if (typeof listener !== 'function') throw new TypeError('overlayPort.subscribe(listener) requires a function');
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /**
     * Open an overlay above the current stack.
     * @param {{name: string, element?: object, invoker?: object, initialFocus?: object}} request
     */
    open({ name, element = null, invoker = undefined, initialFocus = null } = {}) {
      if (!OVERLAY_NAMES.includes(name)) throw new Error(`unknown overlay: ${name}`);
      if (port.isOpen(name)) return port.top();
      const previous = port.top();
      if (previous) setInert(previous.element, true);
      const entry = {
        name,
        element,
        invoker: invoker === undefined ? activeElement() : invoker,
        openedAt: Date.now(),
      };
      stack.push(entry);
      if (initialFocus) focus(initialFocus);
      else if (element && typeof element.querySelector === 'function') {
        const target = element.querySelector('[data-autofocus]');
        if (target) focus(target);
      }
      emit();
      return entry;
    },
    /** Close the top overlay (or a named one if it is on top), restoring focus. */
    close(name = null, { restoreFocus = true } = {}) {
      const top = port.top();
      if (!top) return null;
      if (name && top.name !== name) return null;
      stack.pop();
      setInert(top.element, false);
      const previous = port.top();
      if (previous && previous.element) setInert(previous.element, false);
      if (restoreFocus && top.invoker) focus(top.invoker);
      emit();
      return top;
    },
    /** Escape semantics: resolve the top overlay only. Returns the closed entry. */
    escape() {
      return port.close(null);
    },
    /** Close everything bottom-up (used when a run ends). */
    closeAll({ restoreFocus = true } = {}) {
      let last = null;
      while (stack.length) last = port.close(null, { restoreFocus: false });
      if (restoreFocus && last && last.invoker) focus(last.invoker);
      return last;
    },
  };

  return port;
}
