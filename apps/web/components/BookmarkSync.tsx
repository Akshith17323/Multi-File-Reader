"use client";

import { useEffect } from "react";
import { syncBookmarkDeletions } from "@/utils/localBookmarks";

export default function BookmarkSync() {
  useEffect(() => {
    const sync = () => { void syncBookmarkDeletions(localStorage.getItem("token")); };
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("focus", sync);
    window.addEventListener("auth-change", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("focus", sync);
      window.removeEventListener("auth-change", sync);
    };
  }, []);
  return null;
}
