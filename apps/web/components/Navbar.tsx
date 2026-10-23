"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { toast } from "react-toastify";
import { apiClient } from "@/services/apiClient";
import { clearAuthSession } from "@/utils/authSession";
import ThemeToggle from "./ThemeToggle";
import Brand from "./ui/Brand";
import { useEnvironment } from "@/hooks/useEnvironment";

export default function Navbar() {
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUser] = useState<string | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const { isElectron } = useEnvironment();

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

        return () => {
            window.removeEventListener("auth-change", checkUser);
            window.removeEventListener("storage", checkUser);
        };
    }, []);

    const handleLogout = async () => {
        try {
            await apiClient.logout();
        } catch (error) {
            console.error("Logout failed", error);
        } finally {
            clearAuthSession();
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
        <nav aria-label="Main navigation" className={`sticky z-50 mx-auto mt-3 w-[calc(100%-2rem)] max-w-[1500px] shrink-0 sm:w-[calc(100%-3rem)] lg:w-[calc(100%-6rem)] ${isElectron ? "top-11" : "top-3"}`}>
            <div className="mfr-panel rounded-2xl px-4 py-3 shadow-sm sm:px-5">
                <div className="flex items-center justify-between">
                    {/* Logo */}
                    <Brand href={user ? "/files" : "/"} />

                    {/* Desktop Menu */}
                    <div className="hidden md:flex items-center gap-3 group/nav">
                        <Link
                            href="/files"
                            aria-current={pathname === "/files" ? "page" : undefined}
                            className={`relative text-xs font-bold tracking-wide py-1.5 px-2.5 rounded-lg transition-all duration-200 overflow-hidden group/link ${pathname === '/files'
                                ? 'text-primary bg-primary/10'
                                : 'text-foreground-muted hover:text-foreground hover:bg-surface-hover'
                                }`}
                        >
                            My Library
                            {pathname === '/files' && (
                                <span className="absolute bottom-0 left-0 w-full h-[2px] bg-primary shadow-[0_0_8px_var(--color-primary)]" />
                            )}
                        </Link>

                        <Link
                            href="/bookmarks"
                            aria-current={pathname === "/bookmarks" ? "page" : undefined}
                            className={`relative text-xs font-bold tracking-wide py-1.5 px-2.5 rounded-lg transition-all duration-200 overflow-hidden group/link ${pathname === '/bookmarks'
                                ? 'text-primary bg-primary/10'
                                : 'text-foreground-muted hover:text-foreground hover:bg-surface-hover'
                                }`}
                        >
                            My Bookmarks
                            {pathname === '/bookmarks' && (
                                <span className="absolute bottom-0 left-0 w-full h-[2px] bg-primary shadow-[0_0_8px_var(--color-primary)]" />
                            )}
                        </Link>

                        {/* Divider */}
                        <div className="h-4 w-px bg-border-subtle transition-all duration-200"></div>

                        <ThemeToggle />

                        <div className="h-4 w-px bg-border-subtle transition-all duration-200"></div>

                        {user ? (
                            <div className="relative group/user transition-all duration-200">
                                <button className="flex max-w-52 items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full hover:bg-surface-hover transition-colors">
                                    <div className="w-7 h-7 rounded-full bg-linear-to-br from-primary to-purple-600 flex items-center justify-center text-white font-bold text-xs shadow-inner">
                                        {user.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="truncate text-xs font-medium text-foreground">{user}</span>
                                </button>

                                {/* Dropdown */}
                                <div className="absolute right-0 top-full mt-2 w-44 bg-surface backdrop-blur-2xl border border-border-subtle rounded-xl shadow-xl opacity-0 invisible group-hover/user:opacity-100 group-hover/user:visible group-focus-within/user:opacity-100 group-focus-within/user:visible transition-all duration-200 transform origin-top-right p-1.5 z-50">
                                    <button
                                        onClick={handleLogout}
                                        className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium text-foreground-muted hover:text-foreground hover:bg-surface-hover rounded-lg transition-all"
                                    >
                                        <LogOut size={14} />
                                        Sign Out
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <Link
                                href="/auth/login"
                                className="text-xs font-bold text-foreground bg-surface-hover hover:bg-border-subtle px-4 py-1.5 rounded-lg transition-all shadow-xs hover:shadow-sm duration-200"
                            >
                                Login
                            </Link>
                        )}
                    </div>

                    {/* Mobile menu button */}
                    <div className="flex md:hidden items-center gap-3">
                        <ThemeToggle />

                        <button
                            type="button"
                            aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
                            aria-expanded={isOpen}
                            aria-controls="mobile-navigation"
                            onClick={() => setIsOpen(!isOpen)}
                            className="p-1.5 text-foreground-muted hover:text-foreground transition-colors"
                        >
                            {isOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                    </div>
                </div>

                {/* Mobile Menu */}
                {isOpen && (
                    <div id="mobile-navigation" className="md:hidden mt-4 pt-4 border-t border-border-subtle space-y-3 animate-in fade-in slide-in-from-top-4 duration-200">
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
