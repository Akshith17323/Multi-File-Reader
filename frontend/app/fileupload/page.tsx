"use client";
import React, { useRef, useState } from "react";
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function FileUpload() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [progress, setProgress] = useState(0);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const router = useRouter();
  const uploadEndpoint = `${process.env.NEXT_PUBLIC_BACKEND_URL}/fileUpload`;

  const handleFile = (file?: File) => {
    if (!file) return;
    setError(null);
    setResultUrl(null);
    setProgress(0);

    const isValid = ['.pdf', '.epub', '.txt'].some(ext => file.name.toLowerCase().endsWith(ext));
    if (!isValid) {
      setError("Invalid file type. Please upload PDF, EPUB, or TXT files.");
      return;
    }
    setSelectedFile(file);
  };

  const uploadFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return setError("No file selected");
    
    const token = localStorage.getItem("token");
    if (!token) return setError("Please login to upload files");

    const fd = new FormData();
    fd.append("UploadingFile", selectedFile);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", uploadEndpoint);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (ev) => ev.lengthComputable && setProgress(Math.round((ev.loaded / ev.total) * 100));

    xhr.onload = () => {
      try {
        const body = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          setResultUrl(body.url || null);
        } else {
          setError(body.error || body.message || `Upload failed: ${xhr.status}`);
        }
      } catch {
        setError(`Upload failed: ${xhr.status} ${xhr.statusText}`);
      }
    };
    xhr.onerror = () => setError("Network error during upload");
    xhr.send(fd);
  };

  const resetState = () => {
    setResultUrl(null);
    setSelectedFile(null);
    setProgress(0);
  };

  // ---------------------------------------------------------------------------
  // Success State UI
  // ---------------------------------------------------------------------------
  if (resultUrl) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background relative px-6 py-20">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="w-full max-w-2xl relative z-10 bg-surface rounded-3xl p-10 shadow-2xl border border-border-subtle text-center space-y-8 animate-in fade-in zoom-in duration-500">
          <div className="w-24 h-24 bg-green-950 border-2 border-green-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_30px_rgba(34,197,94,0.2)]">
            <CheckCircle2 size={48} className="text-green-500" />
          </div>
          <div>
            <h2 className="text-3xl font-extrabold text-foreground mb-3">Upload Successful</h2>
            <p className="text-foreground-muted text-lg">"{selectedFile?.name}" has been added to your library.</p>
          </div>
          <div className="flex flex-col gap-4 pt-4">
            <button onClick={() => router.push('/files')} className="w-full py-4 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-300">
              Return to Library
            </button>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => router.push(`/reader?files=${encodeURIComponent(resultUrl)}&active=0`)} className="w-full py-4 bg-background hover:bg-surface-hover text-foreground border border-border-subtle rounded-xl font-bold text-lg transition-all duration-300">
                Read Now
              </button>
              <button onClick={resetState} className="w-full py-4 bg-background hover:bg-surface-hover text-foreground-muted hover:text-foreground border border-border-subtle rounded-xl font-bold text-lg transition-all duration-300">
                Upload Another
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Upload Form UI
  // ---------------------------------------------------------------------------
  const ext = selectedFile?.name.split('.').pop()?.toLowerCase();
  const IconColor = ext === 'pdf' ? 'text-red-500' : ext === 'epub' ? 'text-green-500' : 'text-blue-500';

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background relative px-6 py-20">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-2xl relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-500">
        <button onClick={() => router.push('/files')} className="group mb-10 text-foreground-muted hover:text-foreground flex items-center gap-2 transition-colors font-bold text-sm tracking-wide">
          <div className="w-8 h-8 rounded-full border border-border-subtle flex items-center justify-center group-hover:border-foreground transition-colors">←</div>
          Back to Library
        </button>

        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-extrabold text-foreground mb-3 tracking-tight">Add to Collection</h1>
          <p className="text-foreground-muted text-base">Upload documents to your secure digital library</p>
        </div>

        <div className="bg-surface rounded-3xl p-10 shadow-2xl border border-border-subtle">
          <form onSubmit={uploadFile} className="space-y-8">
            <div
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={e => { e.preventDefault(); setIsDragging(false); }}
              onDrop={e => { e.preventDefault(); setIsDragging(false); handleFile(e.dataTransfer.files?.[0]); }}
              onClick={() => fileRef.current?.click()}
              className={`relative border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all duration-300
                ${isDragging ? "border-primary bg-primary/10 scale-[1.02]" : "border-border-subtle hover:border-primary hover:bg-surface-hover bg-background"}
                ${selectedFile ? "border-primary/50 bg-primary/5" : ""}
              `}
            >
              <input ref={fileRef} type="file" accept=".pdf,.epub,.txt" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />

              <div className="flex flex-col items-center gap-6">
                <div className={`p-6 rounded-2xl bg-surface border border-border-subtle shadow-xl transition-transform duration-300 ${isDragging ? "scale-110 rotate-3" : ""}`}>
                  {selectedFile ? <FileText size={48} className={IconColor} /> : <Upload size={48} className="text-gray-400" />}
                </div>

                {selectedFile ? (
                  <div className="animate-in fade-in zoom-in duration-300">
                    <p className="text-2xl font-bold text-foreground mb-1">{selectedFile.name}</p>
                    <p className="text-base text-primary font-medium">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xl font-bold text-foreground">Drop your file here</p>
                    <p className="text-foreground-muted">or click to browse supports PDF, EPUB, TXT</p>
                  </div>
                )}
              </div>
            </div>

            {progress > 0 && progress < 100 && (
              <div className="space-y-3">
                <div className="flex justify-between text-sm font-medium text-foreground-muted">
                  <span>Uploading...</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-3 bg-background rounded-full overflow-hidden border border-border-subtle">
                  <div className="h-full bg-primary transition-all duration-300 shadow-[0_0_10px_rgba(52,211,153,0.5)]" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            {error && (
              <div className="p-5 bg-red-900/20 border border-red-500/30 rounded-xl flex items-center gap-4 text-red-500">
                <AlertCircle size={24} className="shrink-0" />
                <p className="font-medium">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={!selectedFile || (progress > 0 && progress < 100)}
              className="w-full py-5 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3"
            >
              {progress > 0 && progress < 100 ? (
                <><Loader2 className="animate-spin" size={24} /><span>Processing...</span></>
              ) : (
                <><Upload size={24} /><span>Start Upload</span></>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
