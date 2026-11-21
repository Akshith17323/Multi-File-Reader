"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CloudDownload, FolderOpen } from "lucide-react";
import { useEnvironment } from "@/hooks/useEnvironment";
import DesktopAppLink from "./DesktopAppLink";
import InlineNotice from "./ui/InlineNotice";

export default function DriveImportNotice({ className = "", showAction = true, id }: { className?: string; showAction?: boolean; id?: string }) {
  const { isElectron: isDesktop } = useEnvironment();

  return (
    <InlineNotice
      id={id}
      tone="info"
      title="Google Drive import — coming soon"
      icon={<CloudDownload size={21} />}
      className={className}
      action={showAction ? (isDesktop
        ? <Link href="/fileupload" className="mfr-button-secondary"><FolderOpen size={16} aria-hidden="true" />Open local files</Link>
        : <DesktopAppLink />) : undefined}
    >
      <p>Hosted cloud uploads have been retired to remove the extra upload step and avoid duplicate copies. Google Drive import is planned so you can read files where you already keep them.</p>
      <p className="mt-2 text-xs text-foreground-muted">For now, open local PDF, EPUB, and TXT files in the desktop app. No upload or sign-in needed.</p>
    </InlineNotice>
  );
}

export function DriveImportBanner() {
  const pathname = usePathname();
  // The add-files screen has its own notice; keep announcements out of the reader.
  if (pathname === "/fileupload" || pathname === "/reader" || pathname?.startsWith("/reader/")) return null;

  return <div className="mx-auto mt-4 w-[calc(100%-2rem)] max-w-[1500px] shrink-0 sm:w-[calc(100%-3rem)] lg:w-[calc(100%-6rem)]"><DriveImportNotice /></div>;
}
