"use client";
import React, { useRef, useState } from "react";
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, File, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { isElectron } from "@/hooks/useEnvironment";

import { FileAdapter } from "@/services/fileAdapter";

function FileUpload() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [progress, setProgress] = useState(0);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const url = process.env.NEXT_PUBLIC_BACKEND_URL;
  const router = useRouter();

  const uploadEndpoint = `${url}/fileUpload`;

  const handleFileSelection = (file: File) => {
    setError(null);
    setResultUrl(null);
    setProgress(0);

    const validTypes = ['.pdf', '.epub', '.txt'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();

    if (!validTypes.includes(fileExtension)) {
      setError("Invalid file type. Please upload PDF, EPUB, or TXT files.");
      return;
    }

    setSelectedFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelection(files[0]);
    }
  };

  const uploadFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError("No file selected");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      setError("Please login to upload files");
      return;
    }

    try {
      setError(null);
      const resultingUrl = await FileAdapter.uploadFile(selectedFile, token, uploadEndpoint, setProgress);
      setProgress(100);
      setResultUrl(resultingUrl);
    } catch (err: any) {
      setError(err.message || "Upload failed");
      setProgress(0);
    }
  };

  const handleLocalBook = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setError("Please login to add local files");
      return;
    }
    
    try {
      const data = await FileAdapter.addLocalBook(token);
      if (data) {
        setResultUrl(data.url);
        setSelectedFile({ name: data.fileName } as any);
      }
    } catch (err: any) {
      setError(err.message || "Failed to add local book");
    }
  };

  const getFileIcon = () => {
    if (!selectedFile) return <Upload size={32} className="text-gray-400" />;
    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return <FileText size={32} className="text-red-500" />;
    if (ext === 'epub') return <FileText size={32} className="text-green-500" />;
    return <FileText size={32} className="text-blue-500" />;
  };

  const getReaderUrl = (url: string) => {
    return `/reader?files=${encodeURIComponent(url)}&active=0`;
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background relative px-4 py-6">

      {/* Background Decor (Subtle Glow) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-xl relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <button
          onClick={() => router.push('/files')}
          className="group mb-4 px-3 py-1.5 bg-surface/70 backdrop-blur-2xl border border-border-subtle rounded-xl text-foreground-muted hover:text-foreground hover:bg-surface-hover hover:border-primary/40 inline-flex items-center gap-2 transition-all duration-300 font-semibold text-xs tracking-wide shadow-xs"
        >
          <div className="w-6 h-6 rounded-full bg-surface-hover/80 border border-border-subtle flex items-center justify-center group-hover:border-primary transition-colors text-xs">
            ←
          </div>
          Back to Library
        </button>

        <div className="text-center mb-5">
          <h1 className="text-2xl md:text-3xl font-extrabold text-foreground mb-1 tracking-tight">
            Add to Collection
          </h1>
          <p className="text-foreground-muted text-xs sm:text-sm">
            Upload documents to your secure digital library
          </p>
        </div>

        <div className="bg-surface/85 backdrop-blur-2xl rounded-2xl p-6 md:p-8 shadow-xl border border-border-subtle">
          {!resultUrl ? (
            <form onSubmit={uploadFile} className="space-y-5">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`
                  relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 ease-in-out
                  ${isDragging
                    ? "border-primary bg-primary/10 scale-[1.01]"
                    : "border-border-subtle hover:border-primary hover:bg-surface-hover/60 bg-surface/40 backdrop-blur-md"
                  }
                  ${selectedFile ? "border-primary/50 bg-primary/5" : ""}
                `}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.epub,.txt"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileSelection(e.target.files[0])}
                />

                <div className="flex flex-col items-center gap-3">
                  <div className={`p-3.5 rounded-xl bg-surface/80 backdrop-blur-2xl border border-border-subtle shadow-md transition-transform duration-300 ${isDragging ? "scale-105 rotate-2" : ""}`}>
                    {getFileIcon()}
                  </div>

                  <div>
                    {selectedFile ? (
                      <div className="animate-in fade-in zoom-in duration-300 relative group">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFile(null);
                            setProgress(0);
                            setError(null);
                            if (fileRef.current) fileRef.current.value = '';
                          }}
                          className="absolute -top-3 -right-6 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all duration-200"
                          title="Remove file"
                        >
                          <X size={14} />
                        </button>
                        <p className="text-base font-bold text-foreground mb-0.5 truncate max-w-sm">{selectedFile.name}</p>
                        <p className="text-xs text-primary font-medium">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-foreground">Drop your file here</p>
                        <p className="text-xs text-foreground-muted">or click to browse • supports PDF, EPUB, TXT</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {progress > 0 && progress < 100 && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium text-foreground-muted">
                    <span>Uploading...</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-2 bg-surface/60 backdrop-blur-md rounded-full overflow-hidden border border-border-subtle">
                    <div
                      className="h-full bg-primary transition-all duration-300 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-xl flex items-center gap-2.5 text-red-500 text-xs">
                  <AlertCircle size={18} className="shrink-0" />
                  <p className="font-medium">{error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={!selectedFile || (progress > 0 && progress < 100)}
                  className="flex-1 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-sm shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
                >
                  {progress > 0 && progress < 100 ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={18} />
                      <span>Start Upload</span>
                    </>
                  )}
                </button>
                {isElectron() && (
                  <button
                    type="button"
                    onClick={handleLocalBook}
                    disabled={progress > 0 && progress < 100}
                    className="flex-1 py-3 bg-surface/80 backdrop-blur-xl hover:bg-surface-hover text-foreground border border-border-subtle rounded-xl font-bold text-sm shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
                  >
                    <File size={18} />
                    <span>Add Local Book</span>
                  </button>
                )}
              </div>
            </form>
          ) : (
            <div className="text-center space-y-4 py-4 animate-in fade-in zoom-in duration-300">
              <div className="w-14 h-14 bg-green-950 border border-green-500 rounded-full flex items-center justify-center mx-auto mb-3 shadow-[0_0_20px_rgba(34,197,94,0.2)]">
                <CheckCircle2 size={28} className="text-green-500" />
              </div>

              <div>
                <h2 className="text-xl font-extrabold text-foreground mb-1">Upload Successful</h2>
                <p className="text-foreground-muted text-xs sm:text-sm">&quot;{selectedFile?.name}&quot; has been added to your library.</p>
              </div>

              <div className="flex flex-col gap-2.5 pt-2">
                <button
                  onClick={() => router.push('/files')}
                  className="w-full py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all duration-200"
                >
                  Return to Library
                </button>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={() => router.push(getReaderUrl(resultUrl))}
                    className="w-full py-2.5 bg-surface backdrop-blur-xl hover:bg-surface-hover text-foreground border border-border-subtle rounded-xl font-bold text-xs sm:text-sm transition-all duration-200 shadow-xs"
                  >
                    Read Now
                  </button>
                  <button
                    onClick={() => {
                      setResultUrl(null);
                      setSelectedFile(null);
                      setProgress(0);
                    }}
                    className="w-full py-2.5 bg-surface backdrop-blur-xl hover:bg-surface-hover text-foreground-muted hover:text-foreground border border-border-subtle rounded-xl font-bold text-xs sm:text-sm transition-all duration-200 shadow-xs"
                  >
                    Upload Another
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default FileUpload;
