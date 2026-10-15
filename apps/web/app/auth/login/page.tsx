"use client";
import React, { useState } from "react";
import { Eye, EyeClosed, Loader2, AlertCircle } from "lucide-react";
import { toast } from 'react-toastify';
import { useRouter } from "next/navigation";
import Link from "next/link";
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

function ActiveGoogleLoginButton({
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
        className="w-10 h-10 rounded-full bg-surface/90 hover:bg-surface-hover backdrop-blur-xl border border-border-subtle hover:border-primary/50 flex items-center justify-center shadow-xs hover:shadow-md transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer group"
        title="Sign in with Google"
        aria-label="Sign in with Google"
      >
        <GoogleIcon className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" />
      </button>
    </div>
  );
}

function GoogleLoginButton({
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
          onClick={() => toast.warn("Google Login requires NEXT_PUBLIC_GOOGLE_CLIENT_ID in apps/web/.env.local")}
          disabled={isLoading}
          className="w-10 h-10 rounded-full bg-surface/90 hover:bg-surface-hover backdrop-blur-xl border border-border-subtle hover:border-primary/50 flex items-center justify-center shadow-xs hover:shadow-md transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer group"
          title="Sign in with Google"
          aria-label="Sign in with Google"
        >
          <GoogleIcon className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" />
        </button>
      </div>
    );
  }

  return <ActiveGoogleLoginButton isLoading={isLoading} onSuccess={onSuccess} onError={onError} />;
}

function Loginpage() {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("All fields are required");
      return;
    }

    setIsLoading(true);
    try {
      const data = await apiClient.login({ email, password });

      toast.success(`Welcome back, ${data.user}!`);

      if (data.token) {
        localStorage.setItem("token", data.token);
        // Store user and notify listeners
        if (data.user) {
          localStorage.setItem("user", data.user);
          window.dispatchEvent(new Event("auth-change"));
        }
      }

      router.push("/fileupload");

      if (data) {
        setEmail("");
        setPassword("");
      }
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || "Something went wrong. Please try again.");
      toast.error(error.message || "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    setIsLoading(true);
    setError("");
    try {
      const data = await apiClient.googleLogin(credentialResponse.access_token || credentialResponse.credential);

      toast.success(`Welcome, ${data.user}!`);

      if (data.token) {
        localStorage.setItem("token", data.token);
        if (data.user) {
          localStorage.setItem("user", data.user);
          window.dispatchEvent(new Event("auth-change"));
        }
      }

      router.push("/fileupload");
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || "Google Login failed. Please try again.");
      toast.error(error.message || "Google Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 relative overflow-hidden">
      {/* Ambient Blurred Glowing Orbs for Glassmorphism Depth */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm relative z-10 py-6">
        {/* Header */}
        <div className="text-center mb-4">
          <h1 className="text-2xl font-extrabold text-foreground mb-1 tracking-tight">
            Welcome Back
          </h1>
          <p className="text-foreground-muted text-xs">Sign in to continue to Multi File Reader</p>
        </div>

        {/* Card */}
        <div className="bg-surface/85 backdrop-blur-2xl border border-border-subtle rounded-2xl p-5 sm:p-6 shadow-xl transition-all duration-300">
          {/* Error Alert */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/40 rounded-xl flex items-start gap-2.5 text-xs">
              <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={16} />
              <p className="text-red-400 font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-3.5">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-foreground mb-1">
                Email
              </label>
              <input
                type="email"
                id="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                className="w-full px-3.5 py-2 bg-surface/60 backdrop-blur-md border border-border-subtle rounded-xl text-foreground text-sm placeholder-foreground-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-glow focus:bg-surface/90 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-3.5 py-2 bg-surface/60 backdrop-blur-md border border-border-subtle rounded-xl text-foreground text-sm placeholder-foreground-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-glow focus:bg-surface/90 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground transition-all duration-200 disabled:opacity-50"
                >
                  {showPassword ? <EyeClosed size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-4 py-2.5 bg-primary text-white rounded-xl font-bold text-sm shadow-[0_4px_15px_var(--color-primary-glow)] hover:shadow-[0_8px_20px_var(--color-primary-glow)] hover:-translate-y-0.5 transition-all duration-200 ease-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  <span>Logging in...</span>
                </>
              ) : (
                "Login"
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="my-3.5 flex items-center gap-3">
            <div className="flex-1 h-px bg-border-subtle"></div>
            <span className="text-foreground-muted text-[11px] font-semibold">OR</span>
            <div className="flex-1 h-px bg-border-subtle"></div>
          </div>

          {/* OAuth Buttons */}
          <div>
            <GoogleLoginButton
              isLoading={isLoading}
              onSuccess={handleGoogleSuccess}
              onError={() => {
                setError("Google Login Failed");
                toast.error("Google Login Failed");
              }}
            />
          </div>

          {/* Sign Up Link */}
          <div className="mt-4 text-center">
            <p className="text-foreground-muted text-xs">
              Don&apos;t have an account?{" "}
              <Link
                href="/auth/signup"
                className="text-primary hover:text-primary-hover font-bold transition-all duration-200"
              >
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Loginpage;