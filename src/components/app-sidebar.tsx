import { FileText, Moon, PlusCircle, Sun } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useStore } from "@/lib/store";
import { useState } from "react";
import { Button } from "./ui/button";

export function AppSidebar() {
  const {
    files,
    currentFile,
    createNewFile,
    setCurrentFile,
    theme,
    toggleTheme,
  } = useStore();
  const [newFileName, setNewFileName] = useState<string>("");
  const [isCreating, setIsCreating] = useState<boolean>(false);

  const handleCreateFile = () => {
    if (!isCreating) {
      setIsCreating(true);
      return;
    }

    if (newFileName.trim()) {
      createNewFile(newFileName);
      setNewFileName("");
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleCreateFile();
    } else if (e.key === "Escape") {
      setIsCreating(false);
      setNewFileName("");
    }
  };

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <div className="flex justify-between items-center">
            <SidebarGroupLabel>Excalidraw Local</SidebarGroupLabel>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            >
              {theme === "light" ? (
                <Moon className="h-4 w-4" />
              ) : (
                <Sun className="h-4 w-4" />
              )}
            </Button>
          </div>

          <SidebarGroupContent>
            <SidebarMenu>
              <Button className="w-full mb-4" onClick={handleCreateFile}>
                <PlusCircle className="mr-2 h-4 w-4" />
                {isCreating ? "Confirm Create" : "New Drawing"}
              </Button>

              {isCreating && (
                <div className="mb-4">
                  <input
                    type="text"
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="drawing-name.excalidraw"
                    className="w-full p-2 rounded border"
                    autoFocus
                  />
                </div>
              )}

              {files.map((file) => (
                <SidebarMenuItem key={file.path}>
                  <SidebarMenuButton asChild>
                    <Button
                      variant={
                        currentFile?.path === file.path ? "secondary" : "ghost"
                      }
                      className="w-full justify-start mb-1 font-normal"
                      onClick={() => setCurrentFile(file)}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      {file.name}
                    </Button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {files.length === 0 && (
                <p className="text-sm text-muted-foreground p-4 text-center">
                  No drawings yet. Create your first one!
                </p>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
