"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import {
  Pin,
  PinOff,
  Trash2,
  Pencil,
  Check,
  X,
  Send,
  ChevronRight,
  Share2,
  Palette,
  Users,
  UserPlus,
  Search,
  Loader2,
  Crown,
  Eye,
  Edit3,
  Image,
  Download,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { RichTextEditor } from "./rich-text-editor";
import { formatRelative } from "./format-relative";
import {
  type NoteItem,
  type NoteColor,
  type NoteAttachmentItem,
  type NoteCommentItem,
  type SearchUserItem,
  searchUsers,
} from "@/actions/notes";
import { toast } from "react-toastify";

const COLOR_PALETTE: { key: NoteColor; label: string; class: string }[] = [
  { key: "DEFAULT", label: "Slate", class: "bg-slate-400" },
  { key: "RED", label: "Red", class: "bg-red-400" },
  { key: "ORANGE", label: "Orange", class: "bg-orange-400" },
  { key: "YELLOW", label: "Amber", class: "bg-amber-400" },
  { key: "GREEN", label: "Green", class: "bg-emerald-400" },
  { key: "BLUE", label: "Blue", class: "bg-blue-400" },
  { key: "PURPLE", label: "Purple", class: "bg-violet-400" },
  { key: "PINK", label: "Pink", class: "bg-pink-400" },
];

const colorMeta: Record<NoteColor, { class: string; tint: string }> = {
  DEFAULT: { class: "bg-slate-400", tint: "bg-slate-50 dark:bg-slate-900/20" },
  RED: { class: "bg-red-400", tint: "bg-red-50 dark:bg-red-950/20" },
  ORANGE: {
    class: "bg-orange-400",
    tint: "bg-orange-50 dark:bg-orange-950/20",
  },
  YELLOW: { class: "bg-amber-400", tint: "bg-amber-50 dark:bg-amber-950/20" },
  GREEN: {
    class: "bg-emerald-400",
    tint: "bg-emerald-50 dark:bg-emerald-950/20",
  },
  BLUE: { class: "bg-blue-400", tint: "bg-blue-50 dark:bg-blue-950/20" },
  PURPLE: {
    class: "bg-violet-400",
    tint: "bg-violet-50 dark:bg-violet-950/20",
  },
  PINK: { class: "bg-pink-400", tint: "bg-pink-50 dark:bg-pink-950/20" },
};

const IMAGE_BG_KEY = "note-bg";
const IMAGE_BG_STYLE: React.CSSProperties = {
  backgroundImage: "url('/note-bg.jpg')",
  backgroundSize: "cover",
  backgroundPosition: "center",
};

function BackgroundPicker({
  current,
  onChange,
}: {
  current: string;
  onChange: (bg: string) => void;
}) {
  const isActive = current === IMAGE_BG_KEY;
  return (
    <button
      onClick={() => onChange(isActive ? "" : IMAGE_BG_KEY)}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-colors",
        isActive
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
      title={isActive ? "Remove background" : "Set background image"}
    >
      <Image size={14} />
      <span className="hidden sm:inline">
        {isActive ? "Remove BG" : "Background"}
      </span>
    </button>
  );
}

interface NoteDetailProps {
  note: NoteItem;
  onUpdate: (
    id: string,
    data: {
      title?: string;
      content?: string;
      isPinned?: boolean;
      color?: NoteColor;
      isRoomNote?: boolean;
      background?: string;
    },
  ) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onAttachmentUploaded: (
    noteId: string,
    attachment: NoteAttachmentItem,
  ) => void | Promise<void>;
  onAttachmentRemoved: (
    noteId: string,
    attachmentId: string,
  ) => void | Promise<void>;
  onCommentAdded: (noteId: string, content: string) => void | Promise<void>;
  onCommentRemoved: (commentId: string) => void | Promise<void>;
  onInviteUser: (
    noteId: string,
    userId: string,
    role?: "EDITOR" | "VIEWER",
  ) => void | Promise<void>;
  onRemoveUser: (noteId: string, userId: string) => void | Promise<void>;
  onAcceptInvite: (inviteId: string) => void | Promise<void>;
  isPending: boolean;
  onDeclineInvite: (inviteId: string) => void | Promise<void>;
}

