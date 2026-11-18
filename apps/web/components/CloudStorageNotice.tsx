"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CloudOff, FolderOpen } from "lucide-react";
import { useEnvironment } from "@/hooks/useEnvironment";
import { CLOUD_STORAGE_ENABLED, CLOUD_UPLOAD_DEPRECATION_MESSAGE } from "@/config/serviceStatus";
import DesktopAppLink from "./DesktopAppLink";
import InlineNotice from "./ui/InlineNotice";

export default function CloudStorageNotice({ className = "", showAction = true, id }: { className?: string; showAction?: boolean; id?: string }) {
  const { isElectron: isDesktop } = useEnvironment();

  return (
    <InlineNotice
      id={id}
      tone="warning"
      title={CLOUD_STORAGE_ENABLED ? "Cloud upload deprecation" : "Cloud storage temporarily unavailable"}
      icon={<CloudOff size={21} />}
      className={className}
      action={!CLOUD_STORAGE_ENABLED && showAction ? (isDesktop
        ? <Link href="/fileupload" className="mfr-button-secondary"><FolderOpen size={16} aria-hidden="true" />Open local files</Link>
        : <DesktopAppLink />) : undefined}
    >
      <p>{CLOUD_UPLOAD_DEPRECATION_MESSAGE}</p>
      {!CLOUD_STORAGE_ENABLED && <div className="mt-2">
        <p>Cloud uploads and cloud file reading are currently paused. {isDesktop
          ? "You can continue reading files stored on your computer."
          : "For now, use the desktop app to read files stored on your computer."}</p>
        <p className="mt-1 text-xs text-foreground-muted">Local PDF, EPUB, and TXT reading works without an upload or sign-in.</p>
      </div>}
    </InlineNotice>
  );
}

export function CloudStorageBanner() {
  const pathname = usePathname();
  // The upload and reader screens place the notice next to the affected action.
  if (pathname === "/fileupload" || pathname === "/reader" || pathname?.startsWith("/reader/")) return null;

  return <div className="mx-auto mt-4 w-[calc(100%-2rem)] max-w-[1500px] shrink-0 sm:w-[calc(100%-3rem)] lg:w-[calc(100%-6rem)]"><CloudStorageNotice /></div>;
}
