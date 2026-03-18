"use client";

import { ParticleEffect, FloatingOrbs } from "@/components/ui/particle-effect";

interface PageBackgroundProps {
  isActive: boolean;
}

export function PageBackground({ isActive }: PageBackgroundProps) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.02] dark:opacity-[0.05]"
        style={{
          backgroundImage: `linear-gradient(rgba(139, 92, 246, 0.3) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(139, 92, 246, 0.3) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />
      {/* Radial gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
      {/* Floating orbs */}
      <FloatingOrbs isActive={isActive} />
      {/* Particle effect */}
      <ParticleEffect isActive={isActive} particleCount={30} />
    </div>
  );
}
