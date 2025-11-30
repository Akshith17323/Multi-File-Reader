"use client";

import React, { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ePub, { Book, Rendition } from "epubjs";

function ReaderContent() {
  const searchParams = useSearchParams();
  const url = searchParams.get("url");

  const viewerRef = useRef<HTMLDivElement | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const bookRef = useRef<Book | null>(null);

  const [loading, setLoading] = useState(true);
  const [chapters, setChapters] = useState<{ label: string; href: string }[]>(
    []
  );
  const [error, setError] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<string>("");

  useEffect(() => {
    if (!url) {
      setError("Missing 'url' query parameter.");
      setLoading(false);
      return;
    }

    if (!viewerRef.current) return;

    let cancelled = false;

    const initBook = async () => {
      try {
        setLoading(true);

        // Create book from remote URL
        const book = ePub(url);
        bookRef.current = book;

        // Render into the viewer container
        const rendition = book.renderTo(viewerRef.current!, {
          width: "100%",
          height: "100%",
          spread: "auto",
          flow: "paginated",
        });

        renditionRef.current = rendition;

        // Display first section
        await rendition.display();

        // Get TOC (table of contents)
        const toc = await book.loaded.navigation;
        if (!cancelled && toc?.toc) {
          setChapters(
            toc.toc.map((item: any) => ({
              label: item.label,
              href: item.href,
            }))
          );
        }

        // Track current location (for display / future use)
        rendition.on(
          "relocated",
          (location: { start?: { cfi?: string } } | null) => {
            if (!location || !location.start || !location.start.cfi || cancelled)
              return;
            setCurrentLocation(location.start.cfi);
          }
        );

        if (!cancelled) setLoading(false);
      } catch (err: any) {
        console.error("Error initializing EPUB:", err);
        if (!cancelled) {
          setError(err.message || "Failed to load EPUB.");
          setLoading(false);
        }
      }
    };

    initBook();

    return () => {
      cancelled = true;
      try {
        renditionRef.current?.destroy();
        bookRef.current?.destroy();
      } catch {
        // ignore destroy errors
      }
    };
  }, [url]);

  const goNext = () => {
    renditionRef.current?.next();
  };

  const goPrev = () => {
    renditionRef.current?.prev();
  };

  const goToHref = (href: string) => {
    if (!bookRef.current || !renditionRef.current) return;

    // epub.js: display by href
    renditionRef.current.display(href).catch((err) => {
      console.error("Failed to navigate to chapter:", err);
    });
  };

  if (!url) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white shadow rounded-lg p-6">
          <p className="text-red-600">
            Missing file URL. Please open this page via the Files list.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white shadow">
        <div>
          <h1 className="text-xl font-semibold">EPUB Reader</h1>
          <p className="text-xs text-gray-500 truncate max-w-xl">
            {decodeURIComponent(url)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={goPrev}
            className="px-3 py-1 text-sm rounded-md bg-gray-200 hover:bg-gray-300"
          >
            ◀ Prev
          </button>
          <button
            onClick={goNext}
            className="px-3 py-1 text-sm rounded-md bg-gray-200 hover:bg-gray-300"
          >
            Next ▶
          </button>
        </div>
      </header>

      {/* Main layout: sidebar + reader */}
      <div className="flex flex-1 overflow-hidden">
        {/* TOC / Chapters */}
        <aside className="hidden md:block w-64 border-r bg-white overflow-y-auto">
          <div className="p-4 border-b">
            <h2 className="text-sm font-semibold">Chapters</h2>
          </div>
          <ul className="text-sm">
            {chapters.length === 0 && (
              <li className="px-4 py-3 text-gray-500">No TOC available.</li>
            )}
            {chapters.map((chapter) => (
              <li key={chapter.href}>
                <button
                  onClick={() => goToHref(chapter.href)}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100"
                >
                  {chapter.label || chapter.href}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Reader viewport */}
        <main className="flex-1 flex flex-col">
          {/* Status / error / loading */}
          <div className="border-b bg-white px-4 py-2 text-xs text-gray-500 flex justify-between">
            <span>
              {loading
                ? "Loading EPUB…"
                : error
                  ? `Error: ${error}`
                  : "Loaded"}
            </span>
            {currentLocation && (
              <span className="truncate max-w-[40%]">
                Location: {currentLocation}
              </span>
            )}
          </div>

          <div className="flex-1 p-4">
            <div
              ref={viewerRef}
              className="w-full h-full border rounded-md bg-white overflow-hidden"
            />
          </div>
        </main>
      </div>
    </div>
  );
}

export default function ReaderPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ReaderContent />
    </Suspense>
  );
}