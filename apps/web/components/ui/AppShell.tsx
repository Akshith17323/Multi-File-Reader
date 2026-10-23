import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";

export function AmbientBackground() {
  return <div aria-hidden="true" className="mfr-ambient"><div className="mfr-orb mfr-orb-indigo" /><div className="mfr-orb mfr-orb-purple" /><div className="mfr-orb mfr-orb-blue" /></div>;
}

export default function AppShell({ children, className = "", contentClassName = "", standalone = false }: {
  children: ReactNode; className?: string; contentClassName?: string; standalone?: boolean;
}) {
  return <main className={`mfr-page ${standalone ? "mfr-page-standalone" : ""} ${className}`}><AmbientBackground /><div className={`mfr-page-content ${contentClassName}`}>{children}</div></main>;
}

export function PageHeader({ eyebrow, title, accent, description, action, className = "" }: {
  eyebrow: string; title: string; accent: string; description: string; action?: ReactNode; className?: string;
}) {
  return <header className={`flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between ${className}`}>
    <div className="min-w-0 space-y-3"><div className="mfr-eyebrow"><Sparkles size={14} className="text-primary" />{eyebrow}</div><h1 className="mfr-page-title">{title} <span className="mfr-gradient-text">{accent}</span></h1><p className="max-w-lg text-sm leading-relaxed text-foreground-muted">{description}</p></div>
    {action && <div className="shrink-0">{action}</div>}
  </header>;
}
