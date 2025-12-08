"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";

const PDFViewer = dynamic(() => import("../../../components/PDFViewer"), { ssr: false });

function PDFReaderContent() {
  const searchParams = useSearchParams();
  const rawUrl = searchParams.get("url");
  const url = rawUrl ? decodeURIComponent(rawUrl) : null;
  const id = searchParams.get("id");

  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!url) return;

    const proxiedUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/proxy?url=${encodeURIComponent(url)}`;
    fetch(proxiedUrl)
      .then((res) => res.blob())
      .then((blob) => {
        const local = URL.createObjectURL(blob);
        setBlobUrl(local);
      })
      .catch((err) => console.error("❌ PDF fetch error:", err));
  }, [url]);

  if (!url) return <p>No URL provided</p>;

  return (
    <div className="h-[100dvh] flex flex-col bg-gray-100">
      {blobUrl && <PDFViewer blobUrl={blobUrl} fileUrl={url || undefined} />}
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