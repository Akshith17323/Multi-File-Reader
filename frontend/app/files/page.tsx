"use client";

import React, { useEffect, useState } from "react";

interface GCSFile {
  name: string;
  metadata?: {
    size?: string;
    updated?: string;
    contentType?: string;
  };
  url?: string; // In case backend provides signed/public URL
}

export default function FilesPage() {
  const [files, setFiles] = useState<GCSFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchFiles() {
      try {
        const filesEndpoint =
          (process.env.NEXT_PUBLIC_FILES_URL as string) ||
          "http://localhost:2007/files";

        const res = await fetch(filesEndpoint);

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(
            `Failed to load files: ${res.status} ${res.statusText} ${text}`
          );
        }

        const data = await res.json();

        if (!Array.isArray(data)) {
          throw new Error("Unexpected response shape (expected array).");
        }

        setFiles(data);
      } catch (err: any) {
        console.error("Error loading files:", err);
        setError(err.message || String(err));
      } finally {
        setLoading(false);
      }
    }

    fetchFiles();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center py-12 px-4">
      <div className="w-full max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-semibold">Stored Files</h1>
          <div className="text-sm text-gray-600">Total: {files.length}</div>
        </div>

        {loading ? (
          <div className="bg-white shadow rounded-lg p-6">
            <p className="text-lg">Loading…</p>
          </div>
        ) : error ? (
          <div className="bg-white shadow rounded-lg p-6">
            <div className="text-red-600">Error: {error}</div>
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg">
            <div className="p-4 border-b">
              <div className="text-sm text-gray-600">
                Browse uploaded files stored in the bucket
              </div>
            </div>

            <div className="p-4 overflow-x-auto">
              {files.length === 0 ? (
                <p className="text-gray-700">No files found.</p>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        File Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Size
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Last Updated
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody className="bg-white divide-y divide-gray-200">
                    {files.map((file) => {
                      const sizeBytes = parseInt(file.metadata?.size ?? "0", 10);
                      const sizeDisplay =
                        !Number.isNaN(sizeBytes)
                          ? `${(sizeBytes / 1024 / 1024).toFixed(2)} MB`
                          : "-";

                      const updatedDateRaw = file.metadata?.updated;
                      const updatedDate = updatedDateRaw
                        ? new Date(updatedDateRaw)
                        : null;
                      const updatedDisplay =
                        updatedDate && !isNaN(updatedDate.getTime())
                          ? updatedDate.toLocaleString()
                          : "-";

                      // URL: prefer backend URL, else construct GCS public URL
                      const bucket =
                        process.env.NEXT_PUBLIC_GCS_BUCKET ||
                        "multi-file-reader-storage";

                      const publicUrl =
                        file.url ||
                        `https://storage.googleapis.com/${encodeURIComponent(
                          bucket as string
                        )}/${encodeURIComponent(file.name)}`;

                      return (
                        <tr key={file.name} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap max-w-xs">
                            <div className="text-sm font-medium text-gray-900 truncate">
                              {file.name}
                            </div>
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {sizeDisplay}
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {updatedDisplay}
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <a
                              href={publicUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center px-3 py-1 bg-blue-600 text-white rounded-md mr-2"
                            >
                              View
                            </a>

                            <a
                              href={publicUrl}
                              download
                              className="inline-flex items-center px-3 py-1 bg-gray-200 text-gray-700 rounded-md"
                            >
                              Download
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

