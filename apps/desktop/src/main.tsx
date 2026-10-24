import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";
import "@fontsource-variable/inter";
import "./index.css";
import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";

// Disable right-click context menu globally
document.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  return false;
}, false);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
