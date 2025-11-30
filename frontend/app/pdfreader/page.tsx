"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";

const PDFViewer = dynamic(() => import("../../components/PDFViewer"), { ssr: false });

function PDFReaderContent() {
  const searchParams = useSearchParams();
  const rawUrl = searchParams.get("url");
  const url = rawUrl ? decodeURIComponent(rawUrl) : null;

  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  // Fetch blob (GCS fix)
  useEffect(() => {
    if (!url) return;

    fetch(url)
      .then((res) => res.blob())
      .then((blob) => {
        const local = URL.createObjectURL(blob);
        setBlobUrl(local);
      })
      .catch((err) => console.error("PDF fetch error:", err));
  }, [url]);

  if (!url) return <p>No URL provided</p>;

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {blobUrl && <PDFViewer blobUrl={blobUrl} title="PDF Reader" />}
    </div>
  );
}

export default function PDFReaderPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PDFReaderContent />
    </Suspense>
  );
}