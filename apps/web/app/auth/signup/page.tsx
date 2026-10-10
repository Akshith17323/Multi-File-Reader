"use client";
import React, { useState } from "react";
import { Eye, EyeClosed, Loader2, AlertCircle, CheckCircle2, Chrome, Github } from "lucide-react";
import { toast } from 'react-toastify';
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiClient } from "@/services/apiClient";
import { useGoogleLogin } from '@react-oauth/google';

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
            const data = await apiClient.signup({ name, email, password });

            toast.success(`Welcome, ${name}! Account created successfully.`);
            router.push('/fileupload');

            if (data) {
                setName("");
                setEmail("");
                setPassword("");
                setConfirmPassword("");
            }
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : "Something went wrong. Please try again.";
            setError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSuccess = async (credentialResponse: any) => {
        setIsLoading(true);
        setError("");
        try {
            const data = await apiClient.googleLogin(credentialResponse.access_token || credentialResponse.credential);

            toast.success(`Welcome, ${data.user}! Account linked successfully.`);

            if (data.token) {
                localStorage.setItem("token", data.token);
                if (data.user) {
                    localStorage.setItem("user", data.user);
                    window.dispatchEvent(new Event("auth-change"));
                }
            }

            router.push("/fileupload");
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : "Google Signup failed. Please try again.";
            setError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const googleLogin = useGoogleLogin({
        onSuccess: handleGoogleSuccess,
        onError: () => {
            setError("Google Signup Failed");
            toast.error("Google Signup Failed");
        }
    });

    const passwordsMatch = password && confirmPassword && password === confirmPassword;
    const passwordsDontMatch = confirmPassword && password !== confirmPassword;

    return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
            <div className="w-full max-w-sm">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-foreground mb-2">
                        Create Account
                    </h1>
                    <p className="text-foreground-muted">Join Multi File Reader today</p>
                </div>

                {/* Card */}
                <div className="bg-surface backdrop-blur-2xl border border-border-subtle rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] transition-all duration-500 ease-out hover:shadow-[0_8px_40px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_8px_40px_rgb(0,0,0,0.3)] hover:-translate-y-1">
                    {/* Error Alert */}
                    {error && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg flex items-start gap-3">
                            <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} />
                            <p className="text-red-400 text-sm">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSignup} className="space-y-5">
                        {/* Name Field */}
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-foreground mb-2">
                                Name
                            </label>
                            <input
                                type="text"
                                id="name"
                                placeholder="John Doe"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                disabled={isLoading}
                                className="w-full px-5 py-3.5 bg-background/50 border border-border-subtle rounded-xl text-foreground placeholder-foreground-muted focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary-glow transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                        </div>

                        {/* Email Field */}
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                                Email
                            </label>
                            <input
                                type="email"
                                id="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={isLoading}
                                className="w-full px-5 py-3.5 bg-background/50 border border-border-subtle rounded-xl text-foreground placeholder-foreground-muted focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary-glow transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                        </div>

                        {/* Password Field */}
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
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
                                    className="w-full px-5 py-3.5 bg-background/50 border border-border-subtle rounded-xl text-foreground placeholder-foreground-muted focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary-glow transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed pr-12"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    disabled={isLoading}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground transition-all duration-300 ease-in-out disabled:opacity-50"
                                >
                                    {showPassword ? <EyeClosed size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>

                        {/* Confirm Password Field */}
                        <div>
                            <label htmlFor="confirm-password" className="block text-sm font-medium text-foreground mb-2">
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
                                    className={`w-full px-5 py-3.5 bg-background/50 border rounded-xl text-foreground placeholder-foreground-muted focus:outline-none transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed pr-12 ${passwordsDontMatch
                                        ? "border-red-500 focus:border-red-500 focus:ring-4 focus:ring-red-500/20"
                                        : passwordsMatch
                                            ? "border-green-500 focus:border-green-500 focus:ring-4 focus:ring-green-500/20"
                                            : "border-border-subtle focus:border-primary focus:ring-4 focus:ring-primary-glow"
                                        }`}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    disabled={isLoading}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground transition-all duration-300 ease-in-out disabled:opacity-50"
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
                            className="w-full px-6 py-4 bg-primary text-white rounded-xl font-bold text-lg shadow-[0_8px_20px_var(--color-primary-glow)] hover:shadow-[0_12px_25px_var(--color-primary-glow)] hover:-translate-y-0.5 transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2 mt-6 relative overflow-hidden group"
                        >
                            <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-in-out" />
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

                    {/* Divider */}
                    <div className="mt-6 flex items-center gap-4">
                        <div className="flex-1 h-px bg-border-subtle"></div>
                        <span className="text-foreground-muted text-sm font-medium">OR</span>
                        <div className="flex-1 h-px bg-border-subtle"></div>
                    </div>

                    {/* OAuth Buttons */}
                    <div className="mt-6 flex flex-col gap-3">
                        <button
                            type="button"
                            onClick={() => googleLogin()}
                            disabled={isLoading}
                            className="w-full px-5 py-3.5 bg-background border border-border-subtle hover:bg-surface-hover text-foreground rounded-xl font-bold transition-all duration-300 ease-in-out disabled:opacity-50 flex items-center justify-center gap-3 shadow-sm hover:shadow-md"
                        >
                            <Chrome size={20} className="text-primary" />
                            <span>Sign up with Google</span>
                        </button>
                    </div>

                    {/* Login Link */}
                    <div className="mt-6 text-center">
                        <p className="text-foreground-muted text-sm">
                            Already have an account?{" "}
                            <Link
                                href="/auth/login"
                                className="text-primary hover:text-primary-hover font-semibold transition-all duration-300 ease-in-out"
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
