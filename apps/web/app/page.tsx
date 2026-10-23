"use client";
import { useRouter } from "next/navigation";
import { FileText, BookOpen, Layers, BookmarkCheck, Sparkles } from "lucide-react";
import AppShell from "@/components/ui/AppShell";
import FormatShowcase from "@/components/ui/FormatShowcase";

export default function Home() {
  const router = useRouter();

  return (
    <AppShell className="flex items-center" contentClassName="flex flex-col items-center justify-between gap-10 lg:flex-row lg:gap-12">
      {/* Left Content Section */}
      <div className="w-full lg:flex-1 flex flex-col justify-center items-start space-y-4 lg:space-y-5 max-w-xl">
        {/* Glassmorphic Badge */}
        <div className="mfr-eyebrow">
          <Sparkles size={14} className="text-primary" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-foreground-muted">
            All-In-One Document Reader
          </span>
        </div>

        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground leading-tight">
          Welcome to <br />
          <span className="mfr-gradient-text">
            Multi File Reader
          </span>
        </h1>

        {/* Glassmorphic Content Card */}
        <div className="mfr-panel rounded-2xl p-4 sm:p-5 shadow-sm space-y-3 w-full">
          <p className="text-sm sm:text-base text-foreground font-semibold leading-snug">
            Ever use multiple apps for reading different types of files and documents?
          </p>

          <p className="text-xs sm:text-sm text-foreground-muted leading-relaxed">
            With us, you can read multiple file types in a single platform — clean, simple, and efficient.
          </p>

          {/* Quick Feature Badges */}
          <div className="pt-1 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-hover/80 backdrop-blur-md border border-border-subtle text-xs font-semibold text-foreground">
              <FileText size={13} className="text-red-500" /> PDF
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-hover/80 backdrop-blur-md border border-border-subtle text-xs font-semibold text-foreground">
              <BookOpen size={13} className="text-green-500" /> EPUB
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-hover/80 backdrop-blur-md border border-border-subtle text-xs font-semibold text-foreground">
              <Layers size={13} className="text-blue-500" /> Multi-Tab
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-hover/80 backdrop-blur-md border border-border-subtle text-xs font-semibold text-foreground">
              <BookmarkCheck size={13} className="text-purple-500" /> Auto-Bookmarks
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-row gap-3 pt-1 w-full sm:w-auto">
          <button
            onClick={() => router.push("/auth/login")}
            className="mfr-button-primary px-6"
          >
            Login
          </button>
          <button
            onClick={() => router.push("/auth/signup")}
            className="mfr-button-secondary px-6"
          >
            Sign Up
          </button>
        </div>
      </div>

      <div className="flex w-full justify-center lg:flex-1">
        <FormatShowcase className="w-full max-w-lg" />
      </div>
    </AppShell>
  );
}
