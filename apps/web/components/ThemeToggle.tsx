"use client";
import { useEffect, useState } from "react";
import { Sun, MoonStar } from "lucide-react";

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const sync = () => setIsDark(document.documentElement.classList.contains("dark"));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return <button type="button" aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"} aria-pressed={isDark} className="mfr-icon-button h-9 w-9 border border-border-subtle" onClick={() => {
    document.documentElement.classList.toggle("dark", !isDark);
    localStorage.setItem("theme", isDark ? "light" : "dark");
    setIsDark(!isDark);
  }}>{isDark ? <MoonStar size={16} /> : <Sun size={16} />}</button>;
}
