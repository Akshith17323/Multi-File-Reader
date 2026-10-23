import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AppShell from "./AppShell";
import Brand from "./Brand";
import FormatShowcase from "./FormatShowcase";
import ThemeToggle from "../ThemeToggle";

export default function AuthLayout({ children, title, description }: { children: ReactNode; title: string; description: string }) {
  return <AppShell standalone contentClassName="flex flex-col"><div className="flex items-center justify-between"><Brand /><ThemeToggle /></div><div className="grid items-center gap-12 py-10 lg:grid-cols-2 lg:py-16">
    <div className="hidden max-w-xl space-y-6 lg:block"><h2 className="text-5xl font-extrabold leading-tight tracking-tight">Every document.<br /><span className="mfr-gradient-text">One place to read.</span></h2><p className="text-sm leading-relaxed text-foreground-muted">Read across formats, open multiple tabs, and pick up where you left off.</p><FormatShowcase /></div>
    <div className="mx-auto w-full max-w-md"><Link href="/" className="mb-6 inline-flex items-center gap-2 text-xs text-foreground-muted"><ArrowLeft size={14} />Back to home</Link><section className="mfr-panel rounded-3xl p-6 shadow-xl sm:p-8"><header className="mb-6 space-y-2"><h1 className="text-3xl font-extrabold tracking-tight">{title}</h1><p className="text-sm text-foreground-muted">{description}</p></header>{children}</section></div>
  </div></AppShell>;
}
