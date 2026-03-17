"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const MAX_PARTICLES = 40;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  color: string;
  life: number;
  maxLife: number;
}

interface ParticleEffectProps {
  isActive: boolean;
  className?: string;
  particleCount?: number;
  colors?: string[];
  density?: number; // particles per square pixel
}

export function ParticleEffect({
  isActive,
  className = "",
  particleCount = MAX_PARTICLES,
  colors = ["#8b5cf6", "#6366f1", "#3b82f6", "#06b6d4", "#a855f7"],
  density = 0.00015, // particles per square pixel
}: ParticleEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>(0);
  const dimensionsRef = useRef({ width: 0, height: 0 });
  const [ready, setReady] = useState(false);

  // Calculate particle count based on area and density
  const getParticleCount = useCallback(() => {
    const { width, height } = dimensionsRef.current;
    const area = width * height;
    // Use density-based count, with min/max bounds
    const dynamicCount = Math.floor(area * density);
    return Math.min(Math.max(particleCount, dynamicCount), MAX_PARTICLES);
  }, [particleCount, density]);

  // Create particle function
  const createParticle = useCallback((): Particle => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.5 + Math.random() * 1.5;
    return {
      x: Math.random() * dimensionsRef.current.width,
      y: Math.random() * dimensionsRef.current.height,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 1 + Math.random() * 3,
      opacity: 0.3 + Math.random() * 0.7,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 0,
      maxLife: 100 + Math.random() * 100,
    };
  }, [colors]);

  // Initialize and handle resize with ResizeObserver
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateDimensions = () => {
      const parent = canvas.parentElement;
      if (parent) {
        const rect = parent.getBoundingClientRect();
        const width = rect.width || parent.clientWidth;
        const height = rect.height || parent.clientHeight;
        if (width > 0 && height > 0) {
          dimensionsRef.current = { width, height };
          canvas.width = width;
          canvas.height = height;
          setReady(true);
        }
      }
    };

    updateDimensions();
    const timer = setTimeout(updateDimensions, 50);

    // Use ResizeObserver for better container size tracking
    let resizeObserver: ResizeObserver | null = null;
    const parent = canvas.parentElement;
    if (parent && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updateDimensions);
      resizeObserver.observe(parent);
    }

    window.addEventListener("resize", updateDimensions);

    return () => {
      window.removeEventListener("resize", updateDimensions);
      clearTimeout(timer);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, []);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isActive || !ready) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = 0;
      }
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Initialize particles with dynamic count
    const targetCount = getParticleCount();
    particlesRef.current = Array.from({ length: targetCount }, createParticle);

    let lastFrameTime = 0;

    const animate = () => {
      // Throttle to ~30fps to reduce main-thread pressure
      const now = performance.now();
      if (now - lastFrameTime < 33) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }
      lastFrameTime = now;

      const { width, height } = dimensionsRef.current;
      ctx.clearRect(0, 0, width, height);

      // Dynamically adjust particle count based on current dimensions
      const currentTarget = getParticleCount();
      const currentCount = particlesRef.current.length;

      if (currentCount < currentTarget) {
        // Add more particles
        const toAdd = Math.min(currentTarget - currentCount, 5); // Add gradually
        for (let i = 0; i < toAdd; i++) {
          particlesRef.current.push(createParticle());
        }
      } else if (currentCount > currentTarget + 20) {
        // Remove excess particles (with buffer to avoid flickering)
        particlesRef.current = particlesRef.current.slice(0, currentTarget);
      }

      particlesRef.current.forEach((particle, index) => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life++;

        const lifeRatio = particle.life / particle.maxLife;
        const fadeOpacity =
          lifeRatio < 0.1
            ? lifeRatio * 10
            : lifeRatio > 0.9
            ? (1 - lifeRatio) * 10
            : 1;

        if (
          particle.x < 0 ||
          particle.x > width ||
          particle.y < 0 ||
          particle.y > height ||
          particle.life > particle.maxLife
        ) {
          particlesRef.current[index] = createParticle();
          return;
        }

        ctx.globalAlpha = particle.opacity * fadeOpacity;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = particle.color;
        ctx.fill();
      });

      // Draw connecting lines (use distance-squared to avoid sqrt for distant pairs)
      ctx.save();
      ctx.strokeStyle = "rgba(139, 92, 246, 0.1)";
      ctx.lineWidth = 0.5;

      const maxDistSq = 10000; // 100^2
      for (let i = 0; i < particlesRef.current.length; i++) {
        for (let j = i + 1; j < particlesRef.current.length; j++) {
          const dx = particlesRef.current[i].x - particlesRef.current[j].x;
          const dy = particlesRef.current[i].y - particlesRef.current[j].y;
          const distSq = dx * dx + dy * dy;

          if (distSq < maxDistSq) {
            const distance = Math.sqrt(distSq);
            ctx.globalAlpha = (1 - distance / 100) * 0.3;
            ctx.beginPath();
            ctx.moveTo(particlesRef.current[i].x, particlesRef.current[i].y);
            ctx.lineTo(particlesRef.current[j].x, particlesRef.current[j].y);
            ctx.stroke();
          }
        }
      }
      ctx.restore();

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = 0;
      }
    };
  }, [isActive, ready, createParticle, getParticleCount]);

  if (!isActive) return null;

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none absolute inset-0 z-0 ${className}`}
      style={{ background: 'transparent' }}
    />
  );
}

// Simpler CSS-based thinking indicator
export function ThinkingIndicator({ className = "", label = "InnoClaw thinking" }: { className?: string; label?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="relative flex items-center justify-center">
        {/* Outer rotating ring */}
        <div className="absolute h-8 w-8 animate-spin rounded-full border-2 border-transparent border-t-primary/60" />
        {/* Middle rotating ring (opposite direction) */}
        <div className="absolute h-6 w-6 animate-spin rounded-full border-2 border-transparent border-b-accent/40" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
        {/* Inner pulsing core */}
        <div className="h-4 w-4 animate-pulse rounded-full bg-gradient-to-r from-primary to-accent" />
        {/* Glow effect */}
        <div className="absolute h-4 w-4 animate-ping rounded-full bg-primary/30" />
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <div className="flex gap-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
        </div>
      </div>
    </div>
  );
}

// Floating orbs animation for background
export function FloatingOrbs({ isActive }: { isActive: boolean }) {
  if (!isActive) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
      {/* Large floating orbs */}
      <div className="absolute -left-20 -top-20 h-40 w-40 animate-float rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -right-20 top-1/3 h-32 w-32 animate-float-delayed rounded-full bg-accent/10 blur-3xl" />
      <div className="absolute -bottom-10 left-1/3 h-36 w-36 animate-float-slow rounded-full bg-primary/5 blur-3xl" />
    </div>
  );
}

// Lightweight CSS-only thinking particles for reasoning sections
// (Replaces the previous canvas-based O(n²) animation to prevent main-thread blocking)
interface ThinkingParticlesProps {
  isActive: boolean;
  className?: string;
}

export function ThinkingParticles({ isActive, className = "" }: ThinkingParticlesProps) {
  if (!isActive) return null;

  return (
    <div className={`pointer-events-none absolute inset-0 z-0 rounded-lg overflow-hidden ${className}`}>
      {/* Shimmer sweep */}
      <div
        className="absolute inset-0 animate-thinking-shimmer opacity-30"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.15), rgba(99, 102, 241, 0.1), transparent)",
          backgroundSize: "200% 100%",
        }}
      />
      {/* Slow-moving gradient orbs to simulate particle feel */}
      <div
        className="absolute -left-1/4 -top-1/4 h-3/4 w-3/4 rounded-full opacity-20 animate-float"
        style={{ background: "radial-gradient(circle, rgba(139, 92, 246, 0.3), transparent 70%)" }}
      />
      <div
        className="absolute -right-1/4 -bottom-1/4 h-3/4 w-3/4 rounded-full opacity-15 animate-float-delayed"
        style={{ background: "radial-gradient(circle, rgba(59, 130, 246, 0.25), transparent 70%)" }}
      />
    </div>
  );
}

// Breathing glow border effect for thinking sections
export function BreathingBorder({
  children,
  isActive,
  className = ""
}: {
  children: React.ReactNode;
  isActive: boolean;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg ${className}`}
      style={{
        background: isActive
          ? "linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%)"
          : undefined,
      }}
    >
      {isActive && (
        <>
          {/* Animated border glow */}
          <div
            className="absolute inset-0 rounded-lg opacity-60 animate-thinking-shimmer"
            style={{
              background: "linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.3), transparent)",
            }}
          />
          {/* Breathing border */}
          <div
            className="absolute inset-0 rounded-lg border border-purple-500/30 animate-breathe"
            style={{
              boxShadow: "inset 0 0 20px rgba(139, 92, 246, 0.1)",
            }}
          />
        </>
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
