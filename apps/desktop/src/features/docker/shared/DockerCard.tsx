import type { CSSProperties, ReactNode } from "react";
import { Card } from "@astryxdesign/core/Card";

export const DOCKER_CARD_RADIUS = "12px";

/** Shared card chrome with a single thin border. */
export const DOCKER_CARD_STYLE = {
  borderRadius: DOCKER_CARD_RADIUS,
  "--_card-radius": DOCKER_CARD_RADIUS,
  borderColor: "var(--color-border-emphasized)",
} as CSSProperties;

interface DockerCardProps {
  children: ReactNode;
  className?: string;
}

/**
 * Shared Docker resource card. Keeps border, padding, elevation, and hover
 * motion consistent across every card grid.
 */
export function DockerCard({ children, className }: DockerCardProps) {
  return (
    <Card
      padding={5}
      elevation="low"
      className={[
        "min-w-0 flex flex-col gap-3 transition-transform duration-200 hover:-translate-y-0.5",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={DOCKER_CARD_STYLE}
    >
      {children}
    </Card>
  );
}
