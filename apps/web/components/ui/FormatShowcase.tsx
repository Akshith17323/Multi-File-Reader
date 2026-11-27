import { FileText, BookOpen, Layers, BookmarkCheck } from "lucide-react";
import type { ReactNode } from "react";

export function FormatCard({
  icon,
  label,
  detail,
  color = "text-foreground",
}: {
  icon: ReactNode;
  label: string;
  detail: string;
  color?: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-border-subtle bg-surface-hover/65 p-3 transition-colors hover:bg-surface-hover">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-background ${color}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="truncate text-xs text-foreground-muted">{detail}</p>
      </div>
    </div>
  );
}

export default function FormatShowcase({ className = "" }: { className?: string }) {
  return (
    <section aria-label="Reader features" className={`mfr-panel rounded-2xl p-5 shadow-xl sm:p-7 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-primary">Supported formats</p>
          <h2 className="text-base font-semibold text-foreground sm:text-lg">Every document, one place</h2>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
          <Layers size={20} aria-hidden="true" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormatCard icon={<FileText size={20} />} label="PDF" detail="Documents" color="text-foreground" />
        <FormatCard icon={<BookOpen size={20} />} label="EPUB" detail="Books" color="text-foreground" />
        <FormatCard icon={<FileText size={20} />} label="TXT" detail="Plain text" color="text-foreground" />
        <FormatCard icon={<Layers size={20} />} label="Multi-tab" detail="Read together" color="text-foreground" />
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-hover/70 px-3 py-2.5">
        <BookmarkCheck size={16} className="shrink-0 text-primary" aria-hidden="true" />
        <span className="text-xs font-medium text-foreground-muted">Your reading progress stays saved</span>
      </div>
    </section>
  );
}
