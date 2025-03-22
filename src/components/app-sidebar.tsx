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

import { FileHistory } from "./file-history";

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
  const [historyOpen, setHistoryOpen] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const handleCreateFile = () => {
    if (!isCreating) {
      setIsCreating(true);
      return;
    }

    if (newFileName.trim()) {
      // Check if a file with this name already exists
      const fileName = newFileName.endsWith(".excalidraw")
        ? newFileName
        : `${newFileName}.excalidraw`;

      const fileExists = files.some(
        (file) => file.name.toLowerCase() === fileName.toLowerCase()
      );

      if (fileExists) {
        setFileError(`A file named "${newFileName}" already exists`);
        return;
      }
      createNewFile(newFileName);
      setNewFileName("");
      setIsCreating(false);
      setFileError(null);
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewFileName(e.target.value);
    setFileError(null); // Clear error when user changes input
  };

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <div className="flex justify-between items-center pb-4">
            <SidebarGroupLabel className="font-bold text-lg">
              Excalidraw Local
            </SidebarGroupLabel>
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
              <FileHistory
                open={historyOpen}
                onClose={() => setHistoryOpen(false)}
              />

              <Button className="w-full mb-4" onClick={handleCreateFile}>
                <PlusCircle className="mr-2 h-4 w-4" />
                {isCreating ? "Confirm Create" : "New Drawing"}
              </Button>

              {isCreating && (
                <div className="mb-4">
                  <input
                    type="text"
                    value={newFileName}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder="drawing-name"
                    className="w-full p-2 rounded border"
                    autoFocus
                  />
                  {fileError && (
                    <p className="text-sm text-red-500 mt-1">{fileError}</p>
                  )}
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
                      {file.name.replace(".excalidraw", "")}
                    </Button>
                  </SidebarMenuButton>
                  {currentFile?.path === file.path && (
                    <div className="flex justify-end w-full mt-1 mb-2">
                      <Button
                        variant="outline"
                        onClick={() => setHistoryOpen(true)}
                      >
                        View File History
                      </Button>
                    </div>
                  )}
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
