import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Inbox, X } from "lucide-react";
import { Card } from "@astryxdesign/core/Card";
import { Toolbar } from "@astryxdesign/core/Toolbar";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Button } from "@astryxdesign/core/Button";
import { Heading, Text } from "@astryxdesign/core/Text";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { DockerCardGrid, DOCKER_CARD_STYLE } from "./DockerCard";

interface DockerGridProps {
  /** Accessible label for the toolbar. */
  label: string;
  title: string;
  icon: LucideIcon;
  /** Small count/status summary shown beside the title. */
  meta?: string;
  search: string;
  onSearch: (value: string) => void;
  searchPlaceholder: string;
  toolbarActions?: ReactNode;
  isLoading: boolean;
  error?: string | null;
  itemCount: number;
  emptyTitle: string;
  emptyDescription: string;
  emptyAction?: ReactNode;
  children: ReactNode;
}

/**
 * Card + wrapping toolbar + responsive grid used by every Docker resource
 * page. Page scrolling keeps all cards reachable in short or narrow windows.
 */
export function DockerGrid({
  label,
  title,
  icon: IconComponent,
  meta,
  search,
  onSearch,
  searchPlaceholder,
  toolbarActions,
  isLoading,
  error,
  itemCount,
  emptyTitle,
  emptyDescription,
  emptyAction,
  children,
}: DockerGridProps) {
  return (
    <Card
      padding={0}
      elevation="low"
      className="w-full min-w-0 flex flex-col"
      style={DOCKER_CARD_STYLE}
    >
      <Toolbar
        label={label}
        size="md"
        dividers={["bottom"]}
        className="min-w-0 shrink-0"
        startContent={
          <HStack gap={2} wrap="wrap" align="center" width="100%" className="min-w-0">
            <HStack gap={1} wrap="wrap" align="center" className="min-w-0">
              <IconComponent size={18} aria-hidden className="shrink-0" />
              <Heading level={3} className="docker-card-text">{title}</Heading>
              {meta ? (
                <Text type="supporting" color="secondary" textWrap="wrap" className="docker-card-text">{meta}</Text>
              ) : null}
            </HStack>
            <HStack gap={1} wrap="wrap" align="center" justify="end" className="flex-1 basis-[280px] min-w-0">
              <div className="flex-1 basis-[180px] min-w-0">
                <TextInput
                  label={searchPlaceholder}
                  isLabelHidden
                  value={search}
                  onChange={onSearch}
                  placeholder={searchPlaceholder}
                  size="sm"
                />
              </div>
              {search ? (
                <Button
                  label="Clear search"
                  variant="ghost"
                  size="sm"
                  isIconOnly
                  icon={<X size={14} aria-hidden />}
                  onClick={() => onSearch("")}
                />
              ) : null}
              {toolbarActions}
            </HStack>
          </HStack>
        }
      />

      {error ? (
        <div
          role="alert"
          className="shrink-0 mx-4 mt-3 rounded-md px-3 py-2 text-sm [overflow-wrap:anywhere]"
          style={{
            color: "var(--color-text-red)",
            backgroundColor: "var(--color-background-red)",
            border: "1px solid color-mix(in srgb, currentColor 25%, transparent)",
          }}
        >
          {error}
        </div>
      ) : null}

      <VStack padding={3} className="min-w-0">
        {isLoading && itemCount === 0 ? (
          <GridSkeleton />
        ) : itemCount === 0 ? (
          <VStack minHeight={220} gap={1} align="center" justify="center" padding={2} className="text-center min-w-0">
            <Inbox size={28} aria-hidden className="opacity-50" />
            <Heading level={3}>{emptyTitle}</Heading>
            <Text type="supporting" color="secondary">
              {emptyDescription}
            </Text>
            {emptyAction}
          </VStack>
        ) : (
          <DockerCardGrid>{children}</DockerCardGrid>
        )}
      </VStack>
    </Card>
  );
}

function GridSkeleton() {
  return (
    <DockerCardGrid aria-hidden>
      {Array.from({ length: 6 }, (_, index) => (
        <Card
          key={index}
          padding={5}
          elevation="low"
          className="min-h-[200px] animate-pulse"
          style={DOCKER_CARD_STYLE}
        >
          <div className="h-4 w-2/3 rounded bg-current opacity-10" />
          <div className="mt-3 h-3 w-1/2 rounded bg-current opacity-10" />
          <div className="mt-6 h-3 w-full rounded bg-current opacity-10" />
          <div className="mt-2 h-3 w-4/5 rounded bg-current opacity-10" />
          <div className="mt-2 h-3 w-3/5 rounded bg-current opacity-10" />
        </Card>
      ))}
    </DockerCardGrid>
  );
}
