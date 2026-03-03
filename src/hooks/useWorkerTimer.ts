import { useEffect, useRef, useCallback, useMemo } from 'react';

// Create a Web Worker from a Blob - workers are not throttled in background tabs
const createTimerWorker = () => {
  const workerCode = `
    let timerId = null;
    let targetTime = null;
    
    self.onmessage = function(e) {
      const { type, duration } = e.data;
      
      if (type === 'start') {
        targetTime = Date.now() + duration;
        
        // Clear any existing timer
        if (timerId) clearInterval(timerId);
        
        // Check every 200ms
        timerId = setInterval(() => {
          const remaining = Math.max(0, targetTime - Date.now());
          self.postMessage({ type: 'tick', remaining: Math.ceil(remaining / 1000), rawRemaining: remaining });
          
          if (remaining <= 0) {
            clearInterval(timerId);
            timerId = null;
            self.postMessage({ type: 'complete' });
          }
        }, 200);
      } else if (type === 'stop') {
        if (timerId) {
          clearInterval(timerId);
          timerId = null;
        }
        targetTime = null;
      }
    };
  `;
  
  const blob = new Blob([workerCode], { type: 'application/javascript' });
  return new Worker(URL.createObjectURL(blob));
};

interface UseWorkerTimerOptions {
  onTick?: (secondsRemaining: number) => void;
  onComplete?: () => void;
}

export function useWorkerTimer({ onTick, onComplete }: UseWorkerTimerOptions = {}) {
  const workerRef = useRef<Worker | null>(null);
  const onTickRef = useRef(onTick);
  const onCompleteRef = useRef(onComplete);
  const isInitializedRef = useRef(false);
  
  // Keep refs updated
  useEffect(() => {
    onTickRef.current = onTick;
    onCompleteRef.current = onComplete;
  }, [onTick, onComplete]);
  
  // Initialize worker only once
  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;
    
    try {
      workerRef.current = createTimerWorker();
      
      workerRef.current.onmessage = (e) => {
        const { type, remaining } = e.data;
        
        if (type === 'tick') {
          onTickRef.current?.(remaining);
        } else if (type === 'complete') {
          onCompleteRef.current?.();
        }
      };
      
      workerRef.current.onerror = (err) => {
        console.error('Worker error:', err);
      };
    } catch (err) {
      console.error('Failed to create worker:', err);
    }
    
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
      isInitializedRef.current = false;
    };
  }, []);
  
  // Memoize the return object to prevent unnecessary re-renders
  const timerControls = useMemo(() => ({
    start: (durationMs: number) => {
      workerRef.current?.postMessage({ type: 'start', duration: durationMs });
    },
    stop: () => {
      workerRef.current?.postMessage({ type: 'stop' });
    },
  }), []);
  
  return timerControls;
}
