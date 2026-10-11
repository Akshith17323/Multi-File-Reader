"use client";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { FileText, BookOpen, Layers, BookmarkCheck, Sparkles } from "lucide-react";

export default function Home() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col lg:flex-row items-center justify-center bg-background px-6 lg:px-20 overflow-hidden relative">
      {/* Ambient Blurred Glowing Orbs for Glassmorphism Depth */}
      <div className="absolute top-1/4 left-10 w-96 h-96 bg-primary/15 rounded-full blur-3xl pointer-events-none -z-0" />
      <div className="absolute bottom-1/4 right-10 w-[450px] h-[450px] bg-purple-600/15 rounded-full blur-3xl pointer-events-none -z-0" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-3xl pointer-events-none -z-0" />

      {/* Left Content Section */}
      <div className="flex-1 flex flex-col justify-center items-start space-y-8 max-w-2xl z-10 py-12">
        {/* Glassmorphic Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface backdrop-blur-2xl border border-border-subtle shadow-sm">
          <Sparkles size={16} className="text-primary animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-foreground-muted">
            All-In-One Document Reader
          </span>
        </div>

        <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight text-foreground leading-tight">
          Welcome to <br />
          <span className="bg-clip-text text-transparent bg-linear-to-r from-primary via-purple-500 to-blue-500 drop-shadow-[0_0_15px_var(--color-primary-glow)]">
            Multi File Reader
          </span>
        </h1>

        {/* Glassmorphic Content Card */}
        <div className="bg-surface/70 backdrop-blur-2xl border border-border-subtle rounded-3xl p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] space-y-4 max-w-xl">
          <p className="text-lg lg:text-xl text-foreground font-semibold leading-relaxed">
            Ever use multiple apps for reading different types of files and documents?
          </p>

          <p className="text-sm lg:text-base text-foreground-muted leading-relaxed">
            With us, you can read multiple file types in a single platform — clean, simple, and efficient.
          </p>

          {/* Quick Feature Badges */}
          <div className="pt-2 flex flex-wrap gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-hover/80 backdrop-blur-md border border-border-subtle text-xs font-semibold text-foreground">
              <FileText size={14} className="text-red-500" /> PDF
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-hover/80 backdrop-blur-md border border-border-subtle text-xs font-semibold text-foreground">
              <BookOpen size={14} className="text-green-500" /> EPUB
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-hover/80 backdrop-blur-md border border-border-subtle text-xs font-semibold text-foreground">
              <Layers size={14} className="text-blue-500" /> Multi-Tab
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-hover/80 backdrop-blur-md border border-border-subtle text-xs font-semibold text-foreground">
              <BookmarkCheck size={14} className="text-purple-500" /> Auto-Bookmarks
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mt-4 w-full sm:w-auto">
          <button
            onClick={() => router.push("/auth/login")}
            className="relative overflow-hidden px-8 py-3.5 bg-primary text-white rounded-2xl font-bold text-lg shadow-[0_8px_20px_var(--color-primary-glow)] hover:shadow-[0_12px_25px_var(--color-primary-glow)] hover:-translate-y-1 transition-all duration-300 w-full sm:w-auto group"
          >
            <span className="relative z-10">Login</span>
            <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </button>
          <button
            onClick={() => router.push("/auth/signup")}
            className="px-8 py-3.5 bg-surface backdrop-blur-2xl border border-border-subtle text-foreground rounded-2xl font-bold text-lg hover:border-primary/50 hover:bg-surface-hover hover:-translate-y-1 transition-all duration-300 w-full sm:w-auto shadow-sm"
          >
            Sign Up
          </button>
        </div>
      </div>

      {/* Right Image Section with Glassmorphic Frame */}
      <div className="flex-1 flex justify-center items-center mt-12 lg:mt-0 relative w-full h-[520px] z-10">
        {/* Frosted Glass Container Frame */}
        <div className="relative overflow-hidden rounded-3xl w-full h-full max-w-lg lg:max-w-xl mx-auto bg-surface/40 backdrop-blur-2xl border border-border-subtle shadow-2xl p-4 flex items-center justify-center">
          <div className="relative w-full h-full overflow-hidden rounded-2xl" style={{ clipPath: 'inset(0 0 12% 0)' }}>
            <Image
              src={`https://res.cloudinary.com/dgyrjxh05/image/upload/v1762949634/Gemini_Generated_Image_gx7d60gx7d60gx7d_mzqjup.png`}
              alt="Multi File Reader Illustration"
              fill
              priority
              loading="eager"
              className="object-contain drop-shadow-2xl relative z-10"
              unoptimized
            />
          </div>

          {/* Floating Glass Pill */}
          <div className="absolute bottom-6 right-6 z-20 px-4 py-2 bg-surface/90 backdrop-blur-2xl border border-border-subtle rounded-2xl shadow-xl flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-foreground">Syncs Across Devices</span>
          </div>
        </div>
      </div>
    </div>
  );
}