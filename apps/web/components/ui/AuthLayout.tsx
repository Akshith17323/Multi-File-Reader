import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import AppShell from "./AppShell";
import Brand from "./Brand";
import FormatShowcase from "./FormatShowcase";
import ThemeToggle from "../ThemeToggle";

export default function AuthLayout({
  children,
  title,
  description,
}: {
  children: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <AppShell standalone className="mfr-auth-page" contentClassName="mfr-auth-content flex flex-col">
      <div className="flex items-center justify-between gap-4">
        <Brand />
        <ThemeToggle />
      </div>
      <div className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-2 lg:gap-20 lg:py-12">
        <div className="hidden max-w-xl space-y-6 lg:block">
          <div className="mfr-eyebrow"><Sparkles size={14} className="text-primary" />All-in-one document reader</div>
          <h2 className="text-4xl font-extrabold leading-tight tracking-tight text-foreground xl:text-5xl">
            Every document.<br /><span className="mfr-gradient-text">One place to read.</span>
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-foreground-muted">
            Keep your books and documents together. Read across formats, open multiple tabs, and pick up where you left off.
          </p>
          <FormatShowcase className="max-w-lg" />
        </div>
        <div className="mx-auto w-full max-w-md">
          <Link href="/" className="mb-6 inline-flex items-center gap-2 rounded-lg text-xs font-semibold text-foreground-muted transition-colors hover:text-primary">
            <ArrowLeft size={14} />Back to home
          </Link>
          <section className="mfr-panel rounded-3xl p-6 shadow-xl sm:p-8">
            <header className="mb-6 space-y-2">
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{title}</h1>
              <p className="text-sm leading-relaxed text-foreground-muted">{description}</p>
            </header>
            {children}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
