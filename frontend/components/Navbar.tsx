"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { LogOut, User, Library, Menu, X } from "lucide-react";
import { toast } from "react-toastify";

export default function Navbar() {
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUser] = useState<string | null>(null);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        // Function to update user from storage
        const checkUser = () => {
            const storedUser = localStorage.getItem("user");
            setUser(storedUser);
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

    // Hide Navbar on Login/Signup pages
    if (pathname.includes("/auth/")) {
        return null;
    }

    return (
        <nav className="sticky top-4 z-50 mx-4 md:mx-auto max-w-7xl">
            <div className="bg-[#171717]/80 backdrop-blur-xl border border-[#404040] rounded-2xl shadow-2xl px-6 py-4 transition-all duration-300">
                <div className="flex items-center justify-between">
                    {/* Logo */}
                    <Link href="/files" className="flex items-center gap-3 group">
                        <div className="bg-[#d97706] p-2 rounded-lg shadow-lg group-hover:shadow-[#d97706]/20 transition-all duration-300">
                            <Library size={24} className="text-white" />
                        </div>
                        <span className="font-bold text-xl tracking-tight text-[#f5f5f5]">
                            MultiReader
                        </span>
                    </Link>

                    {/* Desktop Menu */}
                    <div className="hidden md:flex items-center gap-8">
                        <Link
                            href="/files"
                            className={`text-sm font-bold tracking-wide transition-all duration-200 ${pathname === '/files'
                                ? 'text-[#d97706]'
                                : 'text-[#a3a3a3] hover:text-[#f5f5f5]'
                                }`}
                        >
                            MY LIBRARY
                        </Link>

                        {/* Divider */}
                        <div className="h-6 w-px bg-[#404040]"></div>

                        {user ? (
                            <div className="relative group">
                                <button className="flex items-center gap-3 pl-2 pr-4 py-1.5 rounded-full hover:bg-[#262626] transition-colors">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#d97706] to-[#b45309] flex items-center justify-center text-white font-bold shadow-md">
                                        {user.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="text-sm font-medium text-[#f5f5f5]">{user}</span>
                                </button>

                                {/* Dropdown */}
                                <div className="absolute right-0 top-full mt-4 w-56 bg-[#171717] border border-[#404040] rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform origin-top-right p-2 z-50">
                                    <button
                                        onClick={handleLogout}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-[#a3a3a3] hover:text-[#f5f5f5] hover:bg-[#262626] rounded-lg transition-all"
                                    >
                                        <LogOut size={18} />
                                        Sign Out
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <Link
                                href="/auth/login"
                                className="text-sm font-bold text-[#f5f5f5] bg-[#262626] hover:bg-[#404040] px-6 py-2.5 rounded-xl transition-all shadow-lg hover:shadow-xl"
                            >
                                Login
                            </Link>
                        )}
                    </div>

                    {/* Mobile menu button */}
                    <div className="flex md:hidden">
                        <button
                            onClick={() => setIsOpen(!isOpen)}
                            className="p-2 text-[#a3a3a3] hover:text-[#f5f5f5] transition-colors"
                        >
                            {isOpen ? <X size={28} /> : <Menu size={28} />}
                        </button>
                    </div>
                </div>

                {/* Mobile Menu */}
                {isOpen && (
                    <div className="md:hidden mt-4 pt-4 border-t border-[#404040] space-y-4 animate-in fade-in slide-in-from-top-4 duration-200">
                        <Link
                            href="/files"
                            onClick={() => setIsOpen(false)}
                            className="block px-4 py-3 text-[#f5f5f5] font-medium bg-[#262626] rounded-xl border border-[#404040]"
                        >
                            My Library
                        </Link>
                        {user ? (
                            <div className="space-y-2">
                                <div className="px-4 py-2 flex items-center gap-3 text-[#a3a3a3]">
                                    <User size={18} />
                                    <span>Signed in as <span className="text-[#f5f5f5] font-bold">{user}</span></span>
                                </div>
                                <button
                                    onClick={handleLogout}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-[#f5f5f5] font-bold bg-[#d97706] hover:bg-[#b45309] rounded-xl transition-colors shadow-lg"
                                >
                                    <LogOut size={20} />
                                    Logout
                                </button>
                            </div>
                        ) : (
                            <Link
                                href="/auth/login"
                                className="block w-full text-center px-4 py-3 text-[#f5f5f5] font-bold bg-[#d97706] hover:bg-[#b45309] rounded-xl transition-colors shadow-lg"
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
