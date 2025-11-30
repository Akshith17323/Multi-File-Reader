"use client";
import React, { useState } from "react";
import { Eye, EyeClosed, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from 'react-toastify';
import { useRouter } from "next/navigation";
import Link from "next/link";

function Signuppage() {
    const router = useRouter();
    const [showPassword, setShowPassword] = useState<boolean>(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
    const [name, setName] = useState<string>("");
    const [email, setEmail] = useState<string>("");
    const [password, setPassword] = useState<string>("");
    const [confirmPassword, setConfirmPassword] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>("");
    const url = process.env.NEXT_PUBLIC_BACKEND_URL;

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!name || !email || !password || !confirmPassword) {
            setError("Please fill in all fields");
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        if (password.length < 6) {
            setError("Password must be at least 6 characters long");
            return;
        }

        setIsLoading(true);
        try {
            const res = await fetch(`${url}/api/auth/signup`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ name, email, password })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || "Signup failed");
            }

            toast.success(`Welcome, ${name}! Account created successfully.`);
            router.push('/fileupload');

            if (data) {
                setName("");
                setEmail("");
                setPassword("");
                setConfirmPassword("");
            }
        } catch (err: any) {
            setError(err.message || "Something went wrong. Please try again.");
            toast.error(err.message || "Signup failed");
        } finally {
            setIsLoading(false);
        }
    };

    const passwordsMatch = password && confirmPassword && password === confirmPassword;
    const passwordsDontMatch = confirmPassword && password !== confirmPassword;

    return (
        <div className="min-h-screen flex items-center justify-center bg-black px-4 py-8">
            <div className="w-full max-w-sm">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-white mb-2">
                        Create Account
                    </h1>
                    <p className="text-gray-400">Join Multi File Reader today</p>
                </div>

                {/* Card */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
                    {/* Error Alert */}
                    {error && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg flex items-start gap-3">
                            <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
                            <p className="text-red-400 text-sm">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSignup} className="space-y-5">
                        {/* Name Field */}
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
                                Name
                            </label>
                            <input
                                type="text"
                                id="name"
                                placeholder="John Doe"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                disabled={isLoading}
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                        </div>

                        {/* Email Field */}
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                                Email
                            </label>
                            <input
                                type="email"
                                id="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={isLoading}
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                        </div>

                        {/* Password Field */}
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    id="password"
                                    placeholder="Create a strong password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={isLoading}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed pr-12"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    disabled={isLoading}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors disabled:opacity-50"
                                >
                                    {showPassword ? <EyeClosed size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>

                        {/* Confirm Password Field */}
                        <div>
                            <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-300 mb-2">
                                Confirm Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showConfirmPassword ? "text" : "password"}
                                    id="confirm-password"
                                    placeholder="Re-enter your password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    disabled={isLoading}
                                    className={`w-full px-4 py-3 bg-white/5 border rounded-lg text-white placeholder-gray-500 focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed pr-12 ${passwordsDontMatch
                                        ? "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                                        : passwordsMatch
                                            ? "border-green-500 focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                                            : "border-white/10 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                                        }`}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    disabled={isLoading}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors disabled:opacity-50"
                                >
                                    {showConfirmPassword ? <EyeClosed size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                            {/* Password Match Indicator */}
                            {passwordsMatch && (
                                <div className="mt-2 flex items-center gap-2 text-green-500 text-sm">
                                    <CheckCircle2 size={16} />
                                    <span>Passwords match</span>
                                </div>
                            )}
                            {passwordsDontMatch && (
                                <div className="mt-2 flex items-center gap-2 text-red-500 text-sm">
                                    <AlertCircle size={16} />
                                    <span>Passwords do not match</span>
                                </div>
                            )}
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full px-6 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-lg font-bold text-lg shadow-lg hover:shadow-violet-500/25 hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2 mt-6"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="animate-spin" size={20} />
                                    <span>Creating account...</span>
                                </>
                            ) : (
                                "Sign Up"
                            )}
                        </button>
                    </form>

                    {/* Login Link */}
                    <div className="mt-6 text-center">
                        <p className="text-gray-400 text-sm">
                            Already have an account?{" "}
                            <Link
                                href="/auth/login"
                                className="text-violet-400 hover:text-violet-300 font-semibold transition-colors"
                            >
                                Log in
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Signuppage;
