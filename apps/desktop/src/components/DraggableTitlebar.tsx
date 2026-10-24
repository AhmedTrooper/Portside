import { useEffect, useState, type PointerEvent } from "react";
import {
  Maximize,
  Minimize,
  X,
  Minus,
  ArrowLeft,
  ArrowRight,
  Activity,
} from "lucide-react";
import { Heading } from "@astryxdesign/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { useUIStore } from "../store/uiStore";

const appWindow = getCurrentWindow();

export default function DraggableTitlebar() {
  const { isOpsPanelOpen, toggleOpsPanel } = useUIStore();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const router = useRouter();
  // `location` updates on every navigation so we can re-render the
  // back/forward buttons based on the current history stack position.
  useRouterState({ select: (s) => s.location });

  useEffect(() => {
    appWindow.isFullscreen().then(setIsFullscreen);
  }, []);

  const handleFullscreen = async () => {
    const current = await appWindow.isFullscreen();
    await appWindow.setFullscreen(!current);
    setIsFullscreen(!current);
  };

  const handleDragStart = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target;
    if (target instanceof Element && target.closest("button, a, [role='button'], [data-window-controls]")) return;
    event.preventDefault();
    void appWindow.startDragging();
  };

  // TanStack's history exposes `canGoBack()`; forward has no public helper, so
  // we let the history API no-op when called at the end of the stack.
  const canBack = router.history.canGoBack();

  return (
    <div onPointerDown={handleDragStart} className="z-[99] min-w-0 shrink-0 pointer-events-auto cursor-grab active:cursor-grabbing flex flex-row items-center justify-between gap-2 border-b border-default bg-surface/80 px-2 sm:px-4 py-2 text-primary shadow-sm backdrop-blur-md">
      <div className="flex items-center min-w-0 gap-1 sm:gap-4">
        {/* History navigation. Buttons are disabled at the stack edges. */}
        <div className="hidden min-[360px]:flex items-center gap-1 shrink-0">
          <button
            type="button"
            aria-label="Go back"
            title="Go back"
            disabled={!canBack}
            onClick={() => router.history.back()}
            className="flex items-center justify-center p-1 rounded-md transition-colors outline-none focus:outline-none border-none bg-transparent hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ArrowLeft size={16} />
          </button>
          <button
            type="button"
            aria-label="Go forward"
            title="Go forward"
            onClick={() => router.history.forward()}
            className="flex items-center justify-center p-1 rounded-md transition-colors outline-none focus:outline-none border-none bg-transparent hover:bg-surface-hover"
          >
            <ArrowRight size={16} />
          </button>
        </div>

        <Heading
          level={5}
          style={{
            margin: 0,
            fontWeight: 600,
            letterSpacing: "0.5px",
          }}
          className="hidden min-[480px]:block select-none pointer-events-none"
        >
          Portside
        </Heading>
      </div>

      <div data-window-controls className="flex items-center gap-1 sm:gap-3 shrink-0 z-10">
        {/* Operations panel toggle. Pressing it flips the right rail that
            shows in-flight pull/remove progress on Images and Networks pages. */}
        <button
          type="button"
          aria-label={isOpsPanelOpen ? "Hide operations panel" : "Show operations panel"}
          title={isOpsPanelOpen ? "Hide operations panel" : "Show operations panel"}
          onClick={toggleOpsPanel}
          className={`flex items-center justify-center p-1 rounded-md transition-colors outline-none focus:outline-none border-none bg-transparent hover:bg-surface-hover ${
            isOpsPanelOpen ? "text-primary" : "text-secondary hover:text-primary"
          }`}
        >
          <Activity size={16} />
        </button>

        {/* Window Controls */}
        <div
          onClick={() => appWindow.close()}
          className="w-4 h-4 flex items-center justify-center rounded-full bg-red-500 hover:bg-red-400 transition-colors cursor-pointer"
          title="Close"
        >
          <X size={10} className="text-red-950 opacity-60 hover:opacity-100" />
        </div>
        <div
          onClick={() => appWindow.minimize()}
          className="w-4 h-4 flex items-center justify-center rounded-full bg-yellow-500 hover:bg-yellow-400 transition-colors cursor-pointer"
          title="Minimize"
        >
          <Minus size={10} className="text-yellow-950 opacity-60 hover:opacity-100" />
        </div>
        <div
          onClick={handleFullscreen}
          className="w-4 h-4 flex items-center justify-center rounded-full bg-green-500 hover:bg-green-400 transition-colors cursor-pointer"
          title="Toggle Fullscreen"
        >
          {isFullscreen ? (
            <Minimize size={10} className="text-green-950 opacity-60 hover:opacity-100" />
          ) : (
            <Maximize size={10} className="text-green-950 opacity-60 hover:opacity-100" />
          )}
        </div>
      </div>
    </div>
  );
}
