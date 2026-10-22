import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/App";
import { initTelegram } from "./telegram";
import { trackOpen } from "./analytics";
import "./ui/styles.css";

initTelegram();
trackOpen();
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
