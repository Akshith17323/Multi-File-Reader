"use client";

import React, { useState, useCallback } from "react";
import { unzipSync } from "fflate";

export default function CBZReader() {
  const [pages, setPages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = (file: File | undefined) => {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".cbz")) {
      alert("Please upload a .cbz file");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      setLoading(true);
      try {
        const buffer = new Uint8Array(reader.result as ArrayBuffer);
        const files = unzipSync(buffer); // returns Record<string, Uint8Array>

        const imageFiles = Object.entries(files)
          .filter(([name]) => /\.(jpe?g|png)$/i.test(name))
          .sort(([a], [b]) => a.localeCompare(b));

        const imageUrls = imageFiles.map(([_, data]) => {
          const blob = new Blob([data], { type: "image/jpeg" });
          return URL.createObjectURL(blob);
        });

        setPages(imageUrls);
      } catch (err) {
        alert("Error reading CBZ file.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    handleFile(file);
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const file = e.dataTransfer.files?.[0];
    handleFile(file);
  }, []);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  return (
    <div
      className="min-h-screen bg-gray-900 text-white p-4"
      style={{ fontFamily: "sans-serif" }}
    >
      <h1 className="text-2xl font-bold mb-4">📖 Next.js CBZ Comic Reader</h1>

      {/* Drag & Drop Area */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`border-2 border-dashed rounded-lg p-6 mb-4 transition-all duration-200 ${
          dragOver ? "border-blue-400 bg-gray-800" : "border-gray-600"
        }`}
      >
        <p className="text-center text-lg">
          {dragOver ? "📥 Drop the CBZ file here" : "🖱️ Drag & drop a .cbz file here"}
        </p>
      </div>

      {/* File Input */}
      <input
        type="file"
        accept=".cbz"
        onChange={handleFileInputChange}
        className="mb-6 text-black"
      />

      {loading && <p className="text-yellow-300">Loading comic...</p>}

      {/* Comic Pages */}
      <div className="space-y-4">
        {pages.map((url, i) => (
          <img
            key={i}
            src={url}
            alt={`Page ${i + 1}`}
            className="w-full rounded shadow-lg"
          />
        ))}
      </div>
    </div>
  );
}