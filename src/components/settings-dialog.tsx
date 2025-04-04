import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { Settings as SettingsIcon } from "lucide-react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form";
import { Input } from "./ui/input";
import { Switch } from "./ui/switch";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { CopyButton } from "./ui/copy-button";

const gitConfigSchema = z.object({
  remoteUrl: z
    .string()
    .refine(
      (val) => val === "" || val.match(/^git@/) !== null,
      "Please enter a valid SSH Git URL (git@github.com:user/repo.git)"
    ),
  username: z.string(),
  email: z.string().email("Please enter a valid email address"),
  sshKeyPath: z.string().optional(),
});

const autoCommitSchema = z.object({
  enabled: z.boolean(),
  interval: z.string(), // "1", "5", "10", "30", "60" minutes
  message: z.string().min(1, "Commit message cannot be empty"),
});

export function SettingsDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const {
    gitConfig,
    autoCommitConfig,
    updateGitConfig,
    updateAutoCommitConfig,
    testGitConnection,
  } = useStore();
  const [activeTab, setActiveTab] = useState("git");
  const [connectionStatus, setConnectionStatus] = useState<
    "idle" | "testing" | "success" | "error"
  >("idle");
  const [connectionMessage, setConnectionMessage] = useState("");

  const gitForm = useForm<z.infer<typeof gitConfigSchema>>({
    resolver: zodResolver(gitConfigSchema),
    defaultValues: {
      remoteUrl: gitConfig.remoteUrl || "",
      username: gitConfig.username || "",
      email: gitConfig.email || "",
      sshKeyPath: gitConfig.sshKeyPath || "",
    },
  });

  const autoCommitForm = useForm<z.infer<typeof autoCommitSchema>>({
    resolver: zodResolver(autoCommitSchema),
    defaultValues: {
      enabled: autoCommitConfig.enabled,
      interval: autoCommitConfig.interval.toString(),
      message: autoCommitConfig.message,
    },
  });

  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [sshPublicKey, setSshPublicKey] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      // Reset forms when dialog opens
      gitForm.reset({
        remoteUrl: gitConfig.remoteUrl || "",
        username: gitConfig.username || "",
        email: gitConfig.email || "",
        sshKeyPath: gitConfig.sshKeyPath || "",
      });

      autoCommitForm.reset({
        enabled: autoCommitConfig.enabled,
        interval: autoCommitConfig.interval.toString(),
        message: autoCommitConfig.message,
      });

      setConnectionStatus("idle");
      setConnectionMessage("");
    }
  }, [open, gitConfig, autoCommitConfig]);

  const onGitSubmit = async (values: z.infer<typeof gitConfigSchema>) => {
    await updateGitConfig(values);
    onClose();
  };

  const onAutoCommitSubmit = async (
    values: z.infer<typeof autoCommitSchema>
  ) => {
    await updateAutoCommitConfig({
      ...values,
      interval: parseInt(values.interval),
    });
    onClose();
  };

  const handleTestConnection = async () => {
    setConnectionStatus("testing");
    setConnectionMessage("Testing connection...");

    try {
      await testGitConnection(gitForm.getValues());
      setConnectionStatus("success");
      setConnectionMessage("Connection successful!");
    } catch (error) {
      setConnectionStatus("error");
      setConnectionMessage(`Connection failed: ${(error as Error).message}`);
    }
  };

  const handleGenerateSSHKey = async () => {
    try {
      setIsGeneratingKey(true);
      const email = gitForm.getValues().email;
      if (!email) {
        gitForm.setError("email", {
          message: "Email is required to generate an SSH key",
        });
        setIsGeneratingKey(false);
        return;
      }
      const { publicKey, keyPath } = await useStore
        .getState()
        .generateSshKey(email);
      gitForm.setValue("sshKeyPath", keyPath);
      setSshPublicKey(publicKey);
      setIsGeneratingKey(false);
    } catch (error) {
      setIsGeneratingKey(false);
      console.error("Failed to generate SSH key:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" />
            Settings
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="git">Git Configuration</TabsTrigger>
            <TabsTrigger value="autoCommit">Auto-Commit Rules</TabsTrigger>
          </TabsList>

          <TabsContent value="git" className="space-y-4 py-4">
            <Form {...gitForm}>
              <form
                onSubmit={gitForm.handleSubmit(onGitSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={gitForm.control}
                  name="remoteUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Git Remote URL</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="git@github.com:user/repo.git"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Your Git repository remote URL (leave empty for
                        local-only)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={gitForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Git Username</FormLabel>
                      <FormControl>
                        <Input placeholder="Your Name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={gitForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Git Email</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="your.email@example.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={gitForm.control}
                  name="sshKeyPath"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SSH Key Path</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input
                            disabled
                            placeholder="~/.ssh/id_ed25519"
                            {...field}
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleGenerateSSHKey}
                          disabled={isGeneratingKey}
                        >
                          {isGeneratingKey ? "Generating..." : "Generate"}
                        </Button>
                      </div>
                      <FormDescription>
                        Path to your SSH private key for GitHub authentication
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {sshPublicKey && (
                  <div className="p-2 bg-muted rounded-md">
                    <p className="text-sm font-medium mb-1">
                      Generated Public Key:
                    </p>

                    <div className="relative">
                      <pre className="text-xs overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-all p-2 pb-8 bg-background rounded border">
                        {sshPublicKey}
                      </pre>
                      <div className="absolute bottom-2 right-2">
                        <CopyButton value={sshPublicKey} />
                      </div>
                    </div>
                    <p className="text-xs mt-2">
                      Add this as a deploy key in your GitHub repository
                      settings
                    </p>
                  </div>
                )}

                {gitForm.watch("remoteUrl") && (
                  <div className="flex flex-col gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleTestConnection}
                      disabled={connectionStatus === "testing"}
                    >
                      Test Connection
                    </Button>

                    {connectionStatus !== "idle" && (
                      <div
                        className={`p-2 text-sm rounded ${
                          connectionStatus === "testing"
                            ? "bg-muted"
                            : connectionStatus === "success"
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                            : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
                        }`}
                      >
                        {connectionMessage}
                      </div>
                    )}
                  </div>
                )}

                <DialogFooter>
                  <Button type="submit">Save Git Settings</Button>
                </DialogFooter>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="autoCommit" className="space-y-4 py-4">
            <Form {...autoCommitForm}>
              <form
                onSubmit={autoCommitForm.handleSubmit(onAutoCommitSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={autoCommitForm.control}
                  name="enabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Enable Auto-Commit</FormLabel>
                        <FormDescription>
                          Automatically commit changes after a set interval
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {autoCommitForm.watch("enabled") && (
                  <>
                    <FormField
                      control={autoCommitForm.control}
                      name="interval"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Commit Interval</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select an interval" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="1">Every 1 minute</SelectItem>
                              <SelectItem value="5">Every 5 minutes</SelectItem>
                              <SelectItem value="10">
                                Every 10 minutes
                              </SelectItem>
                              <SelectItem value="30">
                                Every 30 minutes
                              </SelectItem>
                              <SelectItem value="60">Every hour</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={autoCommitForm.control}
                      name="message"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Default Commit Message</FormLabel>
                          <FormControl>
                            <Input placeholder="Updated drawing" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                <DialogFooter>
                  <Button type="submit">Save Auto-Commit Settings</Button>
                </DialogFooter>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
