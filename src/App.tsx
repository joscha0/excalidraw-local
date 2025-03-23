import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { AppSidebar } from "./components/app-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ExcalidrawWrapper } from "./components/excalidraw-wrapper";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "./components/ui/breadcrumb";

function App() {
  const { initialize, appReady, theme, currentFile } = useStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
  }, [theme]);

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
          <div className="flex w-full">
            <SidebarTrigger />
            <div className="w-full flex items-center justify-center">
              <Breadcrumb>
                <BreadcrumbList>
                  {currentFile?.path.split("/").map((item, index, arr) => {
                    return (
                      <>
                        {index !== 0 && <BreadcrumbSeparator />}
                        <BreadcrumbItem
                          className={
                            index == arr.length - 1
                              ? "font-bold text-white"
                              : ""
                          }
                        >
                          {item}
                        </BreadcrumbItem>
                      </>
                    );
                  })}
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </div>
          <ExcalidrawWrapper />
        </main>
      </SidebarProvider>
    </div>
  );
}

export default App;
