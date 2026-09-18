import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import App from "./App";
import "./index.css";
import { installGlobalErrorHandlers } from "./lib/telemetry";
import { CONVEX_URL } from "./lib/env";

// Observabilidade: captura global de erros (buffer local + /api/telemetry).
installGlobalErrorHandlers();

const convex = CONVEX_URL ? new ConvexReactClient(CONVEX_URL) : null;

const app = (
  <BrowserRouter>
    <App />
  </BrowserRouter>
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/* Sem backend configurado (modo draft), a app roda sem o provider. */}
    {convex ? <ConvexProvider client={convex}>{app}</ConvexProvider> : app}
  </React.StrictMode>
);
