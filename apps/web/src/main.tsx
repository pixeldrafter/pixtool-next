import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { ErrorBoundary } from "./app/ErrorBoundary";
import App from "./App";
import "./styles/global.css";

/**
 * Modül yükleme / render dışı hataları da görünür kıl.
 * (ErrorBoundary yalnızca render hatalarını yakalar.)
 */
window.addEventListener("error", (event) => {
  console.error("[Pixtool] window.error:", event.error ?? event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("[Pixtool] unhandledrejection:", event.reason);
});

const container = document.getElementById("root");

if (!container) {
  throw new Error("Kök eleman (#root) bulunamadı — index.html bozuk olabilir.");
}

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
