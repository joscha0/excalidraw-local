import { create } from "zustand";
import {
  BaseDirectory,
  readDir,
  readTextFile,
  writeTextFile,
  mkdir,
} from "@tauri-apps/plugin-fs";
import { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

interface FileInfo {
  name: string;
  path: string;
}

export type Theme = "light" | "dark" | "system";

interface AppState {
  files: FileInfo[];
  currentFile: FileInfo | null;
  elements: ExcalidrawElement[];
  appReady: boolean;
  basePath: string;
  theme: Theme;

  initialize: () => Promise<void>;
  loadFiles: () => Promise<void>;
  createNewFile: (name: string) => Promise<void>;
  setCurrentFile: (file: FileInfo) => Promise<void>;
  updateElements: (elements: ExcalidrawElement[]) => Promise<void>;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const directoryName = "excalidraw-local";

export const useStore = create<AppState>((set, get) => ({
  files: [],
  currentFile: null,
  elements: [],
  appReady: false,
  basePath: "",
  theme: "system",
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
      const fileContent = await readTextFile(file.path, {
        baseDir: BaseDirectory.AppData,
      });
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
        await writeTextFile(currentFile.path, JSON.stringify(elements), {
          baseDir: BaseDirectory.AppData,
        });
        set({ elements });
      }
    } catch (error) {
      console.error("Failed to update elements:", error);
    }
  },
}));
