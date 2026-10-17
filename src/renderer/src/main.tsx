import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/global.css";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Pagegrove: #root container missing");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
