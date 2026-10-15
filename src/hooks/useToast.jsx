// ── hooks/useToast.js ────────────────────────────────
import { useState, useCallback, useRef } from 'react';

export function useToast() {
  const [toast, setToast] = useState({ msg: '', type: 'ok', visible: false });
  const timerRef = useRef(null);

  const showToast = useCallback((msg, type = 'ok') => {
    clearTimeout(timerRef.current);
    setToast({ msg, type, visible: true });
    timerRef.current = setTimeout(() => {
      setToast(t => ({ ...t, visible: false }));
    }, 2800);
  }, []);

  return { toast, showToast };
}
