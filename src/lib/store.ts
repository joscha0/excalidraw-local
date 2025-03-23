import { create } from "zustand";
import {
  BaseDirectory,
  readDir,
  readTextFile,
  writeTextFile,
  mkdir,
  rename,
  remove,
  DirEntry,
} from "@tauri-apps/plugin-fs";
import { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { invoke } from "@tauri-apps/api/core";
import { join } from "@tauri-apps/api/path";

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

interface GitConfig {
  remoteUrl: string;
  username: string;
  email: string;
}

interface AutoCommitConfig {
  enabled: boolean;
  interval: number; // minutes
  message: string;
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
  gitConfig: GitConfig;
  autoCommitConfig: AutoCommitConfig;

  initialize: () => Promise<void>;
  loadFiles: () => Promise<void>;
  createNewFile: (name: string) => Promise<void>;
  setCurrentFile: (file: FileInfo) => Promise<void>;
  updateElements: (elements: ExcalidrawElement[]) => Promise<void>;
  setTheme: (theme: Theme) => Promise<void>;
  toggleTheme: () => void;
  initializeGit: () => Promise<void>;
  commitChanges: (message: string) => Promise<void>;
  getFileHistory: () => Promise<FileHistoryEntry[]>;
  restoreVersion: (commitId: string) => Promise<void>;
  renameFile: (file: FileInfo, newName: string) => Promise<void>;
  deleteFile: (file: FileInfo) => Promise<void>;
  createFolder: (name: string, parentPath?: string) => Promise<void>;
  moveFile: (file: FileInfo, targetFolderPath: string | null) => Promise<void>;
  updateGitConfig: (config: GitConfig) => Promise<void>;
  updateAutoCommitConfig: (config: AutoCommitConfig) => Promise<void>;
  testGitConnection: (config: GitConfig) => Promise<boolean>;
}

export const directoryName = "excalidraw-local";

async function processEntriesRecursively(
  parent: string,
  dirEntries: DirEntry[],
  files: FileInfo[]
) {
  for (const entry of dirEntries) {
    if (entry.name.startsWith(".") || entry.name === "settings.json") {
      continue; // Skip hidden files
    }
    // Add the current entry to the entries array
    files.push({
      name: entry.name || "",
      path: `${parent}/${entry.name}`,
      isFolder: entry.isDirectory,
      parentPath: parent,
    });

    if (entry.isDirectory) {
      const dir = await join(parent, entry.name);
      const subEntries = await readDir(dir, { baseDir: BaseDirectory.AppData });
      await processEntriesRecursively(dir, subEntries, files);
    }
  }
}

async function saveSettings(settings: any) {
  try {
    const settingsPath = await join(directoryName, "settings.json");
    await writeTextFile(settingsPath, JSON.stringify(settings, null, 2), {
      baseDir: BaseDirectory.AppData,
    });
  } catch (error) {
    console.error("Failed to save settings:", error);
    throw error;
  }
}

export const useStore = create<AppState>((set, get) => ({
  files: [],
  currentFile: null,
  elements: [],
  appReady: false,
  basePath: "",
  theme: "light",
  pendingChanges: false,
  lastCommitTime: Date.now(),
  gitConfig: {
    remoteUrl: "",
    username: "",
    email: "",
  },
  autoCommitConfig: {
    enabled: false,
    interval: 10, // default 10 minutes
    message: "Updated drawing",
  },
  setTheme: async (theme) => {
    set({ theme });

    await saveSettings({
      gitConfig: get().gitConfig,
      autoCommitConfig: get().autoCommitConfig,
      theme,
    });
  },

  toggleTheme: async () => {
    const newTheme = get().theme === "light" ? "dark" : "light";
    set({ theme: newTheme });

    await saveSettings({
      gitConfig: get().gitConfig,
      autoCommitConfig: get().autoCommitConfig,
      theme: newTheme,
    });
  },

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

      // Load saved settings if they exist
      try {
        const settingsPath = await join(directoryName, "settings.json");
        const settingsContent = await readTextFile(settingsPath, {
          baseDir: BaseDirectory.AppData,
        });
        const settings = JSON.parse(settingsContent);

        set({
          gitConfig: settings.gitConfig || get().gitConfig,
          autoCommitConfig: settings.autoCommitConfig || get().autoCommitConfig,
          theme: settings.theme || get().theme,
        });
      } catch (error) {
        // Settings file might not exist yet, using defaults
        console.log("Using default settings:", error);
      }

      set({ appReady: true });

      await get().loadFiles();
    } catch (error) {
      console.error("Failed to initialize:", error);
    }
  },

  loadFiles: async () => {
    try {
      const files: FileInfo[] = [];
      const entriesFirst = await readDir(directoryName, {
        baseDir: BaseDirectory.AppData,
      });
      await processEntriesRecursively(directoryName, entriesFirst, files);

      set({ files: files });
    } catch (error) {
      console.error("Failed to load files:", error);
    }
  },

  createFolder: async (name: string, parentPath?: string) => {
    try {
      const folderPath = parentPath
        ? `${parentPath}/${name}`
        : `${directoryName}/${name}`;

      // Check if a folder with this name already exists
      const folderExists = get().files.some(
        (file) =>
          file.isFolder &&
          file.parentPath === (parentPath || directoryName) &&
          file.name.toLowerCase() === name.toLowerCase()
      );

      if (folderExists) {
        throw new Error(
          `A folder named "${name}" already exists at this location`
        );
      }

      await mkdir(folderPath, {
        baseDir: BaseDirectory.AppData,
        recursive: true,
      });

      const newFolder: FileInfo = {
        name,
        path: folderPath,
        isFolder: true,
        parentPath: parentPath || directoryName,
      };

      // Update files list with the new folder and trigger state refresh
      set((state) => {
        const updatedFiles = [...state.files, newFolder];
        return {
          files: updatedFiles,
        };
      });

      // Force a refresh of the file list to ensure UI is updated
      await get().loadFiles();
    } catch (error) {
      console.error("Failed to create folder:", error);
      throw error;
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

      // Don't allow moving a folder into itself or its subfolder
      if (file.isFolder && targetFolderPath?.startsWith(file.path)) {
        throw new Error("Cannot move a folder into itself or its subfolder");
      }

      // Move the file or folder
      await rename(sourcePath, destinationPath, {
        oldPathBaseDir: BaseDirectory.AppData,
        newPathBaseDir: BaseDirectory.AppData,
      });

      // Update file information in state
      if (file.isFolder) {
        // For folders, we need to update paths of all contained files/folders
        set((state) => {
          const updatedFiles = state.files.map((f) => {
            // If this is the folder being moved or a file/folder inside it
            if (f.path === sourcePath || f.path.startsWith(`${sourcePath}/`)) {
              // Calculate the new path by replacing the beginning part
              const relativePath = f.path.slice(sourcePath.length);
              const newPath = destinationPath + relativePath;

              // Calculate the new parent path
              let newParentPath;
              if (f.path === sourcePath) {
                // The folder itself gets the target as parent
                newParentPath = targetFolderPath || directoryName;
              } else {
                // Items inside need their parent path updated
                const parentRelative = f.parentPath!.slice(sourcePath.length);
                newParentPath = destinationPath + parentRelative;
              }

              return {
                ...f,
                path: newPath,
                parentPath: newParentPath,
              };
            }
            return f;
          });

          // Update current file reference if needed
          const updatedCurrentFile =
            state.currentFile &&
            (state.currentFile.path === sourcePath ||
              state.currentFile.path.startsWith(`${sourcePath}/`))
              ? updatedFiles.find(
                  (f) =>
                    f.path ===
                    state.currentFile!.path.replace(sourcePath, destinationPath)
                )
              : state.currentFile;

          return {
            files: updatedFiles,
            currentFile: updatedCurrentFile,
          };
        });
      } else {
        // Simple case - just a single file
        const updatedFile: FileInfo = {
          ...file,
          path: destinationPath,
          parentPath: targetFolderPath || directoryName,
        };

        set((state) => ({
          files: state.files.map((f) =>
            f.path === sourcePath ? updatedFile : f
          ),
          currentFile:
            state.currentFile?.path === sourcePath
              ? updatedFile
              : state.currentFile,
        }));
      }

      // Commit the move action
      await get().commitChanges(
        `Moved ${file.isFolder ? "folder" : "file"} ${file.name} to ${
          targetFolderPath || "root"
        }`
      );
    } catch (error) {
      console.error("Failed to move file/folder:", error);
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
      const { pendingChanges, currentFile, lastCommitTime, autoCommitConfig } =
        get();
      if (
        autoCommitConfig.enabled &&
        lastCommitTime + 60 * 1000 * autoCommitConfig.interval < Date.now() &&
        pendingChanges &&
        currentFile
      ) {
        set({ lastCommitTime: Date.now(), pendingChanges: false });
        await get().commitChanges(autoCommitConfig.message);
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
      const { currentFile, lastCommitTime, autoCommitConfig } = get();
      if (currentFile) {
        await writeTextFile(currentFile.path, JSON.stringify(elements), {
          baseDir: BaseDirectory.AppData,
        });
        set({ elements, pendingChanges: true });

        // Check if we should auto-commit based on settings
        if (
          autoCommitConfig.enabled &&
          lastCommitTime + 60 * 1000 * autoCommitConfig.interval < Date.now()
        ) {
          set({ lastCommitTime: Date.now(), pendingChanges: false });
          await get().commitChanges(autoCommitConfig.message);
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

  updateGitConfig: async (config: GitConfig) => {
    try {
      set({ gitConfig: config });

      // Update Git config in the repo
      await invoke<string>("update_git_config", {
        username: config.username,
        email: config.email,
      });

      // If remote URL is provided, set it
      if (config.remoteUrl) {
        await invoke<string>("set_git_remote", {
          url: config.remoteUrl,
        });
      }

      // Save settings to disk
      const settingsPath = await join(directoryName, "settings.json");
      const settings = {
        gitConfig: config,
        autoCommitConfig: get().autoCommitConfig,
      };

      await writeTextFile(settingsPath, JSON.stringify(settings, null, 2), {
        baseDir: BaseDirectory.AppData,
      });
    } catch (error) {
      console.error("Failed to update Git config:", error);
      throw error;
    }
  },

  updateAutoCommitConfig: async (config: AutoCommitConfig) => {
    try {
      set({ autoCommitConfig: config });

      // Save settings to disk
      const settingsPath = await join(directoryName, "settings.json");
      const settings = {
        gitConfig: get().gitConfig,
        autoCommitConfig: config,
      };

      await writeTextFile(settingsPath, JSON.stringify(settings, null, 2), {
        baseDir: BaseDirectory.AppData,
      });

      // Update the commit timer based on new settings
      const { pendingChanges, currentFile } = get();

      // If auto-commit is enabled and we have pending changes,
      // we should reset the timer based on the new interval
      if (config.enabled && pendingChanges && currentFile) {
        set({
          lastCommitTime: Date.now() - 60 * 1000 * config.interval + 60 * 1000,
        });
      }
    } catch (error) {
      console.error("Failed to update auto-commit config:", error);
      throw error;
    }
  },

  testGitConnection: async (config: GitConfig) => {
    try {
      if (!config.remoteUrl) {
        throw new Error("No remote URL provided");
      }

      // Test the Git connection
      const result = await invoke<boolean>("test_git_connection", {
        url: config.remoteUrl,
        username: config.username,
        email: config.email,
      });

      return result;
    } catch (error) {
      console.error("Failed to test Git connection:", error);
      throw error;
    }
  },
}));
