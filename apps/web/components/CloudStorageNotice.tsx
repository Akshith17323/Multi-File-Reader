"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CloudOff, FolderOpen } from "lucide-react";
import { useEnvironment } from "@/hooks/useEnvironment";
import { CLOUD_STORAGE_ENABLED } from "@/config/serviceStatus";
import DesktopAppLink from "./DesktopAppLink";
import InlineNotice from "./ui/InlineNotice";

export default function CloudStorageNotice({ className = "", showAction = true, id }: { className?: string; showAction?: boolean; id?: string }) {
  const { isElectron: isDesktop } = useEnvironment();
  if (CLOUD_STORAGE_ENABLED) return null;

  return (
    <InlineNotice
      id={id}
      tone="warning"
      title="Cloud storage temporarily unavailable"
      icon={<CloudOff size={21} />}
      className={className}
      action={showAction ? (isDesktop
        ? <Link href="/fileupload" className="mfr-button-secondary"><FolderOpen size={16} aria-hidden="true" />Open local files</Link>
        : <DesktopAppLink />) : undefined}
    >
      <p>Cloud uploads and cloud file reading are currently paused. {isDesktop
        ? "You can continue reading files stored on your computer."
        : "For now, use the desktop app to read files stored on your computer."}</p>
      <p className="mt-1 text-xs text-foreground-muted">Local PDF, EPUB, and TXT reading works without an upload or sign-in.</p>
    </InlineNotice>
  );
}

export function CloudStorageBanner() {
  const pathname = usePathname();
  // The upload and reader screens place the notice next to the affected action.
  if (CLOUD_STORAGE_ENABLED || pathname === "/fileupload" || pathname === "/reader" || pathname?.startsWith("/reader/")) return null;

  return <div className="mx-auto mt-4 w-[calc(100%-2rem)] max-w-[1500px] shrink-0 sm:w-[calc(100%-3rem)] lg:w-[calc(100%-6rem)]"><CloudStorageNotice /></div>;
}
