import { createFileRoute, Link, useNavigate } from "@richie-router/react";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { api, queryClient } from "../../api";
import { useAuthSession } from "../../auth-client";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  IconUpload,
  IconFile,
  IconFileTypePdf,
  IconFileTypeDoc,
  IconPhoto,
  IconTrash,
  IconArrowLeft,
  IconLoader2,
  IconFolder,
  IconChevronRight,
  IconClock,
  IconCheck,
  IconAlertCircle,
  IconDotsVertical,
  IconSearch,
  IconArrowUp,
  IconArrowDown,
  IconChevronLeft,
} from "@tabler/icons-react";
import env from "@/env";

export const Route = createFileRoute("/knowledge-base/")({
  component: KnowledgeBasePage,
});

// Format file size for display
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

// Get icon for file type
function FileIcon({ type }: { type: string }) {
  if (type === "application/pdf") {
    return <IconFileTypePdf size={20} className="text-destructive" />;
  }
  if (type.includes("wordprocessingml") || type.includes("msword")) {
    return <IconFileTypeDoc size={20} className="text-primary" />;
  }
  if (type.startsWith("image/")) {
    return <IconPhoto size={20} className="text-accent-foreground" />;
  }
  return <IconFile size={20} className="text-muted-foreground" />;
}

// Status badge component
function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "pending":
      return (
        <Badge variant="secondary" className="gap-1">
          <IconClock size={12} />
          Queued
        </Badge>
      );
    case "processing":
      return (
        <Badge variant="default" className="gap-1 bg-primary/80">
          <IconLoader2 size={12} className="animate-spin" />
          Indexing
        </Badge>
      );
    case "indexed":
      return (
        <Badge variant="secondary" className="gap-1 bg-accent text-accent-foreground">
          <IconCheck size={12} />
          Ready
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive" className="gap-1">
          <IconAlertCircle size={12} />
          Failed
        </Badge>
      );
    default:
      return null;
  }
}

// Get display name from path (last segment)
function getDisplayName(fileName: string): string {
  const parts = fileName.split("/");
  return parts[parts.length - 1] ?? fileName;
}

// Get friendly file type name
function getFriendlyFileType(mimeType: string): string {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType.includes("wordprocessingml") || mimeType.includes("msword")) return "Word";
  if (mimeType.startsWith("image/")) return mimeType.replace("image/", "").toUpperCase();
  if (mimeType === "text/plain") return "Text";
  if (mimeType === "text/markdown") return "Markdown";
  return mimeType.split("/").pop()?.toUpperCase() || "File";
}

// Format relative date
function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return diffMins <= 1 ? "Just now" : `${diffMins} mins ago`;
    }
    return diffHours === 1 ? "1 hour ago" : `${diffHours} hours ago`;
  }
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type SortField = "fileName" | "fileSize" | "createdAt" | "status";
type SortDirection = "asc" | "desc";

function KnowledgeBasePage() {
  const { session, status, isInitialLoad } = useAuthSession();
  const navigate = useNavigate();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [currentFolder, setCurrentFolder] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  // Fetch documents with polling for processing files
  const {
    data: documentsData,
    isLoading,
    refetch,
  } = api.listDocuments.useQuery({
    queryKey: ["listDocuments"],
    queryData: {},
    enabled: status === "authenticated",
    refetchInterval: (query) => {
      // Poll every 2s if any documents are processing
      const docs = query.state.data?.payload ?? [];
      const hasProcessing = docs.some((d: { status: string }) => d.status === "pending" || d.status === "processing");
      return hasProcessing ? 2000 : false;
    },
  });

  const deleteDocument = api.deleteDocument.useMutation();

  const documents = useMemo(() => documentsData?.payload ?? [], [documentsData?.payload]);

  // Extract folders and filter items to current folder
  const { folders, files } = useMemo(() => {
    const folderSet = new Set<string>();
    const currentFiles: typeof documents = [];

    for (const doc of documents) {
      const parts = doc.fileName.split("/");
      const docFolder = parts.length > 1 ? parts.slice(0, -1).join("/") : "";

      // Add all parent folders
      for (let i = 1; i < parts.length; i++) {
        folderSet.add(parts.slice(0, i).join("/"));
      }

      // Include file if in current folder
      if (docFolder === currentFolder) {
        currentFiles.push(doc);
      }
    }

    // Get direct child folders of current folder
    const prefix = currentFolder ? currentFolder + "/" : "";
    const childFolders = [...folderSet].filter((f) => {
      if (!f.startsWith(prefix)) return false;
      const remainder = f.slice(prefix.length);
      return !remainder.includes("/");
    });

    return { folders: childFolders.sort(), files: currentFiles };
  }, [documents, currentFolder]);

  // Apply search, filter, and sort to files
  const processedFiles = useMemo(() => {
    let result = [...files];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((doc) =>
        getDisplayName(doc.fileName).toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (statusFilter !== "all") {
      result = result.filter((doc) => doc.status === statusFilter);
    }

    // Apply sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "fileName":
          comparison = getDisplayName(a.fileName).localeCompare(getDisplayName(b.fileName));
          break;
        case "fileSize":
          comparison = a.fileSize - b.fileSize;
          break;
        case "createdAt":
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case "status":
          comparison = a.status.localeCompare(b.status);
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return result;
  }, [files, searchQuery, statusFilter, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(processedFiles.length / itemsPerPage);
  const paginatedFiles = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return processedFiles.slice(start, start + itemsPerPage);
  }, [processedFiles, currentPage, itemsPerPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, sortField, sortDirection, currentFolder]);

  // Breadcrumb segments
  const breadcrumbs = useMemo(() => {
    if (!currentFolder) return [];
    return currentFolder.split("/");
  }, [currentFolder]);

  // Sort handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  // Sort icon helper
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? (
      <IconArrowUp size={14} className="ml-1" />
    ) : (
      <IconArrowDown size={14} className="ml-1" />
    );
  };

  // Upload files function (supports multiple files)
  const uploadFiles = useCallback(
    async (fileList: FileList) => {
      setIsUploading(true);
      setUploadError(null);

      try {
        const formData = new FormData();
        for (const file of fileList) {
          formData.append("files", file);
        }

        const response = await fetch(`${env.BASE_URL}/api/knowledge-base/upload`, {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Upload failed");
        }

        const result = await response.json();

        // Show errors for files that failed validation
        if (result.errors && result.errors.length > 0) {
          setUploadError(result.errors.map((e: { fileName: string; error: string }) => `${e.fileName}: ${e.error}`).join("\n"));
        }

        // Refresh document list
        await refetch();
        queryClient.invalidateQueries({ queryKey: ["listDocuments"] });
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : "Upload failed");
      } finally {
        setIsUploading(false);
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [refetch]
  );

  // Handle file selection from input
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    await uploadFiles(files);
  };

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer?.types.includes("Files")) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      dragCounterRef.current = 0;

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        uploadFiles(files);
      }
    },
    [uploadFiles]
  );

  // Set up global drag/drop event listeners
  useEffect(() => {
    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
    };
  }, [handleDragEnter, handleDragLeave, handleDragOver, handleDrop]);

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    await deleteDocument.mutateAsync({ params: { id: deleteId } });
    await refetch();
    setDeleteId(null);
  };

  // Navigate to folder
  const navigateToFolder = (folder: string) => {
    setCurrentFolder(folder);
  };

  // Navigate up one level
  const navigateUp = () => {
    const parts = currentFolder.split("/");
    parts.pop();
    setCurrentFolder(parts.join("/"));
  };

  // Navigate to breadcrumb
  const navigateToBreadcrumb = (index: number) => {
    const parts = currentFolder.split("/").slice(0, index + 1);
    setCurrentFolder(parts.join("/"));
  };

  if (isInitialLoad) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <IconLoader2 size={32} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Please sign in to access the knowledge base</p>
          <Link to="/">
            <Button>Sign In</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link to="/chat" className="text-muted-foreground hover:text-foreground transition-colors">
            <IconArrowLeft size={20} />
          </Link>
          <h1 className="text-xl font-semibold text-foreground">Knowledge Base</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Upload Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Upload Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                isUploading
                  ? "border-primary bg-primary/5"
                  : isDragging
                    ? "border-primary bg-primary/10 scale-[1.02]"
                    : "border-border hover:border-muted-foreground"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
                disabled={isUploading}
                multiple
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                {isUploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <IconLoader2 size={40} className="animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Uploading files...</p>
                  </div>
                ) : isDragging ? (
                  <div className="flex flex-col items-center gap-2">
                    <IconUpload size={40} className="text-primary animate-bounce" />
                    <p className="text-primary font-medium">Drop files here to upload</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <IconUpload size={40} className="text-muted-foreground" />
                    <p className="text-foreground font-medium">Click or drag files to upload</p>
                    <p className="text-sm text-muted-foreground">
                      Supports PDF, DOCX, TXT, MD, PNG, JPG, WEBP (max 10MB each)
                    </p>
                  </div>
                )}
              </label>
            </div>
            {uploadError && (
              <p className="mt-4 text-sm text-destructive bg-destructive/10 p-3 rounded-lg whitespace-pre-wrap">
                {uploadError}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Documents Section */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Your Documents</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Breadcrumb Navigation */}
            {(currentFolder || breadcrumbs.length > 0) && (
              <div className="flex items-center gap-1 mb-4 text-sm">
                <button
                  onClick={() => setCurrentFolder("")}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  All Files
                </button>
                {breadcrumbs.map((segment, index) => (
                  <span key={index} className="flex items-center gap-1">
                    <IconChevronRight size={14} className="text-muted-foreground" />
                    <button
                      onClick={() => navigateToBreadcrumb(index)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {segment}
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Search and Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="indexed">Ready</SelectItem>
                  <SelectItem value="processing">Indexing</SelectItem>
                  <SelectItem value="pending">Queued</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <IconLoader2 size={32} className="animate-spin text-muted-foreground" />
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-12">
                <IconFile size={48} className="mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No documents yet</p>
                <p className="text-sm text-muted-foreground">Upload documents to build your knowledge base</p>
              </div>
            ) : folders.length === 0 && processedFiles.length === 0 ? (
              <div className="text-center py-12">
                {searchQuery || statusFilter !== "all" ? (
                  <>
                    <IconSearch size={48} className="mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">No files match your search</p>
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setStatusFilter("all");
                      }}
                      className="text-sm text-primary hover:underline mt-2"
                    >
                      Clear filters
                    </button>
                  </>
                ) : (
                  <>
                    <IconFolder size={48} className="mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">This folder is empty</p>
                    <button onClick={navigateUp} className="text-sm text-primary hover:underline mt-2">
                      Go back
                    </button>
                  </>
                )}
              </div>
            ) : (
              <>
                {/* Folders (shown above table) */}
                {(currentFolder || folders.length > 0) && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {currentFolder && (
                      <button
                        onClick={navigateUp}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:bg-accent/50 transition-colors text-sm"
                      >
                        <IconFolder size={18} className="text-muted-foreground" />
                        <span className="font-medium text-foreground">..</span>
                      </button>
                    )}
                    {folders.map((folder) => {
                      const folderName = folder.split("/").pop() || folder;
                      return (
                        <button
                          key={folder}
                          onClick={() => navigateToFolder(folder)}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:bg-accent/50 transition-colors text-sm"
                        >
                          <IconFolder size={18} className="text-amber-500" />
                          <span className="font-medium text-foreground">{folderName}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Files Table */}
                {paginatedFiles.length > 0 && (
                  <div className="border border-border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableHead
                            className="cursor-pointer hover:text-foreground transition-colors"
                            onClick={() => handleSort("fileName")}
                          >
                            <div className="flex items-center">
                              Name
                              <SortIcon field="fileName" />
                            </div>
                          </TableHead>
                          <TableHead className="w-[100px]">Type</TableHead>
                          <TableHead
                            className="w-[100px] cursor-pointer hover:text-foreground transition-colors"
                            onClick={() => handleSort("fileSize")}
                          >
                            <div className="flex items-center">
                              Size
                              <SortIcon field="fileSize" />
                            </div>
                          </TableHead>
                          <TableHead
                            className="w-[110px] cursor-pointer hover:text-foreground transition-colors"
                            onClick={() => handleSort("status")}
                          >
                            <div className="flex items-center">
                              Status
                              <SortIcon field="status" />
                            </div>
                          </TableHead>
                          <TableHead
                            className="w-[120px] cursor-pointer hover:text-foreground transition-colors"
                            onClick={() => handleSort("createdAt")}
                          >
                            <div className="flex items-center">
                              Uploaded
                              <SortIcon field="createdAt" />
                            </div>
                          </TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedFiles.map((doc) => (
                          <TableRow
                            key={doc.id}
                            className="cursor-pointer"
                            onClick={() => navigate({ to: "/knowledge-base/files/$", params: { _splat: doc.id } })}
                          >
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <FileIcon type={doc.fileType} />
                                <span className="font-medium text-foreground truncate max-w-[300px]">
                                  {getDisplayName(doc.fileName)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {getFriendlyFileType(doc.fileType)}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatFileSize(doc.fileSize)}
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={doc.status} />
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatRelativeDate(doc.createdAt)}
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <IconDotsVertical size={16} />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={(e: React.MouseEvent) => {
                                      e.stopPropagation();
                                      setDeleteId(doc.id);
                                    }}
                                  >
                                    <IconTrash size={16} />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 text-sm">
                    <p className="text-muted-foreground">
                      Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                      {Math.min(currentPage * itemsPerPage, processedFiles.length)} of {processedFiles.length} files
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        <IconChevronLeft size={16} />
                        Previous
                      </Button>
                      <span className="text-muted-foreground px-2">
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Next
                        <IconChevronRight size={16} />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Info Section */}
        <div className="mt-8 text-sm text-muted-foreground">
          <p>
            Documents you upload will be processed and indexed for semantic search. When you chat, the AI will
            automatically search your knowledge base and cite relevant sources in its responses.
          </p>
        </div>
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open: boolean) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this document and all its embeddings from your knowledge base. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className={buttonVariants({ variant: "destructive" })} onClick={handleDeleteConfirm}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