export function NoteDetail({
  note,
  onUpdate,
  onDelete,
  onAttachmentUploaded,
  onAttachmentRemoved,
  onCommentAdded,
  onCommentRemoved,
  onInviteUser,
  onRemoveUser,
  onAcceptInvite,
  onDeclineInvite,
  isPending,
}: NoteDetailProps) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [exporting, setExporting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(true);
  const [collaboratorsOpen, setCollaboratorsOpen] = useState(false);
  const commentInputRef = useRef<HTMLInputElement>(null);

  const meta = colorMeta[note.color] ?? colorMeta.DEFAULT;

  useEffect(() => {
    if (!editing) {
      setTitle(note.title);
      setContent(note.content);
    }
  }, [note.id, note.title, note.content, editing]);

  const save = async () => {
    await onUpdate(note.id, { title, content });
    setEditing(false);
  };

  async function handleExportPdf() {
    if (!contentRef.current) return;
    try {
      setExporting(true);
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const element = contentRef.current;
      const canvas = await html2canvas(element, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDF("p", "pt", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgProps: any = (pdf as any).getImageProperties(imgData);
      const imgWidth = pdfWidth;
      const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      const fileName = `${note.title ? note.title.replace(/[^a-z0-9-_ ]/gi, "") : "note"}.pdf`;
      pdf.save(fileName);
    } catch (err) {
      console.error("Export PDF failed", err);
      toast.error("Unable to export PDF");
    } finally {
      setExporting(false);
    }
  }

  const cancel = () => {
    setTitle(note.title);
    setContent(note.content);
    setEditing(false);
  };

  const handleAddComment = async () => {
    const trimmed = commentText.trim();
    if (!trimmed) return;

    setSubmitting(true);
    try {
      await onCommentAdded(note.id, trimmed);
      setCommentText("");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setSubmitting(true);
    try {
      await onDelete(note.id);
      toast.success("The note has been successfully deleted.");
    } catch {
      toast.error("Failed to delete the note. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleShare = async () => {
    const shareText = `${note.title || "Untitled"}\n\n${
      note.content.replace(/<[^>]*>/g, "").trim() || "No content"
    }`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: note.title || "Untitled",
          text: shareText,
        });
        return;
      }

      await navigator.clipboard.writeText(shareText);
    } catch {
      // ignore cancelled share / clipboard errors
    }
  };

  const activeBg =
    note.background === IMAGE_BG_KEY
      ? { key: IMAGE_BG_KEY, style: IMAGE_BG_STYLE }
      : null;

  return (
    <>
      <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-background">
        <div
          className={cn(
            "shrink-0 border-b border-border/40 px-4 py-2",
            meta.tint,
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              {editing && note.canEdit ? (
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void save();
                    }
                    if (e.key === "Escape") cancel();
                  }}
                  placeholder="Note title…"
                  className="h-auto border-0 bg-transparent px-0 py-0 text-2xl font-bold leading-tight shadow-none focus-visible:ring-0"
                  autoFocus
                />
              ) : (
                <h1 className="text-md font-bold leading-tight tracking-tight text-foreground">
                  {title || "Untitled"}
                </h1>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className={cn("size-2 rounded-full", meta.class)} />
                  <span>Updated {formatRelative(note.updatedAt)}</span>
                </div>

                {note.isPinned && (
                  <Badge
                    variant="secondary"
                    className="gap-1 text-amber-600 dark:text-amber-400"
                  >
                    <Pin size={10} />
                    Pinned
                  </Badge>
                )}

                {note.isRoomNote && (
                  <Badge variant="secondary" className="gap-1">
                    <Users size={10} />
                    Shared
                  </Badge>
                )}

                {note.isInvited && (
                  <Badge variant="outline" className="gap-1">
                    <UserPlus size={10} />
                    Invite Pending
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setCollaboratorsOpen(true)}
              >
                <Users size={14} />
                Collaborators
              </Button>

              {editing ? (
                note.canEdit ? (
                  <>
                    <ToolButton
                      onClick={() => void save()}
                      icon={<Check size={16} />}
                      label="Save"
                      variant="success"
                      disabled={submitting}
                    />
                    <ToolButton
                      onClick={cancel}
                      icon={<X size={16} />}
                      label="Cancel"
                      disabled={submitting}
                    />
                  </>
                ) : null
              ) : (
                <>
                  {note.canEdit && (
                    <>
                      <BackgroundPicker
                        current={note.background}
                        onChange={(background) =>
                          void onUpdate(note.id, { background })
                        }
                      />
                      <ColorPicker
                        current={note.color}
                        onChange={(color) => void onUpdate(note.id, { color })}
                      />
                      <ToolButton
                        onClick={handleShare}
                        icon={<Share2 size={16} />}
                        label="Share"
                        disabled={submitting}
                      />
                      <ToolButton
                        onClick={() => void handleExportPdf()}
                        icon={
                          exporting ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Download size={16} />
                          )
                        }
                        label="Export PDF"
                        disabled={submitting || exporting}
                      />
                      <ToolButton
                        onClick={() =>
                          void onUpdate(note.id, { isPinned: !note.isPinned })
                        }
                        icon={
                          note.isPinned ? (
                            <PinOff size={16} />
                          ) : (
                            <Pin size={16} />
                          )
                        }
                        label={note.isPinned ? "Unpin" : "Pin"}
                        active={note.isPinned}
                        disabled={submitting}
                      />
                      <ToolButton
                        onClick={() => setEditing(true)}
                        icon={<Pencil size={16} />}
                        label="Edit"
                        disabled={submitting}
                      />
                    </>
                  )}

                  {note.canDelete && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <span>
                          <ToolButton
                            onClick={() => {}}
                            icon={
                              submitting ? (
                                <Loader2 size={16} className="animate-spin" />
                              ) : (
                                <Trash2 size={16} />
                              )
                            }
                            label="Delete"
                            variant="danger"
                            disabled={submitting}
                          />
                        </span>
                      </AlertDialogTrigger>

                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete note?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This note and its
                            related data will be permanently removed.
                          </AlertDialogDescription>
                        </AlertDialogHeader>

                        <AlertDialogFooter>
                          <AlertDialogCancel disabled={submitting}>
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            disabled={submitting}
                            onClick={(e) => {
                              e.preventDefault();
                              void handleDelete();
                            }}
                            className="bg-red-600 text-destructive-foreground hover:bg-red-600/70"
                          >
                            {submitting ? (
                              <span className="flex items-center gap-2">
                                <Loader2 size={14} className="animate-spin" />
                                Deleting...
                              </span>
                            ) : (
                              "Delete"
                            )}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </>
              )}
            </div>
          </div>

          {note.isInvited && note.myPendingInviteId && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    You&apos;ve been invited to this shared note
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Accept the invite to join this note, or decline to remove
                    it.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      void onDeclineInvite(note.myPendingInviteId!)
                    }
                  >
                    Decline
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void onAcceptInvite(note.myPendingInviteId!)}
                  >
                    {isPending ? (
                      <span className="flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin" />
                        Accepting...
                      </span>
                    ) : (
                      "Accept Invite"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div
            className="custom-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto"
            style={activeBg?.style ?? {}}
          >
            <div
              className={cn(
                "flex-1 p-8 pb-12",
                activeBg?.key && "flex items-start justify-center",
              )}
            >
              <div
                className={cn(
                  activeBg?.key &&
                    "w-full max-w-2xl rounded bg-white/90 p-8 shadow-2xl backdrop-blur-md dark:bg-black/75",
                )}
              >
                {editing ? (
                  <RichTextEditor
                    content={content}
                    onChange={setContent}
                    placeholder="Write your note…"
                  />
                ) : (
                  <div
                    ref={contentRef}
                    className="note-content prose prose-sm max-w-none cursor-text text-foreground/90 dark:prose-invert"
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (target.tagName === "IMG") {
                        setLightboxUrl((target as HTMLImageElement).src);
                      }
                    }}
                    dangerouslySetInnerHTML={{
                      __html:
                        content ||
                        "<p class='text-muted-foreground/60 italic'>Empty note — click edit to add content.</p>",
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          <div
            className={cn(
              "flex h-full min-h-0 shrink-0 flex-col border-l border-border/40 transition-all duration-300",
              activeBg?.key ? "bg-transparent" : "bg-card/30",
              commentsOpen ? "w-80" : "w-12",
            )}
            style={activeBg?.style ?? {}}
          >
            <button
              onClick={() => setCommentsOpen(!commentsOpen)}
              className={cn(
                "flex w-full shrink-0 items-center gap-2 border-b border-border/40 px-4 py-4 text-left text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
                activeBg?.key &&
                  "bg-white/70 backdrop-blur-sm dark:bg-black/50",
              )}
            >
              <ChevronRight
                size={14}
                className={cn(
                  "shrink-0 transition-transform duration-200",
                  commentsOpen && "rotate-180",
                )}
              />

              {commentsOpen && (
                <>
                  <span className="flex-1">Comments</span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {note.comments.length}
                  </span>
                </>
              )}
            </button>

            {commentsOpen && (
              <>
                <div
                  className={cn(
                    "custom-scrollbar min-h-0 flex-1 overflow-y-auto",
                    activeBg?.key &&
                      "bg-white/70 backdrop-blur-sm dark:bg-black/50",
                  )}
                >
                  {note.comments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
                      <div className="flex size-10 items-center justify-center rounded-full bg-secondary/50">
                        <span className="text-lg text-muted-foreground/30">
                          💬
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground/50">
                        No comments yet
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 p-4">
                      {note.comments.map((comment) => (
                        <CommentCard
                          key={comment.id}
                          comment={comment}
                          colorClass={meta.class}
                          onRemove={() => void onCommentRemoved(comment.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div
                  className={cn(
                    "shrink-0 border-t border-border/40 p-4",
                    activeBg?.key &&
                      "bg-white/70 backdrop-blur-sm dark:bg-black/50",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <input
                      ref={commentInputRef}
                      type="text"
                      placeholder="Add a comment…"
                      value={commentText}
                      disabled={submitting}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void handleAddComment();
                        }
                      }}
                      className="flex-1 rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/40 focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                    />

                    <button
                      onClick={() => void handleAddComment()}
                      disabled={!commentText.trim() || submitting}
                      className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-all disabled:opacity-40 hover:bg-primary/90"
                    >
                      <Send size={14} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {lightboxUrl && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-8 backdrop-blur-sm"
            onClick={() => setLightboxUrl(null)}
          >
            <button
              className="absolute right-6 top-6 flex size-10 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground"
              onClick={() => setLightboxUrl(null)}
            >
              <X size={18} />
            </button>

            <img
              src={lightboxUrl}
              alt="Attachment preview"
              className="max-h-full max-w-full rounded shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </div>

      <Dialog open={collaboratorsOpen} onOpenChange={setCollaboratorsOpen}>
        <DialogContent className="max-w-xl overflow-hidden p-0">
          <DialogHeader className="border-b border-border/40 px-6 py-4">
            <DialogTitle className="flex items-center gap-2">
              <Users size={18} />
              Collaborators
            </DialogTitle>
            <DialogDescription>
              Manage who can access this note.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {note.members.length}{" "}
                  {note.members.length === 1 ? "member" : "members"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Owners, editors, and viewers for this note
                </p>
              </div>

              {note.canEdit && (
                <UserInvitePopover
                  noteId={note.id}
                  existingMemberIds={note.members.map((m) => m.userId)}
                  onInvite={onInviteUser}
                  colorClass={meta.class}
                />
              )}
            </div>

            <div className="mt-5 grid max-h-105 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 md:grid-cols-4">
              {note.members.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/60 px-4 py-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    No collaborators yet
                  </p>
                </div>
              ) : (
                note.members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between gap-3 rounded border border-border/60 bg-background px-3 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar className="size-9 shrink-0">
                        <AvatarFallback
                          className={cn(
                            "text-xs font-medium text-white",
                            meta.class,
                          )}
                        >
                          {getInitials(member.userName)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {member.userName}
                        </p>
                        <div className="mt-1">
                          <RoleBadge role={member.role} />
                        </div>
                      </div>
                    </div>

                    {member.role !== "OWNER" && note.canDelete ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          void onRemoveUser(note.id, member.userId)
                        }
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                      >
                        <X size={14} />
                      </Button>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function RoleBadge({ role }: { role: "OWNER" | "EDITOR" | "VIEWER" }) {
  const config = {
    OWNER: {
      icon: Crown,
      label: "Owner",
      className:
        "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
    },
    EDITOR: {
      icon: Edit3,
      label: "Editor",
      className:
        "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
    },
    VIEWER: {
      icon: Eye,
      label: "Viewer",
      className: "bg-secondary text-muted-foreground",
    },
  }[role];

  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
        config.className,
      )}
    >
      <Icon size={10} />
      {config.label}
    </span>
  );
}

function UserInvitePopover({
  noteId,
  existingMemberIds,
  onInvite,
  colorClass,
}: {
  noteId: string;
  existingMemberIds: string[];
  onInvite: (
    noteId: string,
    userId: string,
    role?: "EDITOR" | "VIEWER",
  ) => void | Promise<void>;
  colorClass: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchUserItem[]>([]);
  const [selectedUser, setSelectedUser] = useState<SearchUserItem | null>(null);
  const [role, setRole] = useState<"EDITOR" | "VIEWER">("VIEWER");
  const [isPending, startTransition] = useTransition();
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const handleSearch = (value: string) => {
    setQuery(value);
    setSelectedUser(null);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (value.trim().length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const users = await searchUsers(value);
        setResults(users.filter((u) => !existingMemberIds.includes(u.id)));
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleInvite = () => {
    if (!selectedUser) return;

    startTransition(async () => {
      await onInvite(noteId, selectedUser.id, role);
      setQuery("");
      setSelectedUser(null);
      setResults([]);
      setOpen(false);
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <UserPlus size={14} />
          Invite
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="border-b border-border/40 p-4">
          <h4 className="text-sm font-semibold text-foreground">
            Invite Collaborator
          </h4>
          <p className="mt-1 text-xs text-muted-foreground">
            Search for a user to invite to this note
          </p>
        </div>

        <div className="p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60" />
            <Input
              placeholder="Search by name or email..."
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {query.trim().length >= 2 && (
            <div className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-border/60">
              {isSearching ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 size={16} className="animate-spin" />
                  Searching...
                </div>
              ) : results.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  No users found
                </div>
              ) : (
                <div className="p-1">
                  {results.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => setSelectedUser(user)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-secondary",
                        selectedUser?.id === user.id && "bg-secondary",
                      )}
                    >
                      <Avatar className="size-8">
                        <AvatarFallback
                          className={cn(
                            "text-xs font-medium text-white",
                            colorClass,
                          )}
                        >
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {user.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {user.email}
                        </p>
                      </div>
                      {selectedUser?.id === user.id && (
                        <Check size={16} className="shrink-0 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {selectedUser && (
            <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
              <div className="flex items-center gap-3">
                <Avatar className="size-10">
                  <AvatarFallback
                    className={cn("font-medium text-white", colorClass)}
                  >
                    {getInitials(selectedUser.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {selectedUser.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {selectedUser.email}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setRole("VIEWER")}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    role === "VIEWER"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:bg-secondary",
                  )}
                >
                  <Eye size={14} />
                  Viewer
                </button>
                <button
                  type="button"
                  onClick={() => setRole("EDITOR")}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    role === "EDITOR"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:bg-secondary",
                  )}
                >
                  <Edit3 size={14} />
                  Editor
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border/40 p-4">
          <Button
            onClick={handleInvite}
            disabled={!selectedUser || isPending}
            className="w-full gap-2"
          >
            {isPending ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Inviting...
              </>
            ) : (
              <>
                <UserPlus size={14} />
                Send Invite
              </>
            )}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ToolButton({
  onClick,
  icon,
  label,
  variant,
  active,
  disabled,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  variant?: "success" | "danger";
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      disabled={disabled}
      className={cn(
        "flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-50",
        variant === "success" &&
          "bg-emerald-100 text-emerald-600 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400",
        variant === "danger" &&
          "bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400",
        active && "text-amber-600 dark:text-amber-400",
      )}
    >
      {icon}
    </button>
  );
}

function ColorPicker({
  current,
  onChange,
}: {
  current: NoteColor;
  onChange: (c: NoteColor) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        title="Change color"
        className="flex size-9 items-center justify-center rounded-lg transition-all hover:bg-secondary"
      >
        <Palette size={16} className="text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-20 flex min-w-40 flex-col gap-1 rounded-lg border border-border/60 bg-popover p-2 shadow-xl animate-in fade-in zoom-in-95">
          {COLOR_PALETTE.map(({ key, label, class: colorClass }) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                onChange(key);
                setOpen(false);
              }}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-secondary",
                current === key && "bg-secondary",
              )}
            >
              <div className={cn("size-3.5 rounded-full", colorClass)} />
              <span className="text-foreground/80">{label}</span>
              {current === key && (
                <Check size={12} className="ml-auto text-primary" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CommentCard({
  comment,
  colorClass,
  onRemove,
}: {
  comment: NoteCommentItem;
  colorClass: string;
  onRemove: () => void;
}) {
  const initials = getInitials(comment.userName ?? "?");

  return (
    <div className="group flex items-start gap-3 rounded-lg bg-secondary/30 p-3 transition-colors hover:bg-secondary/50">
      <Avatar className="mt-0.5 size-8 shrink-0">
        <AvatarFallback
          className={cn("text-xs font-semibold text-white", colorClass)}
        >
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {comment.userName ?? "Unknown"}
          </span>

          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 rounded p-1 text-muted-foreground/50 opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
          >
            <X size={12} />
          </button>
        </div>

        <p className="mt-1 text-sm leading-relaxed text-foreground/80">
          {comment.content}
        </p>

        <p className="mt-2 text-[10px] text-muted-foreground/50">
          {formatRelative(comment.createdAt)}
        </p>
      </div>
    </div>
  );
}
