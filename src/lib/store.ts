import { create } from "zustand";
import {
  BaseDirectory,
  readDir,
  readTextFile,
  writeTextFile,
  mkdir,
} from "@tauri-apps/plugin-fs";
import { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { invoke } from "@tauri-apps/api/core";

interface FileInfo {
  name: string;
  path: string;
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
}

const directoryName = "excalidraw-local";

export const useStore = create<AppState>((set, get) => ({
  files: [],
  currentFile: null,
  elements: [],
  appReady: false,
  basePath: "",
  theme: "system",
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

      const files: FileInfo[] = entries
        .filter((entry) => entry.name?.endsWith(".excalidraw"))
        .map((entry) => ({
          name: entry.name || "",
          path: `${directoryName}/${entry.name}`,
        }));

      console.log("files", files);

      set({ files });
    } catch (error) {
      console.error("Failed to load files:", error);
    }
  },

  createNewFile: async (name: string) => {
    try {
      const fileName = name.endsWith(".excalidraw")
        ? name
        : `${name}.excalidraw`;
      const filePath = `${directoryName}/${fileName}`;

      // Create empty file with default content
      await writeTextFile(filePath, JSON.stringify([]), {
        baseDir: BaseDirectory.AppData,
      });

      const newFile = { name: fileName, path: filePath };

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
}));
