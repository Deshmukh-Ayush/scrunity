"use client";

import { useState, useMemo } from "react";
import { format, subDays, isAfter } from "date-fns";
import { motion } from "framer-motion";
import {
  FilePdfIcon,
  FileImageIcon,
  FileZipIcon,
  FileCodeIcon,
  FileIcon,
  DownloadSimpleIcon,
  UploadSimpleIcon,
  FolderSimpleIcon,
  MagnifyingGlassIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import axios from "axios";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type FileItem = {
  file: {
    id: string;
    name: string;
    size: number;
    url: string;
    createdAt: Date;
  };
  uploader: {
    name: string | null;
  };
};

type FilesVaultClientProps = {
  projectId: string;
  files: FileItem[];
};

function formatBytes(bytes: number, decimals = 1) {
  if (!+bytes) return "0 KB";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

const isDoc = (name: string) => /\.(pdf|doc|docx|txt|rtf)$/i.test(name);
const isMedia = (name: string) => /\.(png|jpg|jpeg|svg|webp|gif|mp4|mov)$/i.test(name);
const isCodeOrArchive = (name: string) =>
  /\.(zip|rar|tar|gz|js|ts|tsx|jsx|json|py|html|css)$/i.test(name);

type CategoryType = "all" | "documents" | "media" | "code" | "other";

export function FilesVaultClient({ projectId, files }: FilesVaultClientProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>("all");
  const router = useRouter();

  const totalSizeBytes = useMemo(
    () => files.reduce((sum, f) => sum + (f.file.size || 0), 0),
    [files]
  );

  const sevenDaysAgo = useMemo(() => subDays(new Date(), 7), []);
  const recentCount = useMemo(
    () => files.filter((f) => isAfter(new Date(f.file.createdAt), sevenDaysAgo)).length,
    [files, sevenDaysAgo]
  );

  const categoryCounts = useMemo(() => {
    return {
      all: files.length,
      documents: files.filter((f) => isDoc(f.file.name)).length,
      media: files.filter((f) => isMedia(f.file.name)).length,
      code: files.filter((f) => isCodeOrArchive(f.file.name)).length,
      other: files.filter(
        (f) =>
          !isDoc(f.file.name) &&
          !isMedia(f.file.name) &&
          !isCodeOrArchive(f.file.name)
      ).length,
    };
  }, [files]);

  const filteredFiles = useMemo(() => {
    return files.filter(({ file, uploader }) => {
      // Category check
      if (selectedCategory === "documents" && !isDoc(file.name)) return false;
      if (selectedCategory === "media" && !isMedia(file.name)) return false;
      if (selectedCategory === "code" && !isCodeOrArchive(file.name)) return false;
      if (
        selectedCategory === "other" &&
        (isDoc(file.name) || isMedia(file.name) || isCodeOrArchive(file.name))
      )
        return false;

      // Search query check
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = file.name.toLowerCase().includes(q);
        const matchUploader = (uploader?.name || "").toLowerCase().includes(q);
        return matchName || matchUploader;
      }

      return true;
    });
  }, [files, selectedCategory, searchQuery]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("projectId", projectId);

    try {
      const res = await axios.post("/api/files", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data.success) {
        toast.success("File uploaded to vault");
        router.refresh();
      }
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.error ?? err.message
        : err instanceof Error
        ? err.message
        : "Failed to upload file";
      toast.error(message);
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const getFileConfig = (fileName: string) => {
    if (/\.(pdf)$/i.test(fileName)) {
      return { Icon: FilePdfIcon, color: "text-destructive", tag: "PDF" };
    }
    if (/\.(png|jpg|jpeg|svg|webp|gif)$/i.test(fileName)) {
      return { Icon: FileImageIcon, color: "text-emerald-500", tag: "IMG" };
    }
    if (/\.(zip|rar|tar|gz)$/i.test(fileName)) {
      return { Icon: FileZipIcon, color: "text-amber-500", tag: "ZIP" };
    }
    if (/\.(js|ts|tsx|jsx|json|py|html|css)$/i.test(fileName)) {
      return { Icon: FileCodeIcon, color: "text-sky-600 dark:text-sky-400", tag: "CODE" };
    }
    return { Icon: FileIcon, color: "text-foreground", tag: "FILE" };
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto w-full pb-20 antialiased selection:bg-neutral-200 dark:selection:bg-neutral-800">
      {/* Header Bar with Metric Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/40">
        <div>
          <h1 className="text-[32px] font-semibold tracking-tight text-foreground text-balance leading-tight">
            Project Files
          </h1>
          {/* Header Metric Strip: restrained metadata without forcing a full KPI row */}
          <p className="text-xs text-muted-foreground mt-1 tabular-nums font-medium flex items-center gap-1.5">
            <span>{files.length} {files.length === 1 ? "file" : "files"}</span>
            <span>·</span>
            <span>{formatBytes(totalSizeBytes)} total</span>
            {recentCount > 0 && (
              <>
                <span>·</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  {recentCount} uploaded this week
                </span>
              </>
            )}
          </p>
        </div>

        <div className="relative self-start sm:self-auto">
          <input
            type="file"
            onChange={handleFileChange}
            disabled={isUploading}
            aria-label="Upload file"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          <button
            disabled={isUploading}
            className="active:scale-[0.96] transition-transform h-9 px-4 rounded-full bg-brand text-white font-semibold text-sm flex items-center gap-1.5"
          >
            <UploadSimpleIcon className="w-4 h-4 stroke-2" />
            <span>{isUploading ? "Uploading..." : "Upload File"}</span>
          </button>
        </div>
      </div>

      {/* Search & Category Filter Toolbar */}
      {files.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                selectedCategory === "all"
                  ? "bg-foreground text-background"
                  : "bg-muted/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              All ({categoryCounts.all})
            </button>
            {categoryCounts.documents > 0 && (
              <button
                onClick={() => setSelectedCategory("documents")}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                  selectedCategory === "documents"
                    ? "bg-foreground text-background"
                    : "bg-muted/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                Agreements & PDFs ({categoryCounts.documents})
              </button>
            )}
            {categoryCounts.media > 0 && (
              <button
                onClick={() => setSelectedCategory("media")}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                  selectedCategory === "media"
                    ? "bg-foreground text-background"
                    : "bg-muted/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                Media ({categoryCounts.media})
              </button>
            )}
            {categoryCounts.code > 0 && (
              <button
                onClick={() => setSelectedCategory("code")}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                  selectedCategory === "code"
                    ? "bg-foreground text-background"
                    : "bg-muted/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                Code & Archives ({categoryCounts.code})
              </button>
            )}
            {categoryCounts.other > 0 && (
              <button
                onClick={() => setSelectedCategory("other")}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                  selectedCategory === "other"
                    ? "bg-foreground text-background"
                    : "bg-muted/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                Other ({categoryCounts.other})
              </button>
            )}
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files or uploader..."
              className="w-full h-8 pl-8 pr-7 text-xs rounded-md border border-border/50 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <XCircleIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Vaulted Files List Section */}
      <section aria-label="Project Files Vault" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold tracking-tight text-foreground text-balance">
            Files ({filteredFiles.length}
            {filteredFiles.length !== files.length ? ` of ${files.length}` : ""})
          </h2>
        </div>

        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed border-border/60 bg-muted/20">
            <div className="rounded-full bg-primary/10 p-4 mb-4 text-primary">
              <FolderSimpleIcon className="w-8 h-8" />
            </div>
            <h3 className="text-base font-semibold text-foreground tracking-tight text-balance">
              No Files Uploaded Yet
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md leading-relaxed text-pretty">
              Upload documents, media assets, design mockups, or code deliverables to share instantly with project members.
            </p>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center rounded-lg border border-border/40 bg-muted/10">
            <p className="text-xs text-muted-foreground">
              No files match your search &ldquo;{searchQuery}&rdquo; or filter.
            </p>
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("all");
              }}
              className="mt-2 text-xs font-medium text-brand hover:underline"
            >
              Reset filters
            </button>
          </div>
        ) : (
          <div className="rounded-md border border-border/40 divide-y divide-border/40 bg-card overflow-hidden">
            {filteredFiles.map(({ file, uploader }, index) => {
              const fileConfig = getFileConfig(file.name);
              const FileTypeIcon = fileConfig.Icon;
              const dateObj = new Date(file.createdAt);

              return (
                <motion.div
                  key={file.id}
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.12, delay: Math.min(index * 0.015, 0.2) }}
                  className="group flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 py-2.5 px-3.5 hover:bg-muted/30 transition-colors"
                >
                  {/* Left: Icon, File Name & Tag */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <FileTypeIcon className={`w-4 h-4 shrink-0 ${fileConfig.color}`} />

                    <span className="text-xs font-medium tracking-tight text-foreground truncate max-w-60 sm:max-w-md">
                      {file.name}
                    </span>

                    <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold tracking-wide uppercase bg-muted text-muted-foreground border border-border/30 shrink-0">
                      {fileConfig.tag}
                    </span>
                  </div>

                  {/* Right: File Size, Uploader, Date & Actions */}
                  <div className="flex items-center gap-4 shrink-0 w-full sm:w-auto justify-between sm:justify-end mt-2 sm:mt-0 ml-7 sm:ml-0">
                    <div className="text-xs text-muted-foreground whitespace-nowrap hidden sm:block">
                      Uploaded by <span className="font-medium text-foreground">{uploader?.name || "User"}</span>
                    </div>

                    <div className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                      {format(dateObj, "dd MMM")}
                    </div>

                    <div className="text-xs font-medium tabular-nums text-muted-foreground min-w-16 text-right">
                      {formatBytes(file.size)}
                    </div>

                    {/* Action Button */}
                    <div className="flex items-center gap-1.5 shrink-0 justify-end">
                      <a
                        href={file.url}
                        download
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 h-7 px-2.5 text-[11px] font-medium rounded-md border border-border/60 bg-background hover:bg-muted/60 text-foreground transition-colors"
                        aria-label={`Download file ${file.name}`}
                      >
                        <DownloadSimpleIcon className="w-3 h-3" />
                        <span>Download</span>
                      </a>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
