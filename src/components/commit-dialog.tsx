import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { useStore } from "@/lib/store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Checkbox } from "./ui/checkbox";

interface CommitDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CommitDialog({ open, onClose }: CommitDialogProps) {
  const { commitChanges, pendingChanges, currentFile } = useStore();
  const [commitMessage, setCommitMessage] = useState<string>("");
  const [selectedFiles, setSelectedFiles] = useState<{
    [key: string]: boolean;
  }>({});
  const [isCommitting, setIsCommitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setCommitMessage("");
      setError(null);

      // Initialize with current file if it has pending changes
      const initialSelection: { [key: string]: boolean } = {};
      if (pendingChanges && currentFile) {
        initialSelection[currentFile.path] = true;
      }
      setSelectedFiles(initialSelection);
    }
  }, [open, currentFile, pendingChanges]);

  const handleCommit = async () => {
    if (!commitMessage.trim()) {
      setError("Please enter a commit message");
      return;
    }

    // Check if at least one file is selected
    const hasSelectedFiles = Object.values(selectedFiles).some(
      (selected) => selected
    );
    if (!hasSelectedFiles) {
      return;
    }

    setIsCommitting(true);
    setError(null);

    try {
      await commitChanges(commitMessage);
      onClose();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setIsCommitting(false);
    }
  };

  const toggleFileSelection = (path: string) => {
    setSelectedFiles((prev) => ({
      ...prev,
      [path]: !prev[path],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Commit Changes</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="commit-message">Commit Message</Label>
            <Input
              id="commit-message"
              placeholder="Describe your changes"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
            />
          </div>

          {pendingChanges && currentFile ? (
            <div className="grid gap-2">
              <Label>Files to Commit</Label>
              <div className="max-h-[200px] overflow-y-auto border rounded p-2">
                <div
                  className="flex items-center space-x-2"
                  key={currentFile.path}
                >
                  <Checkbox
                    id={currentFile.path}
                    checked={selectedFiles[currentFile.path] || false}
                    onCheckedChange={() =>
                      toggleFileSelection(currentFile.path)
                    }
                  />
                  <Label htmlFor={currentFile.path} className="cursor-pointer">
                    {currentFile.name} (current file)
                  </Label>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              No pending changes to commit
            </div>
          )}

          {error && <div className="text-sm text-red-500 mt-1">{error}</div>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleCommit}
            disabled={
              isCommitting ||
              !pendingChanges ||
              !Object.values(selectedFiles).some((selected) => selected)
            }
          >
            {isCommitting ? "Committing..." : "Commit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
