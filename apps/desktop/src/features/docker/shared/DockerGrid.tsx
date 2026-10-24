import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Inbox, X } from "lucide-react";
import { Card } from "@astryxdesign/core/Card";
import { Toolbar } from "@astryxdesign/core/Toolbar";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Button } from "@astryxdesign/core/Button";
import { Heading, Text } from "@astryxdesign/core/Text";

export const GRID_CLASS =
  "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5";

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
 * Full-height card + toolbar + responsive card grid used by every Docker
 * resource page. The grid owns the scroll area so the toolbar stays pinned.
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
      className="w-full h-full min-h-0 flex flex-col"
      style={{ borderColor: "var(--color-border-emphasized)" }}
    >
      <Toolbar
        label={label}
        size="md"
        dividers={["bottom"]}
        startContent={
          <div className="inline-flex items-center gap-2 min-w-0">
            <IconComponent size={18} aria-hidden className="shrink-0" />
            <Heading level={3}>{title}</Heading>
            {meta ? (
              <span className="text-xs opacity-70 truncate">{meta}</span>
            ) : null}
          </div>
        }
        endContent={
          <div className="inline-flex items-center gap-2">
            <div className="w-[220px] max-w-[38vw]">
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
          </div>
        }
      />

      {error ? (
        <div
          role="alert"
          className="mx-4 mt-3 rounded-md px-3 py-2 text-sm"
          style={{
            color: "var(--color-text-red)",
            backgroundColor: "var(--color-background-red)",
            border: "1px solid color-mix(in srgb, currentColor 25%, transparent)",
          }}
        >
          {error}
        </div>
      ) : null}

      <div className="flex-1 min-h-0 overflow-auto p-5">
        {isLoading && itemCount === 0 ? (
          <GridSkeleton />
        ) : itemCount === 0 ? (
          <div className="h-full min-h-[220px] flex flex-col items-center justify-center gap-2 text-center px-4">
            <Inbox size={28} aria-hidden className="opacity-50" />
            <Heading level={3}>{emptyTitle}</Heading>
            <Text type="supporting" color="secondary">
              {emptyDescription}
            </Text>
            {emptyAction}
          </div>
        ) : (
          <div className={GRID_CLASS}>{children}</div>
        )}
      </div>
    </Card>
  );
}

function GridSkeleton() {
  return (
    <div className={GRID_CLASS} aria-hidden>
      {Array.from({ length: 6 }, (_, index) => (
        <Card
          key={index}
          padding={5}
          elevation="low"
          className="min-h-[200px] animate-pulse"
          style={{ borderColor: "var(--color-border-emphasized)" }}
        >
          <div className="h-4 w-2/3 rounded bg-current opacity-10" />
          <div className="mt-3 h-3 w-1/2 rounded bg-current opacity-10" />
          <div className="mt-6 h-3 w-full rounded bg-current opacity-10" />
          <div className="mt-2 h-3 w-4/5 rounded bg-current opacity-10" />
          <div className="mt-2 h-3 w-3/5 rounded bg-current opacity-10" />
        </Card>
      ))}
    </div>
  );
}
