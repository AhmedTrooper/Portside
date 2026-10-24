import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GripHorizontal,
  Menu,
  Maximize,
  Minimize,
  GripVertical,
  X,
  Minus,
  ArrowLeft,
  ArrowRight,
  Activity,
} from "lucide-react";
import { Heading } from "@astryxdesign/core";
import { Switch } from "@astryxdesign/core/Switch";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { useUIStore } from "../store/uiStore";

const appWindow = getCurrentWindow();

export default function DraggableTitlebar() {
  const { toggleSidebar, dockPos, cycleDockPos, isOpsPanelOpen, toggleOpsPanel } = useUIStore();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isWidgetDraggable, setIsWidgetDraggable] = useState(true);
  const router = useRouter();
  // `location` updates on every navigation so we can re-render the
  // back/forward buttons based on the current index in the history stack.
  useRouterState({ select: (s) => s.location });

  useEffect(() => {
    appWindow.isFullscreen().then(setIsFullscreen);
  }, []);

  // Automatically pin the widget (unmovable in web app, moves OS window instead) after 60 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsWidgetDraggable(false);
    }, 60000);
    return () => clearTimeout(timer);
  }, []);

  const handleFullscreen = async () => {
    const current = await appWindow.isFullscreen();
    await appWindow.setFullscreen(!current);
    setIsFullscreen(!current);
  };

  // Determine fixed positioning classes based on dockPos. The icon
  // orientation flips with the axis so the back/forward arrows always point
  // in the direction the browser history would travel.
  let posClasses = "";
  let isVertical = false;

  if (dockPos === "top") {
    posClasses = "flex-row justify-between border-b";
  } else if (dockPos === "bottom") {
    posClasses = "flex-row justify-between border-t";
  } else if (dockPos === "right") {
    posClasses = "h-full flex-col justify-between border-l";
    isVertical = true;
  }

  // TanStack's history exposes `canGoBack()`; forward has no public
  // helper, so we let the history API no-op when called at the end of the
  // stack. Subscribing to `useRouterState` above re-renders navigation on
  // every route change so the back button updates correctly.
  const canBack = router.history.canGoBack();

  return (
    <AnimatePresence>
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        // When not "draggable" (meaning it's in OS drag mode), make the whole bar an OS drag region
        data-tauri-drag-region={!isWidgetDraggable ? "true" : undefined}
        className={`z-[99] shrink-0 pointer-events-auto flex items-center bg-surface/80 text-primary backdrop-blur-md border-default shadow-sm ${
          isVertical ? "py-4 px-2" : "px-4 py-2"
        } ${posClasses}`}
      >
        {/* Left/Top Group */}
        <div className={`flex items-center gap-4 ${isVertical ? "flex-col" : "flex-row"}`} data-tauri-drag-region={undefined}>
          <div
            onClick={cycleDockPos}
            className="cursor-pointer text-secondary hover:text-primary transition-colors"
            title="Click to change dock position"
          >
            {isVertical ? <GripHorizontal size={20} /> : <GripVertical size={20} />}
          </div>

          {/* Sidebar Toggle */}
          <button
            className="flex items-center justify-center p-1 hover:bg-surface-hover rounded-md cursor-pointer transition-colors z-10 outline-none focus:outline-none border-none bg-transparent"
            onClick={toggleSidebar}
            title="Toggle Sidebar"
          >
            <Menu size={18} />
          </button>

          {/* History navigation. Buttons are disabled at the stack edges.
              Icons rotate 90° when the titlebar is vertical so the arrows
              point along the dock's primary axis (up = back, down = forward). */}
          <div
            className={`flex items-center gap-1 ${isVertical ? "flex-col" : "flex-row"}`}
            data-tauri-drag-region={undefined}
          >
            <button
              type="button"
              aria-label="Go back"
              title="Go back"
              disabled={!canBack}
              onClick={() => router.history.back()}
              className="flex items-center justify-center p-1 rounded-md transition-colors outline-none focus:outline-none border-none bg-transparent hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                transform: isVertical ? "rotate(90deg)" : "none",
              }}
            >
              <ArrowLeft size={16} />
            </button>
            <button
              type="button"
              aria-label="Go forward"
              title="Go forward"
              onClick={() => router.history.forward()}
              className="flex items-center justify-center p-1 rounded-md transition-colors outline-none focus:outline-none border-none bg-transparent hover:bg-surface-hover"
              style={{
                transform: isVertical ? "rotate(90deg)" : "none",
              }}
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
              writingMode: isVertical ? "vertical-rl" : "horizontal-tb",
            }}
            className="select-none pointer-events-none"
          >
            Portside
          </Heading>
        </div>

        {/* Right/Bottom Group */}
        <div className={`flex items-center gap-3 z-10 ${isVertical ? "flex-col" : "flex-row"}`} data-tauri-drag-region={undefined}>

          {/* Toggle between Widget Drag (true) and OS Window Drag (false) */}
          <div title={isWidgetDraggable ? "Floating UI Mode (Click Grip to move)" : "Pinned Mode (Drag moves OS window)"}>
            <Switch
              size="sm"
              label={isWidgetDraggable ? "Float" : "Pinned"}
              isLabelHidden
              value={isWidgetDraggable}
              onChange={(val) => setIsWidgetDraggable(val)}
            />
          </div>

          <div className={`${isVertical ? "h-px w-4" : "w-px h-4"} bg-gray-600 mx-1`} />

          {/* Operations panel toggle. Pressing it flips the right rail that
              shows in-flight pull/remove progress on Images and Networks
              pages. */}
          <button
            type="button"
            aria-label={isOpsPanelOpen ? "Hide operations panel" : "Show operations panel"}
            title={isOpsPanelOpen ? "Hide operations panel" : "Show operations panel"}
            onClick={toggleOpsPanel}
            data-tauri-drag-region={undefined}
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
            {isFullscreen ? <Minimize size={10} className="text-green-950 opacity-60 hover:opacity-100" /> : <Maximize size={10} className="text-green-950 opacity-60 hover:opacity-100" />}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
