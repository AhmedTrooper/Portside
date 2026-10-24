import type { CSSProperties, ReactNode } from "react";
import { Card } from "@astryxdesign/core/Card";
import { Grid } from "@astryxdesign/core/Grid";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";

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

interface DockerCardGridProps extends DockerCardProps {
  "aria-hidden"?: boolean;
}

export function DockerCardGrid({ children, className, ...props }: DockerCardGridProps) {
  return (
    <Grid
      columns={{ minWidth: 320, max: 4 }}
      gap={3}
      width="100%"
      className={`min-w-0 ${className ?? ""}`}
      {...props}
    >
      {children}
    </Grid>
  );
}

export function DockerCardMetaGrid({ children }: DockerCardProps) {
  return (
    <Grid
      columns={{ minWidth: 120, max: 2, repeat: "fit" }}
      rowGap={1}
      columnGap={2}
      align="start"
      className="min-w-0 shrink-0"
    >
      {children}
    </Grid>
  );
}

export function DockerCardHeader({ children }: DockerCardProps) {
  return (
    <HStack gap={1} wrap="wrap" align="start" justify="between" className="min-w-0 shrink-0">
      {children}
    </HStack>
  );
}

export function DockerCardIdentity({ children }: DockerCardProps) {
  return (
    <HStack gap={1} align="start" className="min-w-0 flex-1 basis-[140px]">
      {children}
    </HStack>
  );
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
        "docker-resource-card min-w-0 flex flex-col gap-3 transition-transform duration-200 hover:-translate-y-0.5",
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

interface DockerCardMetaProps {
  label: string;
  value: string;
  mono?: boolean;
}

/** Labels and values occupy separate, full-height blocks instead of sharing a baseline. */
export function DockerCardMeta({ label, value, mono }: DockerCardMetaProps) {
  return (
    <VStack gap={0.5} className="min-w-0 shrink-0">
      <Text type="docker-meta-label" color="secondary" display="block" textWrap="wrap" hasCapsize={false}>
        {label}
      </Text>
      <Text
        type="docker-meta-value"
        display="block"
        textWrap="wrap"
        hasCapsize={false}
        className={mono ? "font-mono" : undefined}
      >
        {value}
      </Text>
    </VStack>
  );
}
