import { ArrowUpRight, Monitor } from "lucide-react";
import { DESKTOP_APP_URL } from "@/config/serviceStatus";

export default function DesktopAppLink({ className = "mfr-button-secondary" }: { className?: string }) {
  return (
    <a href={DESKTOP_APP_URL} target="_blank" rel="noopener noreferrer" className={className}>
      <Monitor size={16} aria-hidden="true" />Desktop app setup<ArrowUpRight size={14} aria-hidden="true" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
