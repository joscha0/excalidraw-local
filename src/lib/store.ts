import { create } from "zustand";
import {
  BaseDirectory,
  readDir,
  readTextFile,
  writeTextFile,
  mkdir,
  rename,
  remove,
} from "@tauri-apps/plugin-fs";
import { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { invoke } from "@tauri-apps/api/core";

export interface FileInfo {
  name: string;
  path: string;
  isFolder: boolean;
  parentPath: string | null;
}

export type Theme = "light" | "dark" | "system";

interface FileHistoryEntry {
  commit_id: string;
  message: string;
  timestamp: number;
  author: string;
}

interface AppState {
  files: FileInfo[];
  currentFile: FileInfo | null;
  elements: ExcalidrawElement[];
  appReady: boolean;
  basePath: string;
  theme: Theme;
  pendingChanges: boolean;
  lastCommitTime: number;

  initialize: () => Promise<void>;
  loadFiles: () => Promise<void>;
  createNewFile: (name: string) => Promise<void>;
  setCurrentFile: (file: FileInfo) => Promise<void>;
  updateElements: (elements: ExcalidrawElement[]) => Promise<void>;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  initializeGit: () => Promise<void>;
  commitChanges: (message: string) => Promise<void>;
  getFileHistory: () => Promise<FileHistoryEntry[]>;
  restoreVersion: (commitId: string) => Promise<void>;
  renameFile: (file: FileInfo, newName: string) => Promise<void>;
  deleteFile: (file: FileInfo) => Promise<void>;
  createFolder: (name: string, parentPath?: string) => Promise<void>;
  moveFile: (file: FileInfo, targetFolderPath: string | null) => Promise<void>;
}

const directoryName = "excalidraw-local";

export const useStore = create<AppState>((set, get) => ({
  files: [],
  currentFile: null,
  elements: [],
  appReady: false,
  basePath: "",
  theme: "light",
  pendingChanges: false,
  lastCommitTime: Date.now(),
  setTheme: (theme) => set({ theme }),
  toggleTheme: () =>
    set((state) => ({
      theme: state.theme === "light" ? "dark" : "light",
    })),

  initialize: async () => {
    try {
      try {
        await mkdir(directoryName, {
          baseDir: BaseDirectory.AppData,
        });
      } catch (error) {
        // Directory might already exist, continue
        console.log("Directory might already exist:", error);
      }

      await get().initializeGit();

      set({ appReady: true });

      await get().loadFiles();
    } catch (error) {
      console.error("Failed to initialize:", error);
    }
  },

  loadFiles: async () => {
    try {
      const entries = await readDir(directoryName, {
        baseDir: BaseDirectory.AppData,
      });

      const files: FileInfo[] = [];
      const folders: FileInfo[] = [];

      // Process entries to build folder structure
      entries.forEach((entry) => {
        // Use entry.name for the path elements to construct the full path
        const fullPath = entry.name || "";
        const relativePath = fullPath.split(`${directoryName}/`)[1] || fullPath;
        const pathParts = relativePath.split("/");
        const parentPath =
          pathParts.length > 1
            ? `${directoryName}/${pathParts.slice(0, -1).join("/")}`
            : null;

        if (entry.isDirectory) {
          // This is a folder
          folders.push({
            name: entry.name || "",
            path: `${directoryName}/${relativePath}`,
            isFolder: true,
            parentPath,
          });
        } else if (entry.name?.endsWith(".excalidraw")) {
          // This is a file
          files.push({
            name: entry.name || "",
            path: `${directoryName}/${relativePath}`,
            isFolder: false,
            parentPath,
          });
        }
      });

      // Combine folders and files, with folders first
      set({ files: [...folders, ...files] });
    } catch (error) {
      console.error("Failed to load files:", error);
    }
  },

  createFolder: async (name: string, parentPath?: string) => {
    try {
      const folderPath = parentPath
        ? `${parentPath}/${name}`
        : `${directoryName}/${name}`;

      await mkdir(folderPath, {
        baseDir: BaseDirectory.AppData,
        recursive: true,
      });

      const newFolder: FileInfo = {
        name,
        path: folderPath,
        isFolder: true,
        parentPath: parentPath || null,
      };

      // Update files list with the new folder
      set((state) => ({
        files: [...state.files, newFolder],
      }));
    } catch (error) {
      console.error("Failed to create folder:", error);
    }
  },

  moveFile: async (file: FileInfo, targetFolderPath: string | null) => {
    try {
      const fileName = file.name;
      const sourcePath = file.path;

      // If targetFolderPath is null, we're moving to the root
      const destinationPath = targetFolderPath
        ? `${targetFolderPath}/${fileName}`
        : `${directoryName}/${fileName}`;

      // Move the file
      await rename(sourcePath, destinationPath, {
        oldPathBaseDir: BaseDirectory.AppData,
        newPathBaseDir: BaseDirectory.AppData,
      });

      // Update file information
      const updatedFile: FileInfo = {
        ...file,
        path: destinationPath,
        parentPath: targetFolderPath,
      };

      // Update state
      set((state) => ({
        files: state.files.map((f) =>
          f.path === sourcePath ? updatedFile : f
        ),
        currentFile:
          state.currentFile?.path === sourcePath
            ? updatedFile
            : state.currentFile,
      }));

      // Commit the move action
      await get().commitChanges(
        `Moved ${file.name} to ${targetFolderPath || "root"}`
      );
    } catch (error) {
      console.error("Failed to move file:", error);
      throw error;
    }
  },

  createNewFile: async (name: string, parentPath?: string) => {
    try {
      const fileName = name.endsWith(".excalidraw")
        ? name
        : `${name}.excalidraw`;

      const filePath = parentPath
        ? `${parentPath}/${fileName}`
        : `${directoryName}/${fileName}`;

      // Create empty file with default content
      await writeTextFile(filePath, JSON.stringify([]), {
        baseDir: BaseDirectory.AppData,
      });

      const newFile: FileInfo = {
        name: fileName,
        path: filePath,
        isFolder: false,
        parentPath: parentPath || null,
      };

      // Update files list and set as current
      set((state) => ({
        files: [...state.files, newFile],
        currentFile: newFile,
        elements: [],
      }));
    } catch (error) {
      console.error("Failed to create file:", error);
    }
  },

  setCurrentFile: async (file: FileInfo) => {
    try {
      // Commit pending changes on current file before switching
      const { pendingChanges, currentFile } = get();
      if (pendingChanges && currentFile) {
        set({ lastCommitTime: Date.now(), pendingChanges: false });
        await get().commitChanges("Updated drawing before switching files");
      }

      const fileContent = await readTextFile(file.path, {
        baseDir: BaseDirectory.AppData,
      });
      const elements = JSON.parse(fileContent) as ExcalidrawElement[];
      set({ currentFile: file, elements, pendingChanges: false });
    } catch (error) {
      console.error("Failed to load file:", error);
    }
  },

  initializeGit: async () => {
    try {
      const result = await invoke<string>("init_git_repo");
      console.log(result);
    } catch (error) {
      console.error("Failed to initialize Git repository:", error);
    }
  },

  updateElements: async (elements: ExcalidrawElement[]) => {
    try {
      const { currentFile, lastCommitTime } = get();
      if (currentFile) {
        await writeTextFile(currentFile.path, JSON.stringify(elements), {
          baseDir: BaseDirectory.AppData,
        });
        set({ elements, pendingChanges: true });

        // commit after 10 minutes
        if (lastCommitTime + 60 * 10 * 1000 < Date.now()) {
          set({ lastCommitTime: Date.now(), pendingChanges: false });
          await get().commitChanges("Updated drawing");
        }
      }
    } catch (error) {
      console.error("Failed to update elements:", error);
    }
  },

  commitChanges: async (message: string) => {
    try {
      const { currentFile } = get();
      if (currentFile) {
        const result = await invoke<string>("commit_changes", {
          filePath: currentFile.path,
          message,
        });
        console.log(result);
      }
    } catch (error) {
      console.error("Failed to commit changes:", error);
    }
  },

  getFileHistory: async () => {
    try {
      const { currentFile } = get();
      if (!currentFile) return [];

      const history = await invoke<FileHistoryEntry[]>("get_file_history", {
        filePath: currentFile.path,
      });
      return history;
    } catch (error) {
      console.error("Failed to get file history:", error);
      return [];
    }
  },

  restoreVersion: async (commitId: string) => {
    try {
      const { currentFile } = get();
      if (!currentFile) return;

      const result = await invoke<string>("restore_version", {
        filePath: currentFile.path,
        commitId,
      });
      console.log(result);

      // Reload the file content
      const tempFile = { ...currentFile };
      set({ currentFile: null });
      await get().setCurrentFile(tempFile);
    } catch (error) {
      console.error("Failed to restore version:", error);
    }
  },

  renameFile: async (file: FileInfo, newName: string) => {
    try {
      const fileName = newName.endsWith(".excalidraw")
        ? newName
        : `${newName}.excalidraw`;
      const newPath = `${directoryName}/${fileName}`;

      // Check if new filename already exists
      const exists = get().files.some(
        (f) =>
          f.path !== file.path &&
          f.name.toLowerCase() === fileName.toLowerCase()
      );

      if (exists) {
        throw new Error(`A file named "${fileName}" already exists`);
      }

      // Rename the file
      await rename(file.path, newPath, {
        oldPathBaseDir: BaseDirectory.AppData,
        newPathBaseDir: BaseDirectory.AppData,
      });

      // Update state
      const newFile: FileInfo = {
        name: fileName,
        path: newPath,
        isFolder: file.isFolder,
        parentPath: file.parentPath,
      };
      set((state) => ({
        files: state.files.map((f) => (f.path === file.path ? newFile : f)),
        currentFile:
          state.currentFile?.path === file.path ? newFile : state.currentFile,
      }));

      // Commit the rename action
      await get().commitChanges(
        `Renamed file from ${file.name} to ${fileName}`
      );
    } catch (error) {
      console.error("Failed to rename file:", error);
      throw error;
    }
  },

  deleteFile: async (file: FileInfo) => {
    try {
      // For folders, we need to recursively delete all contents
      if (file.isFolder) {
        await remove(file.path, {
          baseDir: BaseDirectory.AppData,
          recursive: true,
        });
      } else {
        // Delete a single file
        await remove(file.path, { baseDir: BaseDirectory.AppData });
      }

      // Update state
      const { currentFile, files } = get();

      // Get all files/folders that should be removed (the target and all children)
      const pathsToRemove = file.isFolder
        ? [
            file.path,
            ...files
              .filter((f) => f.path.startsWith(`${file.path}/`))
              .map((f) => f.path),
          ]
        : [file.path];

      const newFiles = files.filter((f) => !pathsToRemove.includes(f.path));

      // Update state including handling the current file
      set({
        files: newFiles,
        currentFile: pathsToRemove.includes(currentFile?.path || "")
          ? newFiles.find((f) => !f.isFolder) || null
          : currentFile,
        elements: pathsToRemove.includes(currentFile?.path || "")
          ? []
          : get().elements,
      });

      await get().commitChanges(
        `Deleted ${file.isFolder ? "folder" : "file"} ${file.name}`
      );

      // If we selected a new current file, load it
      if (
        pathsToRemove.includes(currentFile?.path || "") &&
        newFiles.some((f) => !f.isFolder)
      ) {
        await get().setCurrentFile(newFiles.find((f) => !f.isFolder)!);
      }
    } catch (error) {
      console.error("Failed to delete file:", error);
      throw error;
    }
  },
}));
