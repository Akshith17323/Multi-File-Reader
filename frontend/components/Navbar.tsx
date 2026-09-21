"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { LogOut, User, Library, Menu, X, Sun, Moon, MoonStar } from "lucide-react";
import { toast } from "react-toastify";

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
            const url = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
            await fetch(`${url}/api/auth/logout`, {
                method: "POST",
                credentials: "include",
            });
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

    // Debugging
    console.log("Navbar Rendering. Pathname:", pathname);

    // Safety check for pathname
    if (!pathname) return null;

    // Hide Navbar on Login/Signup and all Reader pages
    if (pathname.includes("/auth/") || pathname === "/reader" || pathname.startsWith("/reader/")) {
        return null;
    }

    return (
        <nav className="sticky top-3 z-50 mx-4 md:mx-auto max-w-5xl">
            <div className="bg-surface/80 backdrop-blur-xl border border-border-subtle rounded-2xl shadow-lg px-5 py-2.5 transition-all duration-300">
                <div className="flex items-center justify-between">
                    {/* Logo */}
                    <Link href="/files" className="flex items-center gap-2.5 group">
                        <div className="bg-primary p-1.5 rounded-lg shadow-md group-hover:shadow-primary/20 transition-all duration-300">
                            <Library size={20} className="text-white" />
                        </div>
                        <span className="font-bold text-lg tracking-tight text-foreground">
                            MultiReader
                        </span>
                    </Link>

                    {/* Desktop Menu */}
                    <div className="hidden md:flex items-center gap-6 group/nav">
                        <Link
                            href="/files"
                            className={`text-sm font-bold tracking-wide transition-all duration-300 group-hover/nav:opacity-50 hover:!opacity-100! ${pathname === '/files'
                                ? 'text-primary opacity-100'
                                : 'text-foreground-muted hover:text-foreground'
                                }`}
                        >
                            MY LIBRARY
                        </Link>

                        <Link
                            href="/bookmarks"
                            className={`text-sm font-bold tracking-wide transition-all duration-300 group-hover/nav:opacity-50 hover:!opacity-100! ${pathname === '/bookmarks'
                                ? 'text-primary opacity-100'
                                : 'text-foreground-muted hover:text-foreground'
                                }`}
                        >
                            MY BOOKMARKS
                        </Link>

                        {/* Divider */}
                        <div className="h-5 w-px bg-border-subtle group-hover/nav:opacity-50 transition-all duration-300"></div>

                        {/* Theme Toggle (macOS style) */}
                        <button
                            onClick={toggleTheme}
                            className="relative inline-flex h-8 w-14 items-center rounded-full bg-surface-hover hover:bg-border-subtle transition-colors focus:outline-none group-hover/nav:opacity-50 hover:!opacity-100!"
                        >
                            <span className="sr-only">Toggle dark mode</span>
                            <span
                                className={`inline-flex h-6 w-6 transform items-center justify-center rounded-full bg-white transition-transform duration-300 ease-in-out shadow-md ${theme === "dark" ? "translate-x-7" : "translate-x-1"
                                    }`}
                            >
                                {theme === "dark" ? (
                                    <MoonStar size={14} className="text-blue-600 fill-current" />
                                ) : (
                                    <Sun size={14} className="text-amber-500 fill-current" />
                                )}
                            </span>
                        </button>

                        <div className="h-5 w-px bg-border-subtle group-hover/nav:opacity-50 transition-all duration-300"></div>

                        {user ? (
                            <div className="relative group/user group-hover/nav:opacity-50 hover:!opacity-100! transition-all duration-300">
                                <button className="flex items-center gap-2 pl-2 pr-3 py-1 rounded-full hover:bg-surface-hover transition-colors">
                                    <div className="w-8 h-8 rounded-full bg-linear-to-br from-primary to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-inner">
                                        {user.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="text-sm font-medium text-foreground">{user}</span>
                                </button>

                                {/* Dropdown */}
                                <div className="absolute right-0 top-full mt-3 w-48 bg-surface border border-border-subtle rounded-xl shadow-xl opacity-0 invisible group-hover/user:opacity-100 group-hover/user:visible transition-all duration-200 transform origin-top-right p-2 z-50">
                                    <button
                                        onClick={handleLogout}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-foreground-muted hover:text-foreground hover:bg-surface-hover rounded-lg transition-all"
                                    >
                                        <LogOut size={16} />
                                        Sign Out
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <Link
                                href="/auth/login"
                                className="text-sm font-bold text-foreground bg-surface-hover hover:bg-border-subtle px-5 py-2 rounded-xl transition-all shadow-sm hover:shadow-md group-hover/nav:opacity-50 hover:!opacity-100! duration-300"
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
                    <div className="md:hidden mt-4 pt-4 border-t border-border-subtle space-y-4 animate-in fade-in slide-in-from-top-4 duration-200">
                        <Link
                            href="/files"
                            onClick={() => setIsOpen(false)}
                            className="block px-4 py-3 text-foreground font-medium bg-surface-hover rounded-xl border border-border-subtle"
                        >
                            My Library
                        </Link>
                        <Link
                            href="/bookmarks"
                            onClick={() => setIsOpen(false)}
                            className="block px-4 py-3 text-foreground font-medium bg-surface-hover rounded-xl border border-border-subtle"
                        >
                            My Bookmarks
                        </Link>
                        {user ? (
                            <div className="space-y-2">
                                <div className="px-4 py-2 flex items-center gap-3 text-foreground-muted">
                                    <User size={18} />
                                    <span>Signed in as <span className="text-foreground font-bold">{user}</span></span>
                                </div>
                                <button
                                    onClick={handleLogout}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-white font-bold bg-primary hover:bg-primary-hover rounded-xl transition-colors shadow-sm"
                                >
                                    <LogOut size={20} />
                                    Logout
                                </button>
                            </div>
                        ) : (
                            <Link
                                href="/auth/login"
                                className="block w-full text-center px-4 py-3 text-white font-bold bg-primary hover:bg-primary-hover rounded-xl transition-colors shadow-sm"
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
