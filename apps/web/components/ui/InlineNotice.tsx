import type { ReactNode } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

export interface NoticeMessage {
  tone: "info" | "success" | "warning" | "error";
  message: string;
}

const icons = { info: Info, success: CheckCircle2, warning: AlertTriangle, error: AlertCircle };

export default function InlineNotice({
  tone = "info",
  title,
  children,
  icon,
  action,
  onDismiss,
  className = "",
  id,
}: {
  tone?: NoticeMessage["tone"];
  title?: string;
  children: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  onDismiss?: () => void;
  className?: string;
  id?: string;
}) {
  const Icon = icons[tone];

  return (
    <div id={id} role={tone === "error" ? "alert" : "status"} aria-atomic="true" data-tone={tone} className={`mfr-notice ${className}`}>
      <span aria-hidden="true" className="mfr-notice-icon mt-0.5 shrink-0">{icon || <Icon size={20} />}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
        <div className="min-w-0">
          {title && <p className="mb-1 text-sm font-semibold">{title}</p>}
          <div className="text-sm leading-relaxed">{children}</div>
        </div>
        {action && <div className="shrink-0 self-start sm:self-center">{action}</div>}
      </div>
      {onDismiss && <button type="button" onClick={onDismiss} aria-label="Dismiss message" className="mfr-icon-button -m-1 h-8 w-8"><X size={16} /></button>}
    </div>
  );
}
