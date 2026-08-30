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
    <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
      {/* Header & Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
            <Plus className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-bold text-slate-900">Add Course Resource</h2>
        </div>

        {/* Toggle Mode */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              setMode("file");
              setErrorMsg(null);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              mode === "file"
                ? "bg-white text-slate-900 shadow-2xs"
                : "text-slate-500 hover:text-slate-900"
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
            className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              mode === "link"
                ? "bg-white text-slate-900 shadow-2xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>Web Link / URL</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
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
            className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
              selectedFile
                ? "border-indigo-300 bg-indigo-50/30"
                : "border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-slate-50"
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
                <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-slate-900">{selectedFile.name}</p>
                  <p className="text-[11px] text-slate-500">
                    {formatFileSize(selectedFile.size)} · Click or drop another file to replace
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="p-2 rounded-xl bg-slate-100 text-slate-500">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-700">
                    Click to browse or drag and drop your file here
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Supports PDF, Word (.docx, .doc), PowerPoint (.pptx), Text, and Images (up to 50MB)
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Resource Title (Optional)
              </label>
              <input
                type="text"
                value={fileTitle}
                onChange={(e) => setFileTitle(e.target.value)}
                placeholder="e.g. Week 4 Trees Lecture Notes"
                className="w-full px-3 py-2 text-xs bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={!selectedFile || isPending}
                className="w-full px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer h-[38px] flex items-center justify-center gap-1.5 disabled:cursor-not-allowed"
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
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Resource Title *
            </label>
            <input
              type="text"
              value={linkTitle}
              onChange={(e) => setLinkTitle(e.target.value)}
              required
              placeholder="e.g. Google Drive Course Folder, YouTube Playlist"
              className="w-full px-3 py-2 text-xs bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
              URL / Link *
            </label>
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              required
              placeholder="https://..."
              className="w-full px-3 py-2 text-xs bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
            />
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Type
              </label>
              <select
                value={linkType}
                onChange={(e) => setLinkType(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
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
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer shrink-0 h-[38px] flex items-center gap-1.5"
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
