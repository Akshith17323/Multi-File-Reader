"use client";

import { useEffect, useState } from "react";
import { Sun, MoonStar } from "lucide-react";

export default function ThemeToggle() {
    const [theme, setTheme] = useState<"light" | "dark">("light");

    useEffect(() => {
        const syncTheme = () => setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
        syncTheme();
        const observer = new MutationObserver(syncTheme);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
        return () => observer.disconnect();
    }, []);

    const toggleTheme = () => {
        const root = document.documentElement;
        const nextTheme = root.classList.contains('dark') ? 'light' : 'dark';
        // Apply colors in this frame, including elements with hover transitions.
        root.classList.add('theme-switching');
        root.classList.toggle('dark', nextTheme === 'dark');
        setTheme(nextTheme);
        try { localStorage.setItem('theme', nextTheme); } catch { /* The theme still works without storage. */ }
        requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-switching')));
    };

    const isDark = theme === "dark";

    return (
        <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            aria-pressed={isDark}
            className="mfr-icon-button h-9 w-9 border border-border-subtle bg-surface-hover/65"
        >
            {isDark ? <MoonStar size={16} /> : <Sun size={16} />}
        </button>
    );
}
