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

interface CommitDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CommitDialog({ open, onClose }: CommitDialogProps) {
  const { commitChanges, pendingChanges } = useStore();
  const [commitMessage, setCommitMessage] = useState<string>("");
  const [isCommitting, setIsCommitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setCommitMessage("");
      setError(null);
    }
  }, [open]);

  const handleCommit = async () => {
    if (!commitMessage.trim()) {
      setError("Please enter a commit message");
      return;
    }

    if (!pendingChanges) {
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Commit All Changes</DialogTitle>
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

          {pendingChanges ? (
            <div className="text-sm">
              All pending changes will be committed to the repository.
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
            disabled={isCommitting || !pendingChanges}
          >
            {isCommitting ? "Committing..." : "Commit All Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
