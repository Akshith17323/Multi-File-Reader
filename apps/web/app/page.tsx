"use client";
import { useRouter } from "next/navigation";
import { FileText, BookOpen, Layers, BookmarkCheck, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

function FormatCard({
  icon,
  label,
  detail,
  color,
}: {
  icon: ReactNode;
  label: string;
  detail: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface-hover/65 border border-border-subtle p-3 transition-colors duration-200 hover:bg-surface-hover">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background border border-border-subtle ${color}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-foreground">{label}</p>
        <p className="text-[11px] text-foreground-muted truncate">{detail}</p>
      </div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();

  return (
    <div className="min-h-screen lg:h-screen flex flex-col lg:flex-row items-center justify-center bg-background px-6 lg:px-12 py-4 lg:py-6 overflow-hidden relative">
      {/* Ambient Blurred Glowing Orbs for Glassmorphism Depth */}
      <div className="absolute top-1/4 left-10 w-80 h-80 bg-primary/15 rounded-full blur-3xl pointer-events-none -z-0" />
      <div className="absolute bottom-1/4 right-10 w-[400px] h-[400px] bg-purple-600/15 rounded-full blur-3xl pointer-events-none -z-0" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-3xl pointer-events-none -z-0" />

      <div className="w-full max-w-[1500px] mx-auto flex flex-col lg:flex-row items-center justify-between gap-8 z-10">
        {/* Left Content Section */}
        <div className="w-full lg:flex-1 flex flex-col justify-center items-start space-y-4 lg:space-y-5 max-w-xl">
          {/* Glassmorphic Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface/80 backdrop-blur-2xl border border-border-subtle shadow-xs">
            <Sparkles size={14} className="text-primary animate-pulse" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-foreground-muted">
              All-In-One Document Reader
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground leading-tight">
            Welcome to <br />
            <span className="bg-clip-text text-transparent bg-linear-to-r from-primary via-purple-500 to-blue-500 drop-shadow-[0_0_12px_var(--color-primary-glow)]">
              Multi File Reader
            </span>
          </h1>

          {/* Glassmorphic Content Card */}
          <div className="bg-surface/75 backdrop-blur-2xl border border-border-subtle rounded-2xl p-4 sm:p-5 shadow-sm space-y-3 w-full">
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
              className="relative overflow-hidden px-6 py-2.5 bg-primary text-white rounded-xl font-bold text-sm shadow-[0_4px_15px_var(--color-primary-glow)] hover:shadow-[0_8px_20px_var(--color-primary-glow)] hover:-translate-y-0.5 transition-all duration-200 group"
            >
              <span className="relative z-10">Login</span>
              <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            </button>
            <button
              onClick={() => router.push("/auth/signup")}
              className="px-6 py-2.5 bg-surface/80 backdrop-blur-2xl border border-border-subtle text-foreground rounded-xl font-bold text-sm hover:border-primary/50 hover:bg-surface-hover hover:-translate-y-0.5 transition-all duration-200 shadow-xs"
            >
              Sign Up
            </button>
          </div>
        </div>

        {/* Format showcase */}
        <div className="w-full lg:flex-1 flex justify-center items-center relative h-[360px] lg:h-[440px] shrink-0">
          <div className="relative w-full max-w-lg rounded-3xl bg-surface/65 backdrop-blur-2xl border border-border-subtle shadow-xl p-5 sm:p-7">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
                  One reader
                </p>
                <h2 className="text-lg sm:text-xl font-bold text-foreground">
                  Every file, one place
                </h2>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                <Layers size={20} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormatCard icon={<FileText size={22} />} label="PDF" detail="Documents" color="text-red-500" />
              <FormatCard icon={<BookOpen size={22} />} label="EPUB" detail="Books" color="text-emerald-500" />
              <FormatCard icon={<FileText size={22} />} label="TXT" detail="Plain text" color="text-sky-500" />
              <FormatCard icon={<Layers size={22} />} label="Multi-tab" detail="Read together" color="text-violet-500" />
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-xl bg-surface-hover/70 border border-border-subtle px-3 py-2.5">
              <BookmarkCheck size={16} className="text-primary shrink-0" />
              <span className="text-xs font-semibold text-foreground-muted">
                Your reading progress stays saved
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}