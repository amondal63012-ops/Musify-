import React, { useCallback, useEffect, useRef, useState } from 'react';

interface WavingProgressBarProps {
  progress: number;
  duration: number;
  isPlaying: boolean;
  onSeekChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSeekTime?: (time: number) => void;
  onScrubPreview?: (time: number | null) => void;
  ariaLabel?: string;
  compact?: boolean;
  interactive?: boolean;
  showHoverTooltip?: boolean;
  formatTime?: (seconds: number) => string;
  className?: string;
}

export default function WavingProgressBar({
  progress,
  duration,
  isPlaying,
  onSeekChange,
  onSeekTime,
  onScrubPreview,
  ariaLabel = 'Seek playback position',
  compact = false,
  interactive = true,
  showHoverTooltip = false,
  formatTime,
  className = '',
}: WavingProgressBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const [width, setWidth] = useState(320);
  const [hoverPct, setHoverPct] = useState<number | null>(null);
  const [scrubTime, setScrubTime] = useState<number | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const safeDuration = duration > 0 && isFinite(duration) ? duration : 0;
  const activeTime = scrubTime !== null ? scrubTime : progress;
  const clampedTime = safeDuration > 0 ? Math.min(safeDuration, Math.max(0, activeTime)) : 0;
  const pct = safeDuration > 0 ? Math.min(100, Math.max(0, (clampedTime / safeDuration) * 100)) : 0;

  const pctRef = useRef(pct);
  const widthRef = useRef(width);
  const isPlayingRef = useRef(isPlaying);
  const reducedMotionRef = useRef(prefersReducedMotion);
  const phaseRef = useRef(0);
  const ampRef = useRef(isPlaying ? 1 : 0);
  const activePointerIdRef = useRef<number | null>(null);
  const isScrubbingRef = useRef(false);
  const scrubTimeRef = useRef<number | null>(null);

  pctRef.current = pct;
  widthRef.current = width;
  isPlayingRef.current = isPlaying;
  reducedMotionRef.current = prefersReducedMotion;

  const height = compact ? 8 : 18;
  const centerY = height / 2;
  const maxAmp = compact ? 1.6 : 3.4;
  const wavelength = compact ? 16 : 22;
  const strokeWidth = compact ? 2 : 3;

  const buildPath = useCallback(
    (w: number, currentPct: number, amplitude: number, phase: number) => {
      const fillX = Math.max(0, Math.min(w, (currentPct / 100) * w));
      if (fillX <= 1) {
        return `M 0 ${centerY} L 0 ${centerY}`;
      }
      if (amplitude < 0.05) {
        return `M 0 ${centerY} L ${fillX.toFixed(1)} ${centerY}`;
      }

      const step = 3;
      const freq = (Math.PI * 2) / wavelength;
      const fadeZone = Math.min(10, fillX * 0.25);
      let d = `M 0 ${centerY}`;

      for (let x = step; x <= fillX; x += step) {
        const edgeFade =
          fadeZone > 0
            ? Math.min(1, x / fadeZone, (fillX - x) / fadeZone)
            : 1;
        const y = centerY + Math.sin(x * freq - phase) * amplitude * Math.max(0, edgeFade);
        d += ` L ${x.toFixed(1)} ${y.toFixed(2)}`;
      }
      if (fillX % step !== 0) {
        d += ` L ${fillX.toFixed(1)} ${centerY}`;
      }
      return d;
    },
    [centerY, wavelength]
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateWidth = () => {
      const nextW = Math.max(60, Math.round(el.getBoundingClientRect().width));
      setWidth(nextW);
    };
    updateWidth();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(updateWidth);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
      lastTime = now;

      const targetAmp = isPlayingRef.current && !reducedMotionRef.current ? maxAmp : 0;
      ampRef.current += (targetAmp - ampRef.current) * Math.min(1, dt * 8);

      if (ampRef.current > 0.04) {
        phaseRef.current = (phaseRef.current + dt * 4.4) % (Math.PI * 200);
      }

      if (pathRef.current) {
        pathRef.current.setAttribute(
          'd',
          buildPath(widthRef.current, pctRef.current, ampRef.current, phaseRef.current)
        );
      }

      if (isPlayingRef.current || Math.abs(ampRef.current - targetAmp) > 0.05) {
        rafId = requestAnimationFrame(tick);
      } else {
        rafId = 0;
      }
    };

    if (pathRef.current) {
      pathRef.current.setAttribute(
        'd',
        buildPath(widthRef.current, pctRef.current, ampRef.current, phaseRef.current)
      );
    }

    rafId = requestAnimationFrame(tick);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isPlaying, prefersReducedMotion, width, maxAmp, buildPath]);

  // Keep SVG wave synchronized immediately during scrub/seek even when paused
  useEffect(() => {
    if (pathRef.current) {
      pathRef.current.setAttribute(
        'd',
        buildPath(widthRef.current, pct, ampRef.current, phaseRef.current)
      );
    }
  }, [pct, width, buildPath]);

  const hasSeekHandler = Boolean(onSeekTime || onSeekChange);
  const canInteractive = interactive && hasSeekHandler;

  const commitSeek = useCallback(
    (targetTime: number) => {
      const normalized = safeDuration > 0 ? Math.min(safeDuration, Math.max(0, targetTime)) : Math.max(0, targetTime);
      if (onSeekTime) {
        onSeekTime(normalized);
      }
      if (onSeekChange) {
        const synthetic = {
          target: { value: String(normalized) },
          currentTarget: { value: String(normalized) },
        } as unknown as React.ChangeEvent<HTMLInputElement>;
        onSeekChange(synthetic);
      }
    },
    [onSeekChange, onSeekTime, safeDuration]
  );

  const calcRatioFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return null;
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canInteractive) return;
    e.stopPropagation();
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    const ratio = calcRatioFromClientX(e.clientX);
    if (ratio === null) return;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Some environments throw if pointer is already released
    }

    activePointerIdRef.current = e.pointerId;
    isScrubbingRef.current = true;
    setIsScrubbing(true);

    const targetTime = safeDuration > 0 ? ratio * safeDuration : 0;
    scrubTimeRef.current = targetTime;
    setScrubTime(targetTime);
    onScrubPreview?.(targetTime);
    if (showHoverTooltip) {
      setHoverPct(ratio * 100);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const ratio = calcRatioFromClientX(e.clientX);
    if (ratio === null) return;

    if (showHoverTooltip && (e.pointerType === 'mouse' || isScrubbingRef.current)) {
      setHoverPct(ratio * 100);
    }

    if (isScrubbingRef.current && activePointerIdRef.current === e.pointerId) {
      e.stopPropagation();
      const targetTime = safeDuration > 0 ? ratio * safeDuration : 0;
      scrubTimeRef.current = targetTime;
      setScrubTime(targetTime);
      onScrubPreview?.(targetTime);
    }
  };

  const finishScrub = (e: React.PointerEvent<HTMLDivElement>, shouldCommit: boolean) => {
    if (!canInteractive) return;
    e.stopPropagation();
    if (activePointerIdRef.current !== e.pointerId) return;

    try {
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore release errors
    }

    const ratio = calcRatioFromClientX(e.clientX);
    const finalTime =
      ratio !== null && safeDuration > 0
        ? ratio * safeDuration
        : scrubTimeRef.current;

    activePointerIdRef.current = null;
    isScrubbingRef.current = false;
    scrubTimeRef.current = null;
    setIsScrubbing(false);
    setScrubTime(null);
    onScrubPreview?.(null);

    if (e.pointerType !== 'mouse') {
      setHoverPct(null);
    }

    if (shouldCommit && finalTime !== null && isFinite(finalTime) && safeDuration > 0) {
      commitSeek(finalTime);
    }
  };

  const thumbLeftPx = Math.max(0, Math.min(width, (pct / 100) * width));
  const displayTooltipPct = isScrubbing ? pct : hoverPct;
  const displayTooltipTime =
    displayTooltipPct !== null ? (displayTooltipPct / 100) * safeDuration : 0;

  return (
    <div
      ref={containerRef}
      data-no-swipe="true"
      className={`relative flex items-center group select-none ${compact ? 'h-[8px]' : 'h-6'} ${className}`}
      onMouseMove={
        showHoverTooltip
          ? (e) => {
              const ratio = calcRatioFromClientX(e.clientX);
              if (ratio !== null) setHoverPct(ratio * 100);
            }
          : undefined
      }
      onMouseLeave={
        showHoverTooltip
          ? () => {
              if (!isScrubbingRef.current) setHoverPct(null);
            }
          : undefined
      }
    >
      {showHoverTooltip && displayTooltipPct !== null && formatTime && safeDuration > 0 && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-8 -translate-x-1/2 px-2 py-0.5 rounded-md bg-[#141414]/95 backdrop-blur-md border border-white/15 text-[10px] font-semibold text-white shadow-lg whitespace-nowrap z-30 tabular-nums"
          style={{ left: `${displayTooltipPct}%` }}
        >
          {formatTime(displayTooltipTime)}
        </div>
      )}

      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full overflow-visible block pointer-events-none"
        aria-hidden="true"
      >
        {/* Remaining unplayed track */}
        <line
          x1={thumbLeftPx}
          y1={centerY}
          x2={width}
          y2={centerY}
          stroke="rgba(255,255,255,0.22)"
          strokeWidth={compact ? 1.75 : isScrubbing ? 3 : 2.5}
          strokeLinecap="round"
        />

        {/* Animated Waving Active Progress */}
        <path
          ref={pathRef}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={isScrubbing && !compact ? strokeWidth + 0.5 : strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* Playhead Thumb & >=44px Interactive Touch/Pointer Hitbox */}
      {canInteractive && (
        <>
          <div
            data-no-swipe="true"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={(e) => finishScrub(e, true)}
            onPointerCancel={(e) => finishScrub(e, false)}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-11 z-20 cursor-pointer touch-none"
          />

          <input
            type="range"
            min={0}
            max={safeDuration > 0 ? safeDuration : 1}
            step="any"
            value={clampedTime}
            disabled={safeDuration <= 0}
            onChange={(e) => commitSeek(Number(e.target.value))}
            aria-label={ariaLabel}
            className="sr-only"
          />

          <div
            aria-hidden="true"
            className={`pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2 bg-white shadow-[0_0_10px_rgba(255,255,255,0.65)] transition-transform duration-150 ${
              compact
                ? 'w-2 h-2 rounded-full opacity-0'
                : isScrubbing
                  ? 'w-3.5 h-3.5 rounded-full scale-110 shadow-[0_0_14px_rgba(255,255,255,0.95)]'
                  : 'w-[5px] h-3.5 rounded-full group-hover:w-2.5 group-hover:h-2.5 group-hover:rounded-full group-hover:scale-110'
            }`}
            style={{ left: `${pct}%` }}
          />
        </>
      )}
    </div>
  );
}
