"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  Link2,
  FileText,
  FolderArchive,
  Video,
  File,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Download,
  ExternalLink,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { reindexResource } from "@/server/actions/indexing";
import { DeleteResourceModal } from "@/components/study/DeleteResourceModal";

export interface CourseResourceItem {
  id: string;
  userId: string;
  courseId: string;
  title: string;
  url: string;
  resourceType: string | null;
  pageCount: number | null;
  extractedChars: number | null;
  indexStatus: string | null;
  createdAt: Date | string;
}

interface ResourceCardProps {
  resource: CourseResourceItem;
  courseId: string;
  chunkCount: number;
}

export function ResourceCard({
  resource,
  courseId,
  chunkCount,
}: ResourceCardProps) {
  const router = useRouter();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isReindexing, startReindexTransition] = useTransition();

  // Automatically poll/refresh every 2 seconds while document is actively indexing
  useEffect(() => {
    if (resource.indexStatus !== "indexing") return;

    const interval = setInterval(() => {
      router.refresh();
    }, 2000);

    return () => clearInterval(interval);
  }, [resource.indexStatus, router]);

  const type = resource.resourceType || "link";

  let typeLabel = "Link";
  let typeColor = "bg-slate-100 text-slate-700 border-slate-200";
  let Icon = Link2;

  if (type === "pdf") {
    typeLabel = "PDF Document";
    typeColor = "bg-rose-50 text-rose-700 border-rose-200";
    Icon = FileText;
  } else if (type === "doc") {
    typeLabel = "Word Doc";
    typeColor = "bg-blue-50 text-blue-700 border-blue-200";
    Icon = FileText;
  } else if (type === "slides") {
    typeLabel = "Slides";
    typeColor = "bg-amber-50 text-amber-700 border-amber-200";
    Icon = FolderArchive;
  } else if (type === "video") {
    typeLabel = "Video";
    typeColor = "bg-purple-50 text-purple-700 border-purple-200";
    Icon = Video;
  } else if (type === "file") {
    typeLabel = "File";
    typeColor = "bg-slate-50 text-slate-700 border-slate-200";
    Icon = File;
  }

  const isUploadedFile =
    resource.url.includes("supabase.co") || resource.url.includes("/storage/");

  const handleReindex = () => {
    startReindexTransition(async () => {
      await reindexResource(resource.id);
    });
  };

  return (
    <>
      <div className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-5 shadow-xs transition-all flex flex-col justify-between group">
        <div>
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider ${typeColor}`}
              >
                {typeLabel}
              </span>

              {type === "pdf" && (
                resource.indexStatus === "ready" ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span>
                      Indexed ({resource.pageCount ?? 1}{" "}
                      {(resource.pageCount ?? 1) === 1 ? "page" : "pages"}
                      {chunkCount > 0 ? ` • ${chunkCount} chunks` : ""})
                    </span>
                  </span>
                ) : resource.indexStatus === "indexing" ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                    <Loader2 className="w-3 h-3 animate-spin text-amber-600 shrink-0" />
                    <span>Indexing...</span>
                  </span>
                ) : resource.indexStatus === "failed" ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
                    <AlertCircle className="w-3 h-3 text-rose-600 shrink-0" />
                    <span>Index failed</span>
                  </span>
                ) : null
              )}
            </div>

            <span className="text-[11px] text-slate-400">
              {formatDistanceToNow(new Date(resource.createdAt), {
                addSuffix: true,
              })}
            </span>
          </div>

          <h3 className="text-sm font-bold text-slate-900 line-clamp-2">
            {resource.title}
          </h3>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
          <a
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline max-w-[220px] truncate"
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              {isUploadedFile ? "Open / Download File" : resource.url}
            </span>
            {isUploadedFile ? (
              <Download className="w-3 h-3 shrink-0 ml-0.5" />
            ) : (
              <ExternalLink className="w-3 h-3 shrink-0 ml-0.5" />
            )}
          </a>

          <div className="flex items-center gap-1 shrink-0">
            {type === "pdf" && (
              <button
                type="button"
                disabled={isReindexing}
                onClick={handleReindex}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-slate-800 hover:bg-slate-100 px-2 py-1 rounded-md transition-colors cursor-pointer disabled:opacity-50"
                title="Re-run fast PDF indexing"
              >
                <RefreshCw
                  className={`w-3 h-3 text-slate-400 ${
                    isReindexing ? "animate-spin text-indigo-600" : ""
                  }`}
                />
                <span className="hidden sm:inline">Re-index</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsDeleteOpen(true)}
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              title="Delete resource"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="sr-only">Delete</span>
            </button>
          </div>
        </div>
      </div>

      <DeleteResourceModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        resource={resource}
        courseId={courseId}
        chunkCount={chunkCount}
      />
    </>
  );
}
