"use client";
import React, { useRef, useState } from "react";
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, File, X, Sparkles, BookOpen, ArrowLeft, Layers } from "lucide-react";
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
    if (!selectedFile) return <Upload size={32} className="text-primary" />;
    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return <FileText size={32} className="text-red-500" />;
    if (ext === 'epub') return <FileText size={32} className="text-green-500" />;
    return <FileText size={32} className="text-blue-500" />;
  };

  const getReaderUrl = (url: string) => {
    return `/reader?files=${encodeURIComponent(url)}&active=0`;
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background relative px-4 sm:px-6 py-8 overflow-hidden">
      {/* Ambient Blurred Glowing Orbs for Glassmorphism Depth */}
      <div className="absolute top-1/4 left-10 w-80 h-80 bg-primary/15 rounded-full blur-3xl pointer-events-none -z-0" />
      <div className="absolute bottom-1/4 right-10 w-[400px] h-[400px] bg-purple-600/15 rounded-full blur-3xl pointer-events-none -z-0" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-3xl pointer-events-none -z-0" />

      <div className="w-full max-w-xl relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <button
          onClick={() => router.push('/files')}
          className="group mb-5 px-3.5 py-1.5 bg-surface/70 backdrop-blur-2xl border border-border-subtle rounded-xl text-foreground-muted hover:text-foreground hover:bg-surface-hover hover:border-primary/40 inline-flex items-center gap-2 transition-all duration-300 font-semibold text-xs tracking-wide shadow-xs"
        >
          <div className="w-6 h-6 rounded-full bg-surface-hover/80 border border-border-subtle flex items-center justify-center group-hover:border-primary transition-colors text-xs">
            <ArrowLeft size={12} />
          </div>
          Back to Library
        </button>

        {/* Header with Glassmorphic Badge */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface/80 backdrop-blur-2xl border border-border-subtle shadow-xs mb-3">
            <Sparkles size={14} className="text-primary animate-pulse" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-foreground-muted">
              Document Ingestion
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground mb-2">
            Add to{" "}
            <span className="bg-clip-text text-transparent bg-linear-to-r from-primary via-purple-500 to-blue-500 drop-shadow-[0_0_12px_var(--color-primary-glow)]">
              Collection
            </span>
          </h1>
          <p className="text-foreground-muted text-xs sm:text-sm">
            Upload documents to your secure, unified digital library
          </p>
        </div>

        <div className="bg-surface/75 backdrop-blur-2xl rounded-3xl p-6 sm:p-8 shadow-xl border border-border-subtle">
          {!resultUrl ? (
            <form onSubmit={uploadFile} className="space-y-5">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`
                  relative border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition-all duration-300 ease-in-out
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
                        <p className="text-base font-bold text-foreground mb-0.5 truncate max-w-sm">{selectedFile.name}</p>
                        <p className="text-xs text-primary font-bold">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-sm sm:text-base font-bold text-foreground">Drop your document here</p>
                        <p className="text-xs text-foreground-muted">or click to browse your local device</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Supported format pills - mirroring landing page formats */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-surface-hover/50 border border-border-subtle">
                  <div className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center shrink-0">
                    <FileText size={14} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground leading-none">PDF</p>
                    <p className="text-[10px] text-foreground-muted truncate mt-0.5">Documents</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-surface-hover/50 border border-border-subtle">
                  <div className="w-7 h-7 rounded-lg bg-green-500/10 border border-green-500/20 text-green-500 flex items-center justify-center shrink-0">
                    <BookOpen size={14} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground leading-none">EPUB</p>
                    <p className="text-[10px] text-foreground-muted truncate mt-0.5">E-Books</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-surface-hover/50 border border-border-subtle">
                  <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center shrink-0">
                    <Layers size={14} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground leading-none">TXT</p>
                    <p className="text-[10px] text-foreground-muted truncate mt-0.5">Plain text</p>
                  </div>
                </div>
              </div>

              {progress > 0 && progress < 100 && (
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
                  disabled={!selectedFile || (progress > 0 && progress < 100)}
                  className="flex-1 relative overflow-hidden py-3 px-5 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-sm shadow-[0_4px_15px_var(--color-primary-glow)] hover:shadow-[0_8px_20px_var(--color-primary-glow)] hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2 group"
                >
                  <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                  {progress > 0 && progress < 100 ? (
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
                {isElectron() && (
                  <button
                    type="button"
                    onClick={handleLocalBook}
                    disabled={progress > 0 && progress < 100}
                    className="sm:flex-1 py-3 px-5 bg-surface/80 backdrop-blur-xl hover:bg-surface-hover text-foreground border border-border-subtle rounded-xl font-bold text-sm hover:border-primary/40 hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2 shadow-xs"
                  >
                    <File size={18} className="text-primary" />
                    <span>Add Local Book</span>
                  </button>
                )}
              </div>
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
                  className="w-full relative overflow-hidden py-3 bg-primary text-white rounded-xl font-bold text-sm shadow-[0_4px_15px_var(--color-primary-glow)] hover:shadow-[0_8px_20px_var(--color-primary-glow)] hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-2 group"
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
      </div>
    </div>
  );
}

export default FileUpload;

