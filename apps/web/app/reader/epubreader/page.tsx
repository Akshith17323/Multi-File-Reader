"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function EPUBReaderRedirect() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawUrl = searchParams.get("url");

  useEffect(() => {
    if (rawUrl) {
      const decodedUrl = decodeURIComponent(rawUrl);
      router.replace(`/reader?files=${encodeURIComponent(decodedUrl)}&active=0`);
    } else {
      router.replace("/files");
    }
  }, [rawUrl, router]);

  return (
    <div className="h-screen flex items-center justify-center bg-background text-foreground">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-foreground-muted">Opening in unified reader...</p>
      </div>
    </div>
  );
}

export default function EPUBReaderPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen bg-background flex items-center justify-center text-foreground">
          Loading Reader...
        </div>
      }
    >
      <EPUBReaderRedirect />
    </Suspense>
  );
}