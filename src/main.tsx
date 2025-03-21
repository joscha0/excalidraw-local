import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <SidebarProvider>
      <AppSidebar />
      <main>
        <SidebarTrigger />
        <App />
      </main>
    </SidebarProvider>
  </React.StrictMode>
);
