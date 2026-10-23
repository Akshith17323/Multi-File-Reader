"use client";
import React, { useRef, useState } from "react";
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, File, X, BookOpen, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEnvironment } from "@/hooks/useEnvironment";
import { FileAdapter } from "@/services/fileAdapter";
import AppShell, { PageHeader } from "@/components/ui/AppShell";
import { FormatCard } from "@/components/ui/FormatShowcase";
import { createReaderUrl } from "@/utils/readerSession";

function FileUpload() {
  const { isElectron: isDesktop } = useEnvironment();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const uploadInFlight = useRef(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const url = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:2007").replace(/\/$/, "");
  const router = useRouter();

  const uploadEndpoint = `${url}/fileUpload`;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleFileSelection = (file: File) => {
    if (uploadInFlight.current) return;
    setSelectedFile(null);
    setError(null);
    setResultUrl(null);
    setProgress(0);

    const validTypes = ['.pdf', '.epub', '.txt'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();

    if (!validTypes.includes(fileExtension)) {
      setError("Invalid file type. Please upload PDF, EPUB, or TXT files.");
      return;
    }

    if (file.size > 50 * 1024 * 1024) { setError("Files must be 50 MB or smaller"); return; }
    setSelectedFile(file);
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
    if (uploadInFlight.current) return;
    if (!selectedFile) {
      setError("No file selected");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      setError("Please login to upload files");
      return;
    }

    uploadInFlight.current = true;
    setIsUploading(true);
    try {
      setError(null);
      const resultingUrl = await FileAdapter.uploadFile(selectedFile, token, uploadEndpoint, setProgress);
      setProgress(100);
      setResultUrl(resultingUrl);
    } catch (err: any) {
      setError(err.message || "Upload failed");
      setProgress(0);
    } finally {
      uploadInFlight.current = false;
      setIsUploading(false);
    }
  };

  const handleLocalBook = async () => {
    if (uploadInFlight.current) return;
    const token = localStorage.getItem("token");
    if (!token) {
      setError("Please login to add local files");
      return;
    }

    uploadInFlight.current = true;
    setIsUploading(true);
    try {
      setError(null);
      const data = await FileAdapter.addLocalBook(token);
      if (data) {
        setResultUrl(data.url);
        setSelectedFile({ name: data.fileName } as any);
      }
    } catch (err: any) {
      setError(err.message || "Failed to add local book");
    } finally {
      uploadInFlight.current = false;
      setIsUploading(false);
    }
  };

  const handleOpenLocalDirect = async () => {
    try {
      const result = await (window as any).electronAPI?.invoke('open-local-file');
      if (result && !result.canceled && result.url) {
        router.push(createReaderUrl([result.url]));
      } else if (result?.error) {
        setError(`Permission/access error: ${result.error}`);
      }
    } catch (err: any) {
      setError(err.message || "Failed to open local file");
    }
  };

  const getFileIcon = () => {
    if (!selectedFile) return <Upload size={32} className="text-primary" />;
    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return <FileText size={32} className="text-red-500" />;
    if (ext === 'epub') return <FileText size={32} className="text-green-500" />;
    return <FileText size={32} className="text-blue-500" />;
  };

  const getReaderUrl = (url: string) => {
    return createReaderUrl([url]);
  };

  return (
    <AppShell className="flex items-center" contentClassName="max-w-2xl">
        <button
          onClick={() => router.push('/files')}
          className="group mb-5 px-3.5 py-1.5 bg-surface/70 backdrop-blur-2xl border border-border-subtle rounded-xl text-foreground-muted hover:text-foreground hover:bg-surface-hover hover:border-primary/40 inline-flex items-center gap-2 transition-all duration-300 font-semibold text-xs tracking-wide shadow-xs"
        >
          <div className="w-6 h-6 rounded-full bg-surface-hover/80 border border-border-subtle flex items-center justify-center group-hover:border-primary transition-colors text-xs">
            <ArrowLeft size={12} />
          </div>
          Back to Library
        </button>

        <PageHeader
          eyebrow="Your digital library"
          title="Add to"
          accent="Collection"
          description="Upload your books and documents, then start reading."
          className="mb-6"
        />

        <div className="mfr-panel rounded-3xl p-5 shadow-xl sm:p-8">
          {!resultUrl ? (
            <form onSubmit={uploadFile} className="space-y-5">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                role="button"
                tabIndex={0}
                aria-label={selectedFile ? `Change selected file: ${selectedFile.name}` : "Choose a PDF, EPUB, or TXT file"}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return;
                  if (!isUploading && (event.key === "Enter" || event.key === " ")) {
                    event.preventDefault();
                    fileRef.current?.click();
                  }
                }}
                onClick={() => !isUploading && fileRef.current?.click()}
                className={`
                  group relative border-2 border-dashed rounded-2xl p-6 sm:p-10 text-center cursor-pointer transition-all duration-300 ease-in-out
                  ${isDragging
                    ? "border-primary bg-primary/10 scale-[1.01]"
                    : "border-border-subtle hover:border-primary/60 hover:bg-surface-hover/60 bg-surface-hover/30 backdrop-blur-md"
                  }
                  ${selectedFile ? "border-primary/50 bg-primary/5" : ""}
                `}
              >
                <input
                  ref={fileRef}
                  type="file"
                  disabled={isUploading}
                  accept=".pdf,.epub,.txt"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileSelection(e.target.files[0])}
                />

                <div className="flex flex-col items-center gap-3.5">
                  <div className={`p-4 rounded-2xl bg-surface/90 backdrop-blur-2xl border border-border-subtle shadow-md transition-transform duration-300 ${isDragging ? "scale-110 rotate-3" : "group-hover:scale-105"}`}>
                    {getFileIcon()}
                  </div>

                  <div>
                    {selectedFile ? (
                      <div className="animate-in fade-in zoom-in duration-300 relative group/file">
                        <button
                          type="button"
                          disabled={isUploading}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFile(null);
                            setProgress(0);
                            setError(null);
                            if (fileRef.current) fileRef.current.value = '';
                          }}
                          className="absolute -top-3 -right-6 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-full p-1 opacity-80 sm:opacity-0 sm:group-hover/file:opacity-100 transition-all duration-200"
                          title="Remove file"
                        >
                          <X size={14} />
                        </button>
                        <p className="text-base font-bold text-foreground mb-0.5 break-all">{selectedFile.name}</p>
                        <p className="text-xs text-primary font-bold">{selectedFile.size !== undefined ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB` : "Local file"}</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-sm sm:text-base font-bold text-foreground">Drop your document here</p>
                        <p className="text-xs text-foreground-muted">or click to browse · up to 50 MB</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                <FormatCard icon={<FileText size={20} />} label="PDF" detail="Documents" color="text-red-500" />
                <FormatCard icon={<BookOpen size={20} />} label="EPUB" detail="Books" color="text-emerald-500" />
                <FormatCard icon={<FileText size={20} />} label="TXT" detail="Plain text" color="text-sky-500" />
              </div>

              {isUploading && (
                <div className="space-y-1.5 p-3 rounded-xl bg-surface-hover/40 border border-border-subtle">
                  <div className="flex justify-between text-xs font-semibold text-foreground-muted">
                    <span className="flex items-center gap-1.5">
                      <Loader2 size={13} className="animate-spin text-primary" />
                      Uploading & processing...
                    </span>
                    <span className="text-primary font-bold">{progress}%</span>
                  </div>
                  <div className="h-2 bg-surface/60 backdrop-blur-md rounded-full overflow-hidden border border-border-subtle">
                    <div
                      className="h-full bg-linear-to-r from-primary via-purple-500 to-blue-500 transition-all duration-300 shadow-[0_0_8px_var(--color-primary-glow)]"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2.5 text-red-500 text-xs">
                  <AlertCircle size={18} className="shrink-0" />
                  <p className="font-medium">{error}</p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                <button
                  type="submit"
                  disabled={!selectedFile || isUploading}
                  className="mfr-button-primary flex-1 overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                  {isUploading ? (
                    <>
                      <Loader2 className="animate-spin relative z-10" size={18} />
                      <span className="relative z-10">Processing...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={18} className="relative z-10" />
                      <span className="relative z-10">Start Upload</span>
                    </>
                  )}
                </button>
                {isDesktop && (
                  <button
                    type="button"
                    onClick={handleLocalBook}
                    disabled={isUploading}
                    className="mfr-button-secondary sm:flex-1"
                  >
                    <File size={18} className="text-primary" />
                    <span>Add Local Book</span>
                  </button>
                )}
              </div>

              {isDesktop && (
                <div className="pt-1 text-center">
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={handleOpenLocalDirect}
                    className="text-xs font-semibold text-foreground-muted hover:text-primary transition-colors inline-flex items-center gap-1.5 cursor-pointer py-1"
                  >
                    <FileText size={13} className="text-primary" />
                    <span>Or open a local file directly (read without adding)</span>
                  </button>
                </div>
              )}
            </form>
          ) : (
            <div className="text-center space-y-5 py-4 animate-in fade-in zoom-in duration-300">
              <div className="w-16 h-16 bg-green-500/10 border border-green-500/30 rounded-2xl flex items-center justify-center mx-auto shadow-[0_0_25px_rgba(34,197,94,0.25)]">
                <CheckCircle2 size={32} className="text-green-500" />
              </div>

              <div>
                <h2 className="text-2xl font-extrabold text-foreground mb-1">Upload Successful!</h2>
                <p className="text-foreground-muted text-xs sm:text-sm max-w-sm mx-auto">
                  &quot;<span className="font-bold text-foreground">{selectedFile?.name}</span>&quot; is now ready to read in your unified library.
                </p>
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <button
                  onClick={() => router.push(getReaderUrl(resultUrl))}
                  className="mfr-button-primary w-full overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                  <BookOpen size={16} className="relative z-10" />
                  <span className="relative z-10">Read Now</span>
                </button>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={() => router.push('/files')}
                    className="w-full py-2.5 bg-surface/80 backdrop-blur-xl hover:bg-surface-hover text-foreground border border-border-subtle rounded-xl font-bold text-xs sm:text-sm transition-all duration-200 shadow-xs"
                  >
                    Back to Library
                  </button>
                  <button
                    onClick={() => {
                      setResultUrl(null);
                      setSelectedFile(null);
                      setProgress(0);
                    }}
                    className="w-full py-2.5 bg-surface/80 backdrop-blur-xl hover:bg-surface-hover text-foreground-muted hover:text-foreground border border-border-subtle rounded-xl font-bold text-xs sm:text-sm transition-all duration-200 shadow-xs"
                  >
                    Upload Another
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
    </AppShell>
  );
}

export default FileUpload;
