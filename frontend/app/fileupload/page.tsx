"use client";
import React, { useRef, useState } from "react";
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, File } from "lucide-react";
import { useRouter } from "next/navigation";

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

    const fd = new FormData();
    fd.append("UploadingFile", selectedFile);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", uploadEndpoint);

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const body = JSON.parse(xhr.responseText);
          setResultUrl(body.url || null);
        } catch {
          setError("Upload succeeded but response parsing failed");
        }
      } else {
        setError(`Upload failed: ${xhr.status} ${xhr.statusText}`);
      }
    };

    xhr.onerror = () => setError("Network/error during upload");
    // xhr.send(fd);
  };

  const getFileIcon = () => {
    if (!selectedFile) return <Upload size={48} className="text-gray-400" />;
    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return <FileText size={48} className="text-red-500" />;
    if (ext === 'epub') return <FileText size={48} className="text-green-500" />;
    return <FileText size={48} className="text-blue-500" />;
  };

  const getReaderUrl = (url: string) => {
    if (url.endsWith('.pdf')) return `/reader/pdfreader?url=${encodeURIComponent(url)}`;
    if (url.endsWith('.epub')) return `/reader/epubreader?url=${encodeURIComponent(url)}`;
    return url; // Fallback
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-black relative overflow-hidden px-4">
      {/* Background Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-violet-600/30 rounded-full blur-[120px] animate-pulse mix-blend-screen" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-fuchsia-600/30 rounded-full blur-[120px] animate-pulse delay-1000 mix-blend-screen" />

      <div className="w-full max-w-xl relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400 mb-2">
            Upload Your File
          </h1>
          <p className="text-gray-400">Supported formats: PDF, EPUB, TXT</p>
        </div>

        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          {!resultUrl ? (
            <form onSubmit={uploadFile} className="space-y-6">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`
                  relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300
                  ${isDragging
                    ? "border-blue-500 bg-blue-500/10 scale-105"
                    : "border-gray-600 hover:border-gray-500 hover:bg-white/5"
                  }
                  ${selectedFile ? "border-green-500/50 bg-green-500/5" : ""}
                `}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.epub,.txt"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileSelection(e.target.files[0])}
                />

                <div className="flex flex-col items-center gap-4">
                  <div className={`p-4 rounded-full bg-white/5 transition-transform duration-300 ${isDragging ? "scale-110" : ""}`}>
                    {getFileIcon()}
                  </div>

                  <div>
                    {selectedFile ? (
                      <>
                        <p className="text-lg font-semibold text-white">{selectedFile.name}</p>
                        <p className="text-sm text-gray-400">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      </>
                    ) : (
                      <>
                        <p className="text-lg font-semibold text-white">Drag & drop or click to upload</p>
                        <p className="text-sm text-gray-400">Maximum file size: 50MB</p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {progress > 0 && progress < 100 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-gray-400">
                    <span>Uploading...</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-xl flex items-center gap-3 text-red-400">
                  <AlertCircle size={20} />
                  <p className="text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={!selectedFile || (progress > 0 && progress < 100)}
                className="w-full py-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-violet-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
              >
                {progress > 0 && progress < 100 ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload size={20} />
                    <span>Upload File</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="text-center space-y-6 py-8">
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 size={40} className="text-green-500" />
              </div>

              <div>
                <h2 className="text-2xl font-bold text-white mb-2">Upload Complete!</h2>
                <p className="text-gray-400">Your file is ready to read</p>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => router.push(getReaderUrl(resultUrl))}
                  className="w-full py-4 bg-white text-black rounded-xl font-bold text-lg shadow-lg hover:bg-gray-100 hover:scale-[1.02] transition-all duration-300"
                >
                  Read Now
                </button>
                <button
                  onClick={() => {
                    setResultUrl(null);
                    setSelectedFile(null);
                    setProgress(0);
                  }}
                  className="w-full py-4 bg-white/5 text-white border border-white/10 rounded-xl font-bold text-lg hover:bg-white/10 transition-all duration-300"
                >
                  Upload Another
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default FileUpload;
