import type { ReactNode } from "react";
import { FileText, BookOpen, Layers, BookmarkCheck } from "lucide-react";

export function FormatCard({ icon, label, detail, color }: { icon: ReactNode; label: string; detail: string; color: string }) {
  return <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-border-subtle bg-surface-hover/65 p-3"><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border-subtle bg-background ${color}`}>{icon}</div><div className="min-w-0"><p className="text-sm font-bold text-foreground">{label}</p><p className="truncate text-[11px] text-foreground-muted">{detail}</p></div></div>;
}

export default function FormatShowcase() {
  return <section aria-label="Reader features" className="mfr-panel rounded-3xl p-5 sm:p-7"><p className="text-[11px] font-bold uppercase tracking-widest text-primary">One reader</p><h2 className="mb-5 text-xl font-bold text-foreground">Every file, one place</h2><div className="grid grid-cols-2 gap-3">
    <FormatCard icon={<FileText size={22} />} label="PDF" detail="Documents" color="text-red-500" />
    <FormatCard icon={<BookOpen size={22} />} label="EPUB" detail="Books" color="text-emerald-500" />
    <FormatCard icon={<FileText size={22} />} label="TXT" detail="Plain text" color="text-sky-500" />
    <FormatCard icon={<Layers size={22} />} label="Multi-tab" detail="Read together" color="text-violet-500" />
  </div><p className="mt-4 flex items-center gap-2 text-xs text-foreground-muted"><BookmarkCheck size={16} className="text-primary" />Your reading progress stays saved</p></section>;
}
