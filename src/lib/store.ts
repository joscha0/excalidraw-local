import { create } from "zustand";
import {
  BaseDirectory,
  readDir,
  readTextFile,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

interface FileInfo {
  name: string;
  path: string;
}

interface AppState {
  files: FileInfo[];
  currentFile: FileInfo | null;
  elements: ExcalidrawElement[];
  appReady: boolean;
  basePath: string;

  initialize: () => Promise<void>;
  loadFiles: () => Promise<void>;
  createNewFile: (name: string) => Promise<void>;
  setCurrentFile: (file: FileInfo) => Promise<void>;
  updateElements: (elements: ExcalidrawElement[]) => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  files: [],
  currentFile: null,
  elements: [],
  appReady: false,
  basePath: "",

  initialize: async () => {
    try {
      set({ appReady: true });

      await get().loadFiles();
    } catch (error) {
      console.error("Failed to initialize:", error);
    }
  },

  loadFiles: async () => {
    try {
      const entries = await readDir("excalidraw", {
        baseDir: BaseDirectory.AppLocalData,
      });

      const files: FileInfo[] = entries
        .filter((entry) => entry.name?.endsWith(".excalidraw"))
        .map((entry) => ({
          name: entry.name || "",
          path: BaseDirectory.AppLocalData + "/excalidraw/" + entry.name,
        }));

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
      const filePath = BaseDirectory.AppLocalData + "/excalidraw/" + fileName;

      // Create empty file with default content
      await writeTextFile(filePath, JSON.stringify([]));

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
      const fileContent = await readTextFile(file.path);
      const elements = JSON.parse(fileContent) as ExcalidrawElement[];
      set({ currentFile: file, elements });
    } catch (error) {
      console.error("Failed to load file:", error);
    }
  },

  updateElements: async (elements: ExcalidrawElement[]) => {
    try {
      const { currentFile } = get();
      if (currentFile) {
        await writeTextFile(currentFile.path, JSON.stringify(elements));
        set({ elements });
      }
    } catch (error) {
      console.error("Failed to update elements:", error);
    }
  },
}));
