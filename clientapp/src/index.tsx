import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import "ol/ol.css";           // <-- OL css burada yüklensin (global)
import App from "./App";

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);
root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
