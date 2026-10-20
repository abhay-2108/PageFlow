import { useEffect, useRef, useState } from "react";

/**
 * Traps Tab and Shift-Tab focus within the referenced element while active.
 * Closes the modal/dialog when Escape is pressed.
 */
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  active: boolean,
  onEscape?: () => void,
) {
  useEffect(() => {
    if (!active || !containerRef.current) return;

    const el = containerRef.current;
    const focusableSelectors = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(", ");

    const previousActiveElement = document.activeElement as HTMLElement | null;

    // Focus first focusable element inside container
    const focusables = Array.from(el.querySelectorAll<HTMLElement>(focusableSelectors));
    if (focusables.length > 0 && focusables[0]) {
      focusables[0].focus();
    } else {
      el.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onEscape) {
        e.stopPropagation();
        onEscape();
        return;
      }

      if (e.key === "Tab") {
        const currentFocusables = Array.from(
          el.querySelectorAll<HTMLElement>(focusableSelectors),
        ).filter((item) => item.offsetParent !== null || item.offsetWidth > 0);

        if (currentFocusables.length === 0) {
          e.preventDefault();
          return;
        }

        const first = currentFocusables[0];
        const last = currentFocusables[currentFocusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first || !el.contains(document.activeElement)) {
            e.preventDefault();
            last?.focus();
          }
        } else {
          if (document.activeElement === last || !el.contains(document.activeElement)) {
            e.preventDefault();
            first?.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      if (previousActiveElement && typeof previousActiveElement.focus === "function") {
        previousActiveElement.focus();
      }
    };
  }, [active, containerRef, onEscape]);
}

/**
 * Provides keyboard navigation (ArrowDown, ArrowUp, Home, End, Escape)
 * and aria-activedescendant management for role="menu" lists.
 */
export function useMenuKeyboardNav<T extends HTMLElement = HTMLDivElement>({
  itemSelector = '[role="menuitem"], [role="menuitemcheckbox"], button:not([disabled])',
  onEscape,
}: {
  itemSelector?: string;
  onEscape?: () => void;
} = {}) {
  const menuRef = useRef<T | null>(null);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [activeDescendantId, setActiveDescendantId] = useState<string | undefined>(undefined);

  const getItems = (): HTMLElement[] => {
    if (!menuRef.current) return [];
    return Array.from(menuRef.current.querySelectorAll<HTMLElement>(itemSelector)).filter(
      (node) => node.offsetParent !== null || node.offsetWidth > 0,
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const items = getItems();
    if (items.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      const nextIdx = activeIndex < items.length - 1 ? activeIndex + 1 : 0;
      setActiveIndex(nextIdx);
      const target = items[nextIdx];
      if (target) {
        if (!target.id) target.id = `pg-menu-item-${Math.random().toString(36).slice(2, 9)}`;
        setActiveDescendantId(target.id);
        target.focus();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      const prevIdx = activeIndex > 0 ? activeIndex - 1 : items.length - 1;
      setActiveIndex(prevIdx);
      const target = items[prevIdx];
      if (target) {
        if (!target.id) target.id = `pg-menu-item-${Math.random().toString(36).slice(2, 9)}`;
        setActiveDescendantId(target.id);
        target.focus();
      }
    } else if (e.key === "Home") {
      e.preventDefault();
      e.stopPropagation();
      setActiveIndex(0);
      const target = items[0];
      if (target) {
        if (!target.id) target.id = `pg-menu-item-${Math.random().toString(36).slice(2, 9)}`;
        setActiveDescendantId(target.id);
        target.focus();
      }
    } else if (e.key === "End") {
      e.preventDefault();
      e.stopPropagation();
      const lastIdx = items.length - 1;
      setActiveIndex(lastIdx);
      const target = items[lastIdx];
      if (target) {
        if (!target.id) target.id = `pg-menu-item-${Math.random().toString(36).slice(2, 9)}`;
        setActiveDescendantId(target.id);
        target.focus();
      }
    } else if (e.key === "Escape") {
      if (onEscape) {
        e.preventDefault();
        e.stopPropagation();
        onEscape();
      }
    }
  };

  return {
    menuRef,
    activeIndex,
    activeDescendantId,
    handleKeyDown,
    setActiveIndex,
  };
}
