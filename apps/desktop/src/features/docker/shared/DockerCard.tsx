import type { ReactNode } from "react";
import { Card } from "@astryxdesign/core/Card";

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
      style={{ borderColor: "var(--color-border-emphasized)" }}
    >
      {children}
    </Card>
  );
}
