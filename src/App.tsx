import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { AppSidebar } from "./components/app-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ExcalidrawWrapper } from "./components/excalidraw-wrapper";

function App() {
  const { initialize, appReady } = useStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (!appReady) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Loading Excalidraw Local...</h2>
          <p className="text-muted-foreground mt-2">
            Please wait while we set up your environment
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <SidebarProvider>
        <AppSidebar />
        <main className="flex flex-col w-full h-full">
          <SidebarTrigger />
          <ExcalidrawWrapper />
        </main>
      </SidebarProvider>
    </div>
  );
}

export default App;
