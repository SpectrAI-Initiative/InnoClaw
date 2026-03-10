"use client";

import { useEffect, useRef, useState, useCallback } from "react";

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
  particleCount = 50,
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
    return Math.max(particleCount, Math.min(dynamicCount, 200));
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

    const animate = () => {
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

        ctx.save();
        ctx.globalAlpha = particle.opacity * fadeOpacity;
        ctx.shadowBlur = 10;
        ctx.shadowColor = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = particle.color;
        ctx.fill();
        ctx.restore();
      });

      // Draw connecting lines
      ctx.save();
      ctx.strokeStyle = "rgba(139, 92, 246, 0.1)";
      ctx.lineWidth = 0.5;

      for (let i = 0; i < particlesRef.current.length; i++) {
        for (let j = i + 1; j < particlesRef.current.length; j++) {
          const dx = particlesRef.current[i].x - particlesRef.current[j].x;
          const dy = particlesRef.current[i].y - particlesRef.current[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 100) {
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

// Neural network style thinking particles for reasoning sections
interface NeuralParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  pulsePhase: number;
  pulseSpeed: number;
}

interface ThinkingParticlesProps {
  isActive: boolean;
  className?: string;
}

export function ThinkingParticles({ isActive, className = "" }: ThinkingParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<NeuralParticle[]>([]);
  const animationRef = useRef<number>(0);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isActive) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = 0;
      }
      return;
    }

    const parent = canvas.parentElement;
    if (!parent) return;

    const updateSize = () => {
      const rect = parent.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };
    updateSize();

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Initialize particles - sparse neural nodes
    const nodeCount = Math.max(6, Math.floor((canvas.width * canvas.height) / 8000));
    particlesRef.current = Array.from({ length: nodeCount }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.6,
      vy: (Math.random() - 0.5) * 0.6,
      radius: 2 + Math.random() * 2,
      pulsePhase: Math.random() * Math.PI * 2,
      pulseSpeed: 0.02 + Math.random() * 0.02,
    }));

    const animate = () => {
      timeRef.current += 0.016;
      const { width, height } = canvas;

      // Clear with slight trail effect
      ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
      ctx.fillRect(0, 0, width, height);

      const particles = particlesRef.current;

      // Update and draw connections first (behind nodes)
      ctx.lineWidth = 1;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[j].x - particles[i].x;
          const dy = particles[j].y - particles[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = 120;

          if (dist < maxDist) {
            const alpha = (1 - dist / maxDist) * 0.4;
            // Animated gradient along connection
            const pulseAlpha = 0.3 + 0.2 * Math.sin(timeRef.current * 3 + i + j);

            const gradient = ctx.createLinearGradient(
              particles[i].x, particles[i].y,
              particles[j].x, particles[j].y
            );
            gradient.addColorStop(0, `rgba(139, 92, 246, ${alpha * pulseAlpha})`);
            gradient.addColorStop(0.5, `rgba(99, 102, 241, ${alpha * pulseAlpha * 1.5})`);
            gradient.addColorStop(1, `rgba(59, 130, 246, ${alpha * pulseAlpha})`);

            ctx.strokeStyle = gradient;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();

            // Draw traveling pulse along connection
            const pulsePos = (Math.sin(timeRef.current * 2 + i * 0.5) + 1) / 2;
            const pulseX = particles[i].x + dx * pulsePos;
            const pulseY = particles[i].y + dy * pulsePos;

            ctx.beginPath();
            ctx.arc(pulseX, pulseY, 1.5, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(168, 85, 247, ${alpha * 0.8})`;
            ctx.fill();
          }
        }
      }

      // Update and draw particles
      particles.forEach((p) => {
        // Update position
        p.x += p.vx;
        p.y += p.vy;
        p.pulsePhase += p.pulseSpeed;

        // Bounce off edges
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;
        p.x = Math.max(0, Math.min(width, p.x));
        p.y = Math.max(0, Math.min(height, p.y));

        // Draw glow
        const pulseScale = 1 + 0.3 * Math.sin(p.pulsePhase);
        const glowRadius = p.radius * 3 * pulseScale;
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowRadius);
        gradient.addColorStop(0, "rgba(139, 92, 246, 0.6)");
        gradient.addColorStop(0.5, "rgba(99, 102, 241, 0.2)");
        gradient.addColorStop(1, "rgba(59, 130, 246, 0)");

        ctx.beginPath();
        ctx.arc(p.x, p.y, glowRadius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Draw core
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * pulseScale, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${0.7 + 0.3 * Math.sin(p.pulsePhase)})`;
        ctx.fill();
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(parent);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      resizeObserver.disconnect();
    };
  }, [isActive]);

  if (!isActive) return null;

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none absolute inset-0 z-0 rounded-lg ${className}`}
      style={{ background: "transparent" }}
    />
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
