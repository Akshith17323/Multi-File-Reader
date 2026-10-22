"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { LogOut, Library, Menu, X, Sun, Moon, MoonStar } from "lucide-react";
import { toast } from "react-toastify";
import { apiClient } from "@/services/apiClient";

export default function Navbar() {
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUser] = useState<string | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [theme, setTheme] = useState<'light' | 'dark'>('light');

    useEffect(() => {
        // Function to update user from storage
        const checkUser = () => {
            const storedUser = localStorage.getItem("user");
            const token = localStorage.getItem("token");
            if (storedUser && token) {
                setUser(storedUser);
            } else {
                setUser(null);
                if (storedUser) {
                    localStorage.removeItem("user");
                }
            }
        };

        // Initial check
        checkUser();

        // Listen for custom auth events and storage changes
        window.addEventListener("auth-change", checkUser);
        window.addEventListener("storage", checkUser);

        // Check theme
        const savedTheme = localStorage.getItem("theme");
        if (savedTheme === "dark" || (!savedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
            setTheme("dark");
            document.documentElement.classList.add("dark");
        } else {
            setTheme("light");
            document.documentElement.classList.remove("dark");
        }

        return () => {
            window.removeEventListener("auth-change", checkUser);
            window.removeEventListener("storage", checkUser);
        };
    }, []);

    const toggleTheme = (e: React.MouseEvent) => {
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

        if (!doc.startViewTransition) {
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
        });
    };

    const handleLogout = async () => {
        try {
            await apiClient.logout();
        } catch (error) {
            console.error("Logout failed", error);
        } finally {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            // Notify other components
            window.dispatchEvent(new Event("auth-change"));
            toast.info("Logged out successfully");
            router.push("/auth/login");
        }
    };

    // Safety check for pathname
    if (!pathname) return null;

    // Hide Navbar on Login/Signup and all Reader pages
    if (pathname.includes("/auth/") || pathname === "/reader" || pathname.startsWith("/reader/")) {
        return null;
    }

    return (
        <nav className="sticky top-2 z-50 mx-4 md:mx-auto max-w-[1700px] w-[calc(100%-2rem)]">
            <div className="bg-surface/90 backdrop-blur-2xl border border-border-subtle rounded-2xl shadow-sm px-4 py-2 transition-all duration-300">
                <div className="flex items-center justify-between">
                    {/* Logo */}
                    <Link href="/files" className="flex items-center gap-2.5 group">
                        <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-linear-to-br from-primary to-purple-600 shadow-sm group-hover:shadow-primary-glow transition-all duration-300 overflow-hidden">
                            <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            <Library size={18} className="text-white relative z-10 group-hover:scale-105 transition-transform duration-300" />
                        </div>
                        <span className="font-extrabold text-base tracking-tight bg-clip-text text-transparent bg-linear-to-r from-foreground to-foreground-muted group-hover:to-primary transition-all duration-300">
                            MultiReader
                        </span>
                    </Link>

                    {/* Desktop Menu */}
                    <div className="hidden md:flex items-center gap-3 group/nav">
                        <Link
                            href="/files"
                            className={`relative text-xs font-bold tracking-wide py-1.5 px-2.5 rounded-lg transition-all duration-200 overflow-hidden group/link ${pathname === '/files'
                                ? 'text-primary bg-primary/10'
                                : 'text-foreground-muted hover:text-foreground hover:bg-surface-hover'
                                }`}
                        >
                            MY LIBRARY
                            {pathname === '/files' && (
                                <span className="absolute bottom-0 left-0 w-full h-[2px] bg-primary shadow-[0_0_8px_var(--color-primary)]" />
                            )}
                        </Link>

                        <Link
                            href="/bookmarks"
                            className={`relative text-xs font-bold tracking-wide py-1.5 px-2.5 rounded-lg transition-all duration-200 overflow-hidden group/link ${pathname === '/bookmarks'
                                ? 'text-primary bg-primary/10'
                                : 'text-foreground-muted hover:text-foreground hover:bg-surface-hover'
                                }`}
                        >
                            MY BOOKMARKS
                            {pathname === '/bookmarks' && (
                                <span className="absolute bottom-0 left-0 w-full h-[2px] bg-primary shadow-[0_0_8px_var(--color-primary)]" />
                            )}
                        </Link>

                        <Link
                            href="/fileupload"
                            className={`relative text-sm font-bold tracking-wide py-2 px-3 rounded-lg transition-all duration-300 overflow-hidden group/link ${pathname === '/fileupload'
                                ? 'text-primary bg-primary/10'
                                : 'text-foreground-muted hover:text-foreground hover:bg-surface-hover'
                                }`}
                        >
                            UPLOAD
                            {pathname === '/fileupload' && (
                                <span className="absolute bottom-0 left-0 w-full h-[2px] bg-primary shadow-[0_0_8px_var(--color-primary)]" />
                            )}
                        </Link>

                        {/* Divider */}
                        <div className="h-4 w-px bg-border-subtle group-hover/nav:opacity-50 transition-all duration-200"></div>

                        {/* Theme Toggle (macOS style) */}
                        <button
                            onClick={toggleTheme}
                            className="relative inline-flex h-7 w-12 items-center rounded-full bg-surface-hover hover:bg-border-subtle transition-colors focus:outline-none group-hover/nav:opacity-50 hover:!opacity-100!"
                        >
                            <span className="sr-only">Toggle dark mode</span>
                            <span
                                className={`inline-flex h-5 w-5 transform items-center justify-center rounded-full bg-white transition-transform duration-300 ease-in-out shadow-sm ${theme === "dark" ? "translate-x-6" : "translate-x-1"
                                    }`}
                            >
                                {theme === "dark" ? (
                                    <MoonStar size={12} className="text-blue-600 fill-current" />
                                ) : (
                                    <Sun size={12} className="text-amber-500 fill-current" />
                                )}
                            </span>
                        </button>

                        <div className="h-4 w-px bg-border-subtle group-hover/nav:opacity-50 transition-all duration-200"></div>

                        {user ? (
                            <div className="relative group/user group-hover/nav:opacity-50 hover:!opacity-100! transition-all duration-200">
                                <button className="flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full hover:bg-surface-hover transition-colors">
                                    <div className="w-7 h-7 rounded-full bg-linear-to-br from-primary to-purple-600 flex items-center justify-center text-white font-bold text-xs shadow-inner">
                                        {user.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="text-xs font-medium text-foreground">{user}</span>
                                </button>

                                {/* Dropdown with hover bridge */}
                                <div className="absolute right-0 top-full pt-2 w-44 opacity-0 invisible group-hover/user:opacity-100 group-hover/user:visible transition-all duration-200 transform origin-top-right z-50">
                                    <div className="bg-surface backdrop-blur-2xl border border-border-subtle rounded-xl shadow-xl p-1.5">
                                        <button
                                            onClick={handleLogout}
                                            className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium text-foreground-muted hover:text-foreground hover:bg-surface-hover rounded-lg transition-all cursor-pointer"
                                        >
                                            <LogOut size={14} />
                                            Sign Out
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <Link
                                href="/auth/login"
                                className="text-xs font-bold text-foreground bg-surface-hover hover:bg-border-subtle px-4 py-1.5 rounded-lg transition-all shadow-xs hover:shadow-sm group-hover/nav:opacity-50 hover:!opacity-100! duration-200"
                            >
                                Login
                            </Link>
                        )}
                    </div>

                    {/* Mobile menu button */}
                    <div className="flex md:hidden items-center gap-3">
                        {/* Theme Toggle Mobile */}
                        <button
                            onClick={toggleTheme}
                            className="p-1.5 rounded-full bg-surface-hover text-foreground-muted hover:text-foreground transition-colors"
                        >
                            {theme === "dark" ? <Moon size={20} className="fill-current" /> : <Sun size={20} className="fill-current" />}
                        </button>

                        <button
                            onClick={() => setIsOpen(!isOpen)}
                            className="p-1.5 text-foreground-muted hover:text-foreground transition-colors"
                        >
                            {isOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                    </div>
                </div>

                {/* Mobile Menu */}
                {isOpen && (
                    <div className="md:hidden mt-4 pt-4 border-t border-border-subtle space-y-3 animate-in fade-in slide-in-from-top-4 duration-200">
                        <Link
                            href="/files"
                            onClick={() => setIsOpen(false)}
                            className="block px-4 py-3 text-foreground font-semibold bg-surface/70 backdrop-blur-xl hover:bg-surface-hover rounded-2xl border border-border-subtle transition-all shadow-xs"
                        >
                            My Library
                        </Link>
                        <Link
                            href="/bookmarks"
                            onClick={() => setIsOpen(false)}
                            className="block px-4 py-3 text-foreground font-semibold bg-surface/70 backdrop-blur-xl hover:bg-surface-hover rounded-2xl border border-border-subtle transition-all shadow-xs"
                        >
                            My Bookmarks
                        </Link>
                        <Link
                            href="/fileupload"
                            onClick={() => setIsOpen(false)}
                            className="block px-4 py-3 text-foreground font-medium bg-surface-hover rounded-xl border border-border-subtle"
                        >
                            Upload File
                        </Link>
                        {user ? (
                            <div className="space-y-3 pt-1">
                                <div className="px-4 py-2.5 flex items-center gap-3 text-foreground-muted bg-surface/50 backdrop-blur-md rounded-2xl border border-border-subtle">
                                    <div className="w-7 h-7 rounded-full bg-linear-to-br from-primary to-purple-600 flex items-center justify-center text-white font-bold text-xs shadow-inner">
                                        {user.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="text-sm">Signed in as <span className="text-foreground font-bold">{user}</span></span>
                                </div>
                                <button
                                    onClick={handleLogout}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 text-white font-bold bg-primary hover:bg-primary-hover rounded-2xl transition-all shadow-md"
                                >
                                    <LogOut size={18} />
                                    Logout
                                </button>
                            </div>
                        ) : (
                            <Link
                                href="/auth/login"
                                className="block w-full text-center px-4 py-3 text-white font-bold bg-primary hover:bg-primary-hover rounded-2xl transition-all shadow-md"
                            >
                                Login
                            </Link>
                        )}
                    </div>
                )}
            </div>
        </nav>
    );
}
