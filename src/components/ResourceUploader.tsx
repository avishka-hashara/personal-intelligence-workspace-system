"use client";

import { useState, useRef, useTransition } from "react";
import { uploadResourceFile, addResource } from "@/server/actions/study";
import {
  Upload,
  Link2,
  FileText,
  FileCode,
  FileSpreadsheet,
  Image,
  Video,
  File,
  Plus,
  Loader2,
  CheckCircle2,
  X,
} from "lucide-react";

interface ResourceUploaderProps {
  courseId: string;
}

export function ResourceUploader({ courseId }: ResourceUploaderProps) {
  const [mode, setMode] = useState<"file" | "link">("file");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileTitle, setFileTitle] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkType, setLinkType] = useState("link");
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!fileTitle) {
        // Remove extension for default title
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        setFileTitle(nameWithoutExt);
      }
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!fileTitle) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        setFileTitle(nameWithoutExt);
      }
    }
  };

  const handleFileUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || isPending) return;

    setErrorMsg(null);
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("title", fileTitle.trim() || selectedFile.name);

    startTransition(async () => {
      const res = await uploadResourceFile(courseId, formData);
      if (res?.error) {
        setErrorMsg(res.error);
      } else {
        setSelectedFile(null);
        setFileTitle("");
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    });
  };

  const handleLinkUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkUrl.trim() || !linkTitle.trim() || isPending) return;

    setErrorMsg(null);
    const formData = new FormData();
    formData.append("title", linkTitle.trim());
    formData.append("url", linkUrl.trim());
    formData.append("resourceType", linkType);

    startTransition(async () => {
      const res = await addResource(courseId, formData);
      if (res?.error) {
        setErrorMsg(res.error);
      } else {
        setLinkTitle("");
        setLinkUrl("");
      }
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <section className="bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800/70 rounded-2xl p-5 sm:p-6 shadow-subtle space-y-4">
      {/* Header & Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/60">
            <Plus className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Add Course Resource</h2>
        </div>

        {/* Toggle Mode */}
        <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              setMode("file");
              setErrorMsg(null);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg transition-all cursor-pointer ${
              mode === "file"
                ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload File (PDF / Word)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode("link");
              setErrorMsg(null);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg transition-all cursor-pointer ${
              mode === "link"
                ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>Web Link / URL</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-medium text-rose-700 dark:text-rose-400">
          {errorMsg}
        </div>
      )}

      {/* Mode 1: File Upload */}
      {mode === "file" && (
        <form onSubmit={handleFileUpload} className="space-y-3">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2.5 ${
              selectedFile
                ? "border-zinc-400 dark:border-zinc-500 bg-zinc-50 dark:bg-zinc-800/40"
                : "border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 bg-zinc-50/50 dark:bg-zinc-900/30 hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.zip"
              className="hidden"
            />

            {selectedFile ? (
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200/60 dark:border-zinc-700/60">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{selectedFile.name}</p>
                  <p className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500">
                    {formatFileSize(selectedFile.size)} · Click or drop another file to replace
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                    Click to browse or drag and drop your file here
                  </p>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                    Supports PDF, Word (.docx, .doc), PowerPoint (.pptx), Text, and Images (up to 50MB)
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                Resource Title (Optional)
              </label>
              <input
                type="text"
                value={fileTitle}
                onChange={(e) => setFileTitle(e.target.value)}
                placeholder="e.g. Week 4 Trees Lecture Notes"
                className="w-full px-3 py-2 text-xs bg-zinc-50/70 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:bg-white dark:focus:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={!selectedFile || isPending}
                className="w-full px-4 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 disabled:opacity-40 text-xs font-semibold rounded-xl shadow-subtle transition-all cursor-pointer h-[38px] flex items-center justify-center gap-1.5 disabled:cursor-not-allowed"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload & Save File</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Mode 2: Web Link */}
      {mode === "link" && (
        <form onSubmit={handleLinkUpload} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-2">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
              Resource Title *
            </label>
            <input
              type="text"
              value={linkTitle}
              onChange={(e) => setLinkTitle(e.target.value)}
              required
              placeholder="e.g. Google Drive Course Folder, YouTube Playlist"
              className="w-full px-3 py-2 text-xs bg-zinc-50/70 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:bg-white dark:focus:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
              URL / Link *
            </label>
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              required
              placeholder="https://..."
              className="w-full px-3 py-2 text-xs bg-zinc-50/70 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:bg-white dark:focus:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all"
            />
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                Type
              </label>
              <select
                value={linkType}
                onChange={(e) => setLinkType(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-zinc-50/70 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 focus:bg-white dark:focus:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all"
              >
                <option value="link">Link</option>
                <option value="doc">Document</option>
                <option value="pdf">PDF</option>
                <option value="video">Video</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={!linkTitle.trim() || !linkUrl.trim() || isPending}
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 disabled:opacity-40 text-xs font-semibold rounded-xl shadow-subtle transition-all cursor-pointer shrink-0 h-[38px] flex items-center gap-1.5"
            >
              {isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              <span>Add</span>
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

export default ResourceUploader;
