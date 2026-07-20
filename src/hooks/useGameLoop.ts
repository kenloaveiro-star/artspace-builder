import { useRef, useEffect, useCallback } from 'react';

export const useGameLoop = (
  callback: (deltaTime: number) => void,
  isRunning: boolean = true
) => {
  const requestRef = useRef<number>();
  const previousTimeRef = useRef<number>();

  const animate = useCallback((time: number) => {
    if (previousTimeRef.current !== undefined) {
      const deltaTime = time - previousTimeRef.current;
      callback(deltaTime);
    }
    previousTimeRef.current = time;
    requestRef.current = requestAnimationFrame(animate);
  }, [callback]);

  useEffect(() => {
    if (isRunning) {
      requestRef.current = requestAnimationFrame(animate);
    }
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isRunning, animate]);
};

export const useCanvas = (
  draw: (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => void,
  isRunning: boolean = true
) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useGameLoop(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    draw(ctx, canvas);
  }, isRunning);

  return canvasRef;
};
