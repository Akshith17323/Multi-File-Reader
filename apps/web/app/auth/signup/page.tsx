"use client";
import React, { useState } from "react";
import { Eye, EyeClosed, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from 'react-toastify';
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthLayout from "@/components/ui/AuthLayout";
import { setAuthSession } from "@/utils/authSession";
import { apiClient } from "@/services/apiClient";
import { useGoogleLogin } from '@react-oauth/google';

function GoogleIcon({ className = "w-5 h-5" }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
            <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
        </svg>
    );
}

function ActiveGoogleSignupButton({
    isLoading,
    onSuccess,
    onError,
}: {
    isLoading: boolean;
    onSuccess: (credentialResponse: any) => void;
    onError: () => void;
}) {
    const googleLogin = useGoogleLogin({
        onSuccess,
        onError,
    });

    return (
        <div className="flex justify-center">
            <button
                type="button"
                onClick={() => googleLogin()}
                disabled={isLoading}
                className="mfr-button-secondary w-full group"
                title="Sign up with Google"
                aria-label="Sign up with Google"
            >
                <GoogleIcon className="w-5 h-5" />
                <span>Continue with Google</span>
            </button>
        </div>
    );
}

function GoogleSignupButton({
    isLoading,
    onSuccess,
    onError,
}: {
    isLoading: boolean;
    onSuccess: (credentialResponse: any) => void;
    onError: () => void;
}) {
    const hasClientId = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);

    if (!hasClientId) {
        return (
            <div className="flex justify-center">
                <button
                    type="button"
                    onClick={() => toast.warn("Google sign-up is currently unavailable. Please create an account with your email.")}
                    disabled={isLoading}
                    className="mfr-button-secondary w-full group"
                    title="Sign up with Google"
                    aria-label="Sign up with Google"
                >
                    <GoogleIcon className="w-5 h-5" />
                <span>Continue with Google</span>
                </button>
            </div>
        );
    }

    return <ActiveGoogleSignupButton isLoading={isLoading} onSuccess={onSuccess} onError={onError} />;
}

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

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!name.trim() || !email.trim() || !password || !confirmPassword) {
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
            const data = await apiClient.signup({ name: name.trim(), email: email.trim().toLowerCase(), password });

            toast.success(`Welcome, ${name}! Account created successfully.`);

            setAuthSession(data);

            router.push('/files');

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

            setAuthSession(data);

            router.push("/files");
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : "Google Signup failed. Please try again.";
            setError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const passwordsMatch = password && confirmPassword && password === confirmPassword;
    const passwordsDontMatch = confirmPassword && password !== confirmPassword;

    return (
        <AuthLayout title="Create account" description="Your books and documents, together in one library.">
            {/* Error Alert */}
            {error && (
                <div className="mb-3 p-2.5 bg-red-500/10 border border-red-500/40 rounded-xl flex items-start gap-2 text-xs">
                    <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={15} />
                    <p className="text-red-500 font-medium">{error}</p>
                </div>
            )}

            <form onSubmit={handleSignup} className="space-y-4">
                {/* Name Field */}
                <div>
                    <label htmlFor="name" className="block text-xs font-semibold text-foreground mb-1">
                        Name
                    </label>
                    <input
                        type="text"
                        id="name"
                        autoComplete="name"
                        placeholder="John Doe"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={isLoading}
                        className="mfr-input"
                    />
                </div>

                {/* Email Field */}
                <div>
                    <label htmlFor="email" className="block text-xs font-semibold text-foreground mb-1">
                        Email
                    </label>
                    <input
                        type="email"
                        id="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isLoading}
                        className="mfr-input"
                    />
                </div>

                {/* Password Field */}
                <div>
                    <label htmlFor="password" className="block text-xs font-semibold text-foreground mb-1">
                        Password
                    </label>
                    <div className="relative">
                        <input
                            type={showPassword ? "text" : "password"}
                            id="password"
                            autoComplete="new-password"
                            placeholder="Create password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={isLoading}
                            className="mfr-input pr-9"
                        />
                        <button
                            type="button"
                            aria-label={showPassword ? "Hide password" : "Show password"}
                            onClick={() => setShowPassword(!showPassword)}
                            disabled={isLoading}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground transition-all duration-200 disabled:opacity-50"
                        >
                            {showPassword ? <EyeClosed size={15} /> : <Eye size={15} />}
                        </button>
                    </div>
                </div>

                {/* Confirm Password Field */}
                <div>
                    <label htmlFor="confirm-password" className="block text-xs font-semibold text-foreground mb-1">
                        Confirm Password
                    </label>
                    <div className="relative">
                        <input
                            type={showConfirmPassword ? "text" : "password"}
                            id="confirm-password"
                            autoComplete="new-password"
                            placeholder="Confirm password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            disabled={isLoading}
                            className={`mfr-input pr-10 ${passwordsDontMatch
                                ? "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                                : passwordsMatch
                                    ? "border-green-500 focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                                    : "border-border-subtle focus:border-primary focus:ring-2 focus:ring-primary-glow"
                                }`}
                        />
                        <button
                            type="button"
                            aria-label={showConfirmPassword ? "Hide confirmation password" : "Show confirmation password"}
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            disabled={isLoading}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground transition-all duration-200 disabled:opacity-50"
                        >
                            {showConfirmPassword ? <EyeClosed size={15} /> : <Eye size={15} />}
                        </button>
                    </div>
                    {/* Password Match Indicator */}
                    {passwordsMatch && (
                        <div className="mt-1 flex items-center gap-1.5 text-green-500 text-[11px] font-medium">
                            <CheckCircle2 size={13} />
                            <span>Passwords match</span>
                        </div>
                    )}
                    {passwordsDontMatch && (
                        <div className="mt-1 flex items-center gap-1.5 text-red-500 text-[11px] font-medium">
                            <AlertCircle size={13} />
                            <span>Passwords do not match</span>
                        </div>
                    )}
                </div>

                {/* Submit Button */}
                <button
                    type="submit"
                    disabled={isLoading}
                    className="mfr-button-primary w-full group overflow-hidden"
                >
                    <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                    {isLoading ? (
                        <>
                            <Loader2 className="animate-spin" size={16} />
                            <span>Creating account...</span>
                        </>
                    ) : (
                        "Sign Up"
                    )}
                </button>
            </form>

            {/* Divider */}
            <div className="my-2.5 flex items-center gap-3">
                <div className="flex-1 h-px bg-border-subtle"></div>
                <span className="text-foreground-muted text-[11px] font-semibold">OR</span>
                <div className="flex-1 h-px bg-border-subtle"></div>
            </div>

            {/* OAuth Buttons */}
            <div>
                <GoogleSignupButton
                    isLoading={isLoading}
                    onSuccess={handleGoogleSuccess}
                    onError={() => {
                        setError("Google Signup Failed");
                        toast.error("Google Signup Failed");
                    }}
                />
            </div>

            {/* Login Link */}
            <div className="mt-3 text-center">
                <p className="text-foreground-muted text-xs">
                    Already have an account?{" "}
                    <Link
                        href="/auth/login"
                        className="text-primary hover:text-primary-hover font-bold transition-all duration-200"
                    >
                        Log in
                    </Link>
                </p>
            </div>
        </AuthLayout>
    );
}

export default Signuppage;
