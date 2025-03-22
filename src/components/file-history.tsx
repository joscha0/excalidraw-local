import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface FileHistoryEntry {
  commit_id: string;
  message: string;
  timestamp: number;
  author: string;
}

export function FileHistory({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { currentFile, getFileHistory, restoreVersion } = useStore();
  const [history, setHistory] = useState<FileHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && currentFile) {
      loadHistory();
    }
  }, [open, currentFile]);

  const loadHistory = async () => {
    setLoading(true);
    const entries = await getFileHistory();
    setHistory(entries);
    setLoading(false);
  };

  const handleRestore = async (commitId: string) => {
    setLoading(true);
    await restoreVersion(commitId);
    onClose();
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>File History: {currentFile?.name}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-4 text-center">Loading history...</div>
        ) : (
          <div className="py-4">
            {history.length === 0 ? (
              <div className="text-center text-muted-foreground">
                No history found for this file
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {history.map((entry) => (
                  <div key={entry.commit_id} className="border rounded-md p-3">
                    <div className="flex justify-between">
                      <div className="font-medium">{entry.message}</div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(entry.timestamp * 1000).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-sm mt-1 text-muted-foreground">
                      Author: {entry.author}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => handleRestore(entry.commit_id)}
                    >
                      Restore this version
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
