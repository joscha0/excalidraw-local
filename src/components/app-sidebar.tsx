import {
  FileText,
  Moon,
  PlusCircle,
  Sun,
  Edit2,
  Trash2,
  Folder,
  FolderPlus,
  Move,
  MoreHorizontal,
  History,
  RotateCcw,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
} from "@/components/ui/sidebar";
import { useStore, FileInfo, directoryName } from "@/lib/store";
import { useState } from "react";
import { Button } from "./ui/button";

import { FileHistory } from "./file-history";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";

export function AppSidebar() {
  const {
    files,
    currentFile,
    createNewFile,
    setCurrentFile,
    theme,
    toggleTheme,
    renameFile,
    deleteFile,
    createFolder,
    moveFile,
    loadFiles,
  } = useStore();
  const [newFileName, setNewFileName] = useState<string>("");
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileToRename, setFileToRename] = useState<FileInfo | null>(null);
  const [renameValue, setRenameValue] = useState<string>("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [fileToDelete, setFileToDelete] = useState<FileInfo | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState<boolean>(false);
  const [folderName, setFolderName] = useState<string>("");
  const [moveDialogOpen, setMoveDialogOpen] = useState<boolean>(false);
  const [fileToMove, setFileToMove] = useState<FileInfo | null>(null);
  const [targetFolder, setTargetFolder] = useState<FileInfo | null>(null);

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

  const handleStartRename = (file: FileInfo) => {
    setFileToRename(file);
    setRenameValue(file.name.replace(".excalidraw", ""));
  };

  const handleRename = async () => {
    if (!fileToRename || !renameValue.trim()) return;

    try {
      await renameFile(fileToRename, renameValue);
      setFileToRename(null);
      setRenameValue("");
      setRenameError(null);
    } catch (error) {
      setRenameError((error as Error).message);
    }
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleRename();
    } else if (e.key === "Escape") {
      setFileToRename(null);
      setRenameValue("");
      setRenameError(null);
    }
  };

  const handleDelete = async (file: FileInfo) => {
    try {
      await deleteFile(file);
      setFileToDelete(null);
    } catch (error) {
      console.error("Error deleting file:", error);
    }
  };

  const handleCreateFolder = () => {
    if (!isCreatingFolder) {
      setIsCreatingFolder(true);
      return;
    }

    if (folderName.trim()) {
      // Check if a folder with this name already exists
      const folderExists = files.some(
        (file) =>
          file.isFolder && file.name.toLowerCase() === folderName.toLowerCase()
      );

      if (folderExists) {
        setFileError(`A folder named "${folderName}" already exists`);
        return;
      }
      createFolder(folderName);
      setFolderName("");
      setIsCreatingFolder(false);
      setFileError(null);
    }
  };

  const handleFolderKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleCreateFolder();
    } else if (e.key === "Escape") {
      setIsCreatingFolder(false);
      setFolderName("");
    }
  };

  const handleMoveFile = (file: FileInfo) => {
    setFileToMove(file);
    setMoveDialogOpen(true);
  };

  const confirmMoveFile = async () => {
    if (!fileToMove) return;

    try {
      await moveFile(fileToMove, targetFolder?.path || null);
      setFileToMove(null);
      setTargetFolder(null);
      setMoveDialogOpen(false);
    } catch (error) {
      console.error("Error moving file:", error);
    }
  };

  // Function to render files and folders recursively
  const renderFileTree = (parentPath: string | null = null) => {
    // Get files/folders at this level
    const items = files.filter((file) => file.parentPath === parentPath);

    // Sort folders first, then files
    const sortedItems = [
      ...items.filter((item) => item.isFolder),
      ...items.filter((item) => !item.isFolder),
    ];

    return sortedItems.map((item) => (
      <Collapsible defaultOpen className="group/collapsible">
        <SidebarMenuItem
          key={item.path}
          className={item.isFolder ? "ml-0" : "ml-4"}
        >
          {fileToRename?.path === item.path ? (
            <div className="mb-4">
              <input
                type="text"
                value={renameValue}
                onChange={(e) => {
                  setRenameValue(e.target.value);
                  setRenameError(null);
                }}
                onKeyDown={handleRenameKeyDown}
                placeholder={item.isFolder ? "folder-name" : "drawing-name"}
                className="w-full p-2 rounded border"
                autoFocus
              />
              {renameError && (
                <p className="text-sm text-red-500 mt-1">{renameError}</p>
              )}
              <div className="flex justify-end gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFileToRename(null);
                    setRenameError(null);
                  }}
                >
                  Cancel
                </Button>
                <Button variant="default" size="sm" onClick={handleRename}>
                  Rename
                </Button>
              </div>
            </div>
          ) : (
            <CollapsibleTrigger asChild>
              <SidebarMenuButton asChild>
                <Button
                  variant={
                    !item.isFolder && currentFile?.path === item.path
                      ? "secondary"
                      : "ghost"
                  }
                  className="flex-1 justify-start mb-1 font-normal"
                  onClick={() => {
                    if (!item.isFolder) {
                      setCurrentFile(item);
                    }
                    // Could add folder expansion logic here
                  }}
                >
                  {item.isFolder ? (
                    <Folder className="mr-2 h-4 w-4" />
                  ) : (
                    <FileText className="mr-2 h-4 w-4" />
                  )}
                  {item.isFolder
                    ? item.name
                    : item.name.replace(".excalidraw", "")}
                </Button>
              </SidebarMenuButton>
            </CollapsibleTrigger>
          )}

          {fileToDelete?.path === item.path && (
            <div className="mt-1 mb-3 p-3 bg-destructive/10 rounded-md">
              <p className="text-sm mb-2">
                Are you sure you want to delete "
                {item.isFolder
                  ? item.name
                  : item.name.replace(".excalidraw", "")}
                "?
                {item.isFolder && " This will delete all files inside."}
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFileToDelete(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(item)}
                >
                  Delete
                </Button>
              </div>
            </div>
          )}

          {fileToRename?.path !== item.path && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuAction>
                  <MoreHorizontal />
                </SidebarMenuAction>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="start">
                {!item.isFolder && currentFile?.path === item.path && (
                  <DropdownMenuItem onClick={() => setHistoryOpen(true)}>
                    <History className="h-4 w-4" />
                    <span>View History</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => handleStartRename(item)}>
                  <Edit2 className="h-4 w-4" />
                  <span>Rename {item.isFolder ? "Folder" : "File"}</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleMoveFile(item)}>
                  <Move className="h-4 w-4" />
                  <span>Move {item.isFolder ? "Folder" : "File"}</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFileToDelete(item)}>
                  <Trash2 className="h-4 w-4" />
                  <span>Delete</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {/* Render subfolders and files recursively */}
          {item.isFolder && (
            <CollapsibleContent>
              <SidebarMenuSub>{renderFileTree(item.path)}</SidebarMenuSub>
            </CollapsibleContent>
          )}
        </SidebarMenuItem>
      </Collapsible>
    ));
  };

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <div className="flex justify-between items-center pb-4">
            <SidebarGroupLabel className="font-bold text-lg">
              Excalidraw Local
            </SidebarGroupLabel>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={loadFiles}
                title="Refresh files"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
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
          </div>

          <SidebarGroupContent>
            <SidebarMenu>
              <FileHistory
                open={historyOpen}
                onClose={() => setHistoryOpen(false)}
              />

              <div className="flex mb-2">
                <Button className="flex-1" onClick={handleCreateFile}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  {isCreating ? "Create File" : "New Drawing"}
                </Button>
              </div>

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

              <div className="flex mb-2">
                <Button className="flex-1" onClick={handleCreateFolder}>
                  <FolderPlus className="mr-2 h-4 w-4" />
                  {isCreatingFolder ? "Create Folder" : "New Folder"}
                </Button>
              </div>

              {isCreatingFolder && (
                <div className="mb-4">
                  <input
                    type="text"
                    value={folderName}
                    onChange={(e) => {
                      setFolderName(e.target.value);
                      setFileError(null);
                    }}
                    onKeyDown={handleFolderKeyDown}
                    placeholder="folder-name"
                    className="w-full p-2 rounded border"
                    autoFocus
                  />
                  {fileError && (
                    <p className="text-sm text-red-500 mt-1">{fileError}</p>
                  )}
                </div>
              )}

              {/* Render the file tree */}
              {renderFileTree(directoryName)}

              {moveDialogOpen && fileToMove && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                  <div className="bg-background p-6 rounded-lg w-80">
                    <h3 className="text-lg font-semibold mb-4">
                      Move {fileToMove.isFolder ? "Folder" : "File"}
                    </h3>
                    <p className="mb-2">
                      Move "
                      {fileToMove.isFolder
                        ? fileToMove.name
                        : fileToMove.name.replace(".excalidraw", "")}
                      " to:
                    </p>

                    <div className="max-h-60 overflow-y-auto mb-4 border rounded p-2">
                      <div
                        className={`p-2 hover:bg-muted rounded cursor-pointer ${
                          targetFolder === null ? "bg-muted" : ""
                        }`}
                        onClick={() => setTargetFolder(null)}
                      >
                        Root folder
                      </div>
                      {files
                        .filter(
                          (file) =>
                            file.isFolder &&
                            // Don't show the folder being moved or its subfolders as destinations
                            !(
                              fileToMove.isFolder &&
                              (file.path === fileToMove.path ||
                                file.path.startsWith(`${fileToMove.path}/`))
                            )
                        )
                        .map((folder) => (
                          <div
                            key={folder.path}
                            className={`p-2 hover:bg-muted rounded cursor-pointer ${
                              targetFolder?.path === folder.path
                                ? "bg-muted"
                                : ""
                            }`}
                            onClick={() => setTargetFolder(folder)}
                          >
                            <Folder className="h-4 w-4 inline mr-2" />
                            {folder.name}
                          </div>
                        ))}
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setMoveDialogOpen(false);
                          setFileToMove(null);
                          setTargetFolder(null);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={confirmMoveFile}
                      >
                        Move
                      </Button>
                    </div>
                  </div>
                </div>
              )}

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
