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

    const toggleTheme = (e: React.MouseEvent<HTMLButtonElement>) => {
        const isDark = theme === "dark";
        const nextTheme = isDark ? "light" : "dark";

        const switchTheme = () => {
            setTheme(nextTheme);
            localStorage.setItem("theme", nextTheme);
            if (nextTheme === "dark") {
                document.documentElement.classList.add("dark");
            } else {
                document.documentElement.classList.remove("dark");
            }
        };

        const doc = document as Document & { startViewTransition?: (callback: () => void) => { ready: Promise<void> } };

        if (!doc.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            switchTheme();
            return;
        }

        const x = e.clientX;
        const y = e.clientY;
        const endRadius = Math.hypot(
            Math.max(x, window.innerWidth - x),
            Math.max(y, window.innerHeight - y)
        );

        const transition = doc.startViewTransition(() => {
            switchTheme();
        });

        transition.ready.then(() => {
            const clipPath = [
                `circle(0px at ${x}px ${y}px)`,
                `circle(${endRadius}px at ${x}px ${y}px)`,
            ];
            document.documentElement.animate(
                {
                    clipPath: isDark ? [...clipPath].reverse() : clipPath,
                    opacity: isDark ? [1, 0] : [0, 1],
                },
                {
                    duration: 700,
                    easing: "cubic-bezier(0.4, 0, 0.2, 1)",
                    pseudoElement: isDark
                        ? "::view-transition-old(root)"
                        : "::view-transition-new(root)",
                }
            );
        }).catch(() => {
            switchTheme();
        });
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
