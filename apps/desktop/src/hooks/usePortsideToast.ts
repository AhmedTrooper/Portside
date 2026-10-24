import { useCallback } from "react";
import { useToast, type ToastOptions } from "@astryxdesign/core/Toast";

export function notificationOptions(options: ToastOptions): ToastOptions {
  const duration = options.autoHideDuration;
  return {
    ...options,
    isAutoHide: true,
    autoHideDuration: typeof duration === "number" && Number.isFinite(duration) && duration > 0
      ? duration : options.type === "error" ? 6000 : 3000,
  };
}

/** App policy: every notification expires, including error notifications. */
export function usePortsideToast() {
  const toast = useToast();
  return useCallback((options: ToastOptions) => toast(notificationOptions(options)), [toast]);
}
