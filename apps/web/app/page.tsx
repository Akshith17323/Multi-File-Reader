"use client";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { FileText, BookOpen, Layers, BookmarkCheck, Sparkles } from "lucide-react";

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
        <div className="flex-1 flex flex-col justify-center items-start space-y-4 lg:space-y-5 max-w-xl">
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

        {/* Right Image Section with Glassmorphic Frame */}
        <div className="flex-1 flex justify-center items-center relative w-full h-[360px] lg:h-[440px]">
          {/* Frosted Glass Container Frame */}
          <div className="relative overflow-hidden rounded-2xl w-full h-full max-w-md lg:max-w-lg bg-surface/40 backdrop-blur-2xl border border-border-subtle shadow-xl p-3 flex items-center justify-center">
            <div className="relative w-full h-full overflow-hidden rounded-xl" style={{ clipPath: 'inset(0 0 12% 0)' }}>
              <Image
                src={`https://res.cloudinary.com/dgyrjxh05/image/upload/v1762949634/Gemini_Generated_Image_gx7d60gx7d60gx7d_mzqjup.png`}
                alt="Multi File Reader Illustration"
                fill
                priority
                loading="eager"
                className="object-contain drop-shadow-xl relative z-10"
                unoptimized
              />
            </div>

            {/* Floating Glass Pill */}
            <div className="absolute bottom-4 right-4 z-20 px-3 py-1.5 bg-surface/90 backdrop-blur-2xl border border-border-subtle rounded-xl shadow-md flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-bold text-foreground">Syncs Across Devices</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}