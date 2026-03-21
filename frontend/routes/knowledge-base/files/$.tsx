import { createFileRoute, Link, useNavigate } from "@richie-router/react";
import { api, queryClient } from "../../../api";
import { useAuthSession } from "../../../auth-client";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";
import {
  IconArrowLeft,
  IconLoader2,
  IconFile,
  IconFileTypePdf,
  IconFileTypeDoc,
  IconPhoto,
  IconDownload,
  IconTrash,
  IconClock,
  IconCheck,
  IconAlertCircle,
  IconCopy,
  IconChevronDown,
  IconChevronRight,
  IconFileText,
} from "@tabler/icons-react";

export const Route = createFileRoute("/knowledge-base/files/$")({
  component: FileDetailsPage,
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
function FileIcon({ type, size = 48 }: { type: string; size?: number }) {
  if (type === "application/pdf") {
    return <IconFileTypePdf size={size} className="text-destructive" />;
  }
  if (type.includes("wordprocessingml") || type.includes("msword")) {
    return <IconFileTypeDoc size={size} className="text-primary" />;
  }
  if (type.startsWith("image/")) {
    return <IconPhoto size={size} className="text-accent-foreground" />;
  }
  return <IconFile size={size} className="text-muted-foreground" />;
}

// Document type for successful response
interface Document {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  markdownContent: string | null;
  createdAt: string;
  status: "pending" | "processing" | "indexed" | "failed";
  error: string | null;
  chunksCount: number | null;
}

// Chunk type
interface Chunk {
  id: string;
  content: string;
  blockType: string | null;
  pageNumber: number | null;
}

// Chunk card component
function ChunkCard({ chunk, index, total }: { chunk: Chunk; index: number; total: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const truncatedContent = chunk.content.slice(0, 200);
  const needsTruncation = chunk.content.length > 200;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border border-border rounded-lg overflow-hidden bg-card">
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center gap-3 p-4 hover:bg-accent/30 transition-colors">
            <div className="flex-shrink-0 text-muted-foreground">
              {isOpen ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
            </div>
            <div className="flex items-center gap-2 flex-1 min-w-0 text-left">
              <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
                {index + 1}/{total}
              </span>
              {chunk.blockType && (
                <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded">
                  {chunk.blockType}
                </span>
              )}
              {chunk.pageNumber && (
                <span className="text-xs text-muted-foreground">
                  Page {chunk.pageNumber}
                </span>
              )}
            </div>
          </div>
        </CollapsibleTrigger>
        <div className="px-4 pb-2">
          <p className="text-sm text-muted-foreground line-clamp-2">
            {truncatedContent}
            {needsTruncation && !isOpen && "..."}
          </p>
        </div>
        <CollapsibleContent>
          <div className="px-4 pb-4">
            <div className="bg-muted/50 rounded-lg p-4 mt-2">
              <pre className="whitespace-pre-wrap text-sm text-foreground font-mono">
                {chunk.content}
              </pre>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function FileDetailsPage() {
  const { _splat: docId } = Route.useParams();
  const navigate = useNavigate();
  const { session, status, isInitialLoad } = useAuthSession();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch document with polling while processing
  const { data, isLoading, error } = api.getDocument.useQuery({
    queryKey: ["getDocument", docId ?? ""],
    queryData: { params: { id: docId ?? "" } },
    enabled: status === "authenticated" && !!docId,
    refetchInterval: (query) => {
      const docData = query.state.data?.payload;
      if (docData && (docData.status === "pending" || docData.status === "processing")) {
        return 2000; // Poll every 2s while processing
      }
      return false;
    },
  });

  // Fetch chunks when document is indexed
  const { data: chunksData, isLoading: chunksLoading } = api.getDocumentChunks.useQuery({
    queryKey: ["getDocumentChunks", docId ?? ""],
    queryData: { params: { id: docId ?? "" } },
    enabled: status === "authenticated" && !!docId && data?.payload.status === "indexed",
  });

  const deleteDocument = api.deleteDocument.useMutation();

  const doc: Document | null = data?.payload ?? null;
  const chunks: Chunk[] = chunksData?.payload ?? [];

  // Handle delete
  const handleDelete = async () => {
    if (!docId) return;
    await deleteDocument.mutateAsync({ params: { id: docId } });
    queryClient.invalidateQueries({ queryKey: ["listDocuments"] });
    navigate({ to: "/knowledge-base" });
  };

  // Download markdown as file
  const handleDownload = () => {
    if (!doc?.markdownContent) return;

    const blob = new Blob([doc.markdownContent], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.fileName.replace(/\.[^/.]+$/, "") + ".md";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Copy markdown to clipboard
  const handleCopy = async () => {
    if (!doc?.markdownContent) return;
    await navigator.clipboard.writeText(doc.markdownContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isInitialLoad || isLoading) {
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
          <p className="text-muted-foreground mb-4">Please sign in to view documents</p>
          <Link to="/">
            <Button>Sign In</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card">
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
            <Link to="/knowledge-base" className="text-muted-foreground hover:text-foreground transition-colors">
              <IconArrowLeft size={20} />
            </Link>
            <h1 className="text-xl font-semibold text-foreground">Document Not Found</h1>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-6 py-8">
          <Card>
            <CardContent className="py-12 text-center">
              <IconFile size={48} className="mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">This document could not be found</p>
              <Link to="/knowledge-base" className="text-primary hover:underline text-sm mt-2 inline-block">
                Back to Knowledge Base
              </Link>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Status card component
  const StatusCard = () => {
    if (doc.status === "pending") {
      return (
        <Card className="bg-muted/30 border-muted">
          <CardContent className="flex items-center gap-4 py-5 px-6">
            <div className="p-2.5 rounded-full bg-muted">
              <IconClock size={22} className="text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-foreground">Queued for processing</p>
              <p className="text-sm text-muted-foreground">Document is waiting to be indexed</p>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (doc.status === "processing") {
      return (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="flex items-center gap-4 py-5 px-6">
            <div className="p-2.5 rounded-full bg-primary/10">
              <IconLoader2 size={22} className="text-primary animate-spin" />
            </div>
            <div>
              <p className="font-medium text-primary">Indexing document...</p>
              <p className="text-sm text-muted-foreground">Extracting content and generating embeddings</p>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (doc.status === "failed") {
      return (
        <Card className="bg-destructive/5 border-destructive/20">
          <CardContent className="flex items-center gap-4 py-5 px-6">
            <div className="p-2.5 rounded-full bg-destructive/10">
              <IconAlertCircle size={22} className="text-destructive" />
            </div>
            <div>
              <p className="font-medium text-destructive">Indexing failed</p>
              <p className="text-sm text-muted-foreground">{doc.error || "An error occurred during processing"}</p>
            </div>
          </CardContent>
        </Card>
      );
    }

    // Indexed - use accent colors for success state
    return (
      <Card className="bg-accent/30 border-accent/50 dark:bg-accent/10 dark:border-accent/30">
        <CardContent className="flex items-center gap-4 py-5 px-6">
          <div className="p-2.5 rounded-full bg-accent dark:bg-accent/30">
            <IconCheck size={22} className="text-accent-foreground dark:text-accent-foreground" />
          </div>
          <div>
            <p className="font-medium text-accent-foreground">Indexed successfully</p>
            <p className="text-sm text-muted-foreground">{doc.chunksCount} chunks created for semantic search</p>
          </div>
        </CardContent>
      </Card>
    );
  };

  const canPreview = doc.status === "indexed" && doc.markdownContent;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link to="/knowledge-base" className="text-muted-foreground hover:text-foreground transition-colors">
            <IconArrowLeft size={20} />
          </Link>
          <h1 className="text-xl font-semibold text-foreground truncate flex-1">{doc.fileName}</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* File Info Card */}
        <Card>
          <CardContent className="py-8 px-6">
            <div className="flex items-start gap-6">
              <div className="flex-shrink-0">
                <FileIcon type={doc.fileType} size={56} />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold text-foreground truncate mb-3">{doc.fileName}</h2>
                <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <dt className="text-muted-foreground mb-0.5">Size</dt>
                    <dd className="font-medium text-foreground">{formatFileSize(doc.fileSize)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground mb-0.5">Type</dt>
                    <dd className="font-medium text-foreground truncate">{doc.fileType}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground mb-0.5">Uploaded</dt>
                    <dd className="font-medium text-foreground">
                      {new Date(doc.createdAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  disabled={!canPreview}
                  title={canPreview ? "Download as Markdown" : "Document not yet indexed"}
                >
                  <IconDownload size={16} className="mr-1.5" />
                  Download
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(true)}>
                  <IconTrash size={16} className="mr-1.5" />
                  Delete
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status Card */}
        <StatusCard />

        {/* Content Preview */}
        {canPreview && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-lg">Document Content</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="text-muted-foreground hover:text-foreground"
              >
                <IconCopy size={16} className="mr-1.5" />
                {copied ? "Copied!" : "Copy"}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <div className="bg-muted/30 border border-border rounded-lg p-5 overflow-auto max-h-[500px] scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                  <pre className="whitespace-pre-wrap text-sm text-foreground font-mono leading-relaxed">
                    {doc.markdownContent}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Chunks Section */}
        {doc.status === "indexed" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <IconFileText size={20} />
                Document Chunks
                {chunks.length > 0 && (
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    ({chunks.length} chunks)
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {chunksLoading ? (
                <div className="flex items-center justify-center py-8">
                  <IconLoader2 size={24} className="animate-spin text-muted-foreground" />
                </div>
              ) : chunks.length === 0 ? (
                <div className="text-center py-8">
                  <IconFileText size={32} className="mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-muted-foreground text-sm">No chunks found for this document</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {chunks.map((chunk, index) => (
                    <ChunkCard key={chunk.id} chunk={chunk} index={index} total={chunks.length} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Waiting for content message */}
        {(doc.status === "pending" || doc.status === "processing") && (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center">
              <IconLoader2 size={32} className="mx-auto text-muted-foreground animate-spin mb-4" />
              <p className="text-muted-foreground">Content preview will be available after indexing completes</p>
            </CardContent>
          </Card>
        )}

        {/* Failed message */}
        {doc.status === "failed" && (
          <Card className="border-dashed border-destructive/30">
            <CardContent className="py-10 text-center">
              <IconAlertCircle size={32} className="mx-auto text-destructive/50 mb-4" />
              <p className="text-muted-foreground">Content could not be extracted from this document</p>
              <p className="text-sm text-destructive mt-2">{doc.error}</p>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{doc.fileName}" and all its embeddings from your knowledge base. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className={buttonVariants({ variant: "destructive" })} onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
