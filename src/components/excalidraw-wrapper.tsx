import { useCallback } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { useStore } from "@/lib/store";

export function ExcalidrawWrapper() {
  const { elements, currentFile, updateElements } = useStore();

  const onChangeHandler = useCallback(
    (elements: readonly ExcalidrawElement[]) => {
      // Only update if we have a file selected
      if (currentFile) {
        // Convert readonly array to regular array for storage
        updateElements([...elements]);
      }
    },
    [currentFile, updateElements]
  );

  // If no file is selected, show placeholder
  if (!currentFile) {
    return (
      <div className="flex items-center justify-center h-full bg-muted/30">
        <div className="text-center max-w-md p-8">
          <h3 className="text-xl font-medium mb-2">No Drawing Selected</h3>
          <p className="text-muted-foreground">
            Select a drawing from the sidebar or create a new one to get
            started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <Excalidraw
        initialData={{
          elements: elements,
          appState: {
            viewBackgroundColor: "#ffffff",
          },
        }}
        onChange={onChangeHandler}
        UIOptions={{
          canvasActions: {
            loadScene: false,
            saveToActiveFile: false,
            saveAsImage: true,
          },
        }}
      />
    </div>
  );
}
