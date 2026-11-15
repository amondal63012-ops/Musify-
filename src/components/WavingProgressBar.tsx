import React, { useEffect, useRef, useState } from 'react';

interface WavingProgressBarProps {
  progress: number;
  duration: number;
  isPlaying: boolean;
  onSeekChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
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
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const safeDuration = duration > 0 && isFinite(duration) ? duration : 1;
  const pct = Math.min(100, Math.max(0, (progress / safeDuration) * 100));

  const pctRef = useRef(pct);
  const widthRef = useRef(width);
  const isPlayingRef = useRef(isPlaying);
  const reducedMotionRef = useRef(prefersReducedMotion);
  const phaseRef = useRef(0);
  const ampRef = useRef(isPlaying ? 1 : 0);

  pctRef.current = pct;
  widthRef.current = width;
  isPlayingRef.current = isPlaying;
  reducedMotionRef.current = prefersReducedMotion;

  const height = compact ? 8 : 16;
  const centerY = height / 2;
  const maxAmp = compact ? 1.6 : 3.2;
  const wavelength = compact ? 16 : 22;
  const strokeWidth = compact ? 2 : 2.75;

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

    const buildPath = (w: number, currentPct: number, amplitude: number, phase: number) => {
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
    };

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
  }, [isPlaying, prefersReducedMotion, width, pct, centerY, maxAmp, wavelength]);

  const thumbLeftPx = Math.max(0, Math.min(width, (pct / 100) * width));

  return (
    <div
      ref={containerRef}
      className={`relative flex items-center group select-none ${compact ? 'h-[8px]' : 'h-5'} ${className}`}
      onMouseMove={
        showHoverTooltip
          ? (e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const p = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
              setHoverPct(p);
            }
          : undefined
      }
      onMouseLeave={showHoverTooltip ? () => setHoverPct(null) : undefined}
    >
      {showHoverTooltip && hoverPct !== null && formatTime && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-7 -translate-x-1/2 px-2 py-0.5 rounded-md bg-[#141414]/95 backdrop-blur-md border border-white/15 text-[10px] font-semibold text-white shadow-lg whitespace-nowrap z-20"
          style={{ left: `${hoverPct}%` }}
        >
          {formatTime((hoverPct / 100) * (duration || 0))}
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
          strokeWidth={compact ? 1.75 : 2.5}
          strokeLinecap="round"
        />

        {/* Animated Waving Active Progress */}
        <path
          ref={pathRef}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* Interactive Range Overlay & Playhead Indicator */}
      {interactive && onSeekChange && (
        <>
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={progress}
            onChange={onSeekChange}
            aria-label={ariaLabel}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2 bg-white shadow-[0_0_8px_rgba(255,255,255,0.45)] transition-transform duration-150 ${
              compact
                ? 'w-2 h-2 rounded-full opacity-0'
                : 'w-[4px] h-3.5 rounded-full group-hover:scale-125'
            }`}
            style={{ left: `${pct}%` }}
          />
        </>
      )}
    </div>
  );
}
