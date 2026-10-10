"use client";
import React, { useState } from "react";
import { Eye, EyeClosed, Loader2, AlertCircle, Chrome, Github } from "lucide-react";
import { toast } from 'react-toastify';
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiClient } from "@/services/apiClient";
import { useGoogleLogin } from '@react-oauth/google';

function Loginpage() {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const url = process.env.NEXT_PUBLIC_BACKEND_URL;
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

  const googleLogin = useGoogleLogin({
    onSuccess: handleGoogleSuccess,
    onError: () => {
      setError("Google Login Failed");
      toast.error("Google Login Failed");
    }
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Welcome Back
          </h1>
          <p className="text-foreground-muted">Sign in to continue to Multi File Reader</p>
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

          <form onSubmit={handleLogin} className="space-y-6">
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
                  placeholder="Enter your password"
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

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-6 py-4 bg-primary text-white rounded-xl font-bold text-lg shadow-[0_8px_20px_var(--color-primary-glow)] hover:shadow-[0_12px_25px_var(--color-primary-glow)] hover:-translate-y-0.5 transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2 relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-in-out" />
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  <span>Logging in...</span>
                </>
              ) : (
                "Login"
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
              <span>Continue with Google</span>
            </button>
          </div>

          {/* Sign Up Link */}
          <div className="mt-6 text-center">
            <p className="text-foreground-muted text-sm">
              Don&apos;t have an account?{" "}
              <Link
                href="/auth/signup"
                className="text-primary hover:text-primary-hover font-semibold transition-all duration-300 ease-in-out"
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