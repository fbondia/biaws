import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { ApplicationBootstrap } from "./infrastructure/bootstrap/ApplicationBootstrap.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ApplicationBootstrap />
  </StrictMode>,
);
