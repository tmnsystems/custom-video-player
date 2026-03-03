import { useEffect, useCallback } from 'react';

interface KeyboardShortcutsOptions {
  onNext?: () => void;
  onPrevious?: () => void;
  onToggleAutoPlay?: () => void;
  enabled?: boolean;
}

export function useKeyboardShortcuts({
  onNext,
  onPrevious,
  onToggleAutoPlay,
  enabled = true,
}: KeyboardShortcutsOptions) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't trigger if user is typing in an input
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLSelectElement
    ) {
      return;
    }

    switch (event.key.toLowerCase()) {
      case 'n':
        event.preventDefault();
        onNext?.();
        break;
      case 'p':
        event.preventDefault();
        onPrevious?.();
        break;
      case 'a':
        event.preventDefault();
        onToggleAutoPlay?.();
        break;
    }
  }, [onNext, onPrevious, onToggleAutoPlay]);

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, enabled]);
}
