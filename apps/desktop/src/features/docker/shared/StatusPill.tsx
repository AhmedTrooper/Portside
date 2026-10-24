import {
  CheckCircle2,
  CircleDashed,
  HelpCircle,
  Loader2,
  Pause,
  RotateCw,
  StopCircle,
  XCircle,
} from "lucide-react";

interface StatusConfig {
  /** Foreground color for the icon and border. */
  textColorVar: string;
  /** Background tint for the circular badge. */
  bgColorVar: string;
  icon: typeof CheckCircle2;
  label: string;
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
  running: {
    textColorVar: "var(--color-text-green)",
    bgColorVar: "var(--color-background-green)",
    icon: CheckCircle2,
    label: "Running",
  },
  paused: {
    textColorVar: "var(--color-text-yellow)",
    bgColorVar: "var(--color-background-yellow)",
    icon: Pause,
    label: "Paused",
  },
  restarting: {
    textColorVar: "var(--color-text-blue)",
    bgColorVar: "var(--color-background-blue)",
    icon: RotateCw,
    label: "Restarting",
  },
  created: {
    textColorVar: "var(--color-text-blue)",
    bgColorVar: "var(--color-background-blue)",
    icon: CircleDashed,
    label: "Created",
  },
  exited: {
    textColorVar: "var(--color-text-red)",
    bgColorVar: "var(--color-background-red)",
    icon: StopCircle,
    label: "Exited",
  },
  dead: {
    textColorVar: "var(--color-text-red)",
    bgColorVar: "var(--color-background-red)",
    icon: XCircle,
    label: "Dead",
  },
  removing: {
    textColorVar: "var(--color-text-yellow)",
    bgColorVar: "var(--color-background-yellow)",
    icon: Loader2,
    label: "Removing",
  },
};

const FALLBACK_STATUS: StatusConfig = {
  textColorVar: "var(--color-text-secondary)",
  bgColorVar: "var(--color-background-muted)",
  icon: HelpCircle,
  label: "Unknown",
};

function getStatusConfig(state: string): StatusConfig {
  return STATUS_CONFIG[state.toLowerCase()] ?? FALLBACK_STATUS;
}

interface StatusPillProps {
  state: string;
  /** Override the default title-cased label, e.g. `3 running`. */
  label?: string;
}

/**
 * Compact icon-only status indicator shared by container and compose cards.
 * The status name stays available through the native tooltip and aria-label;
 * the icon shape and colour carry the meaning in the card itself.
 */
export function StatusPill({ state, label }: StatusPillProps) {
  const config = getStatusConfig(state);
  const IconComponent = config.icon;
  const text = label ?? config.label;

  return (
    <span
      role="status"
      aria-label={`Status: ${text}`}
      title={`Status: ${text}`}
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full select-none"
      style={{
        color: config.textColorVar,
        backgroundColor: config.bgColorVar,
        border: "1px solid color-mix(in srgb, currentColor 30%, transparent)",
      }}
    >
      <IconComponent size={13} aria-hidden strokeWidth={2.5} />
    </span>
  );
}
