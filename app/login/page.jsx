"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function LoginPage() {
  const router = useRouter();

  const {
    login,
    loggingIn,
    loading,
    isAuthenticated,
    user,
  } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (loading || !isAuthenticated || !user) {
      return;
    }

    const role = user?.role?.toLowerCase?.();

    if (role === "admin") {
      router.replace("/admin");
      return;
    }

    if (role === "manager") {
      router.replace("/manager");
      return;
    }

    if (role === "user") {
      router.replace("/user");
      return;
    }

    setFormError("Aapke account ke paas valid role nahi hai.");
  }, [loading, isAuthenticated, user, router]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (loggingIn) {
      return;
    }

    setFormError("");

    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      setFormError("Apna email address darj karein.");
      return;
    }

    if (!password) {
      setFormError("Apna password darj karein.");
      return;
    }

    try {
      // 1. Fast execution of auth login request
      const result = await login(normalizedEmail, password);

      if (!result?.success) {
        setFormError(
          result?.error || "Ghalat email ya password darj kiya gaya hai."
        );
        return;
      }

      const role = result?.user?.role?.toLowerCase?.();

      // 2. Instant non-blocking route redirection
      if (role === "admin") {
        router.replace("/admin");
        return;
      }

      if (role === "manager") {
        router.replace("/manager");
        return;
      }

      if (role === "user") {
        router.replace("/user");
        return;
      }

      setFormError(
        "Aapke account ke paas valid role nahi hai."
      );
    } catch {
      setFormError(
        "Sign in karne mein dushwari pesh aayi. Dobara koshish karein."
      );
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#f7f8fc] px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      {/* Background ambient lighting */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-72 w-72 rounded-full bg-violet-400/10 blur-3xl" />
        <div className="absolute right-0 top-20 h-80 w-80 rounded-full bg-pink-400/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-orange-300/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-slate-200/80 bg-white p-8 shadow-[0_10px_35px_rgba(45,35,100,0.06)] sm:p-10">
        {/* Centered Branding */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-purple-600 text-white shadow-lg shadow-purple-600/20">
            <ShieldCheck size={24} />
          </div>

          <h1 className="mt-4 text-xl font-bold tracking-tight text-slate-900">
            Local Pro 1
          </h1>
          <p className="text-xs font-medium text-slate-400">
            Business Management Platform
          </p>
        </div>

        <div className="mb-6 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200/80 bg-violet-50/80 px-3 py-1 text-xs font-bold text-violet-700">
            SIGN IN
          </span>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">
            Welcome back
          </h2>
          <p className="mt-1 text-xs font-medium text-slate-500">
            Sign in to access your workspace.
          </p>
        </div>

        {/* Error Notification */}
        {formError && (
          <div
            role="alert"
            className="mb-5 flex items-center gap-2.5 rounded-2xl border border-rose-100 bg-rose-50/90 p-4 text-xs font-semibold text-rose-700 shadow-sm"
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-600 text-white font-bold text-[10px]">
              !
            </span>
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Field */}
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600"
            >
              Email Address
            </label>

            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={17} />

              <input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Enter your email"
                autoComplete="email"
                disabled={loggingIn || loading}
                className="h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/50 pl-11 pr-4 text-xs font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10 disabled:cursor-not-allowed disabled:bg-slate-100"
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label
                htmlFor="password"
                className="block text-xs font-bold uppercase tracking-wider text-slate-600"
              >
                Password
              </label>

              <button
                type="button"
                disabled={loggingIn || loading}
                className="text-xs font-bold text-violet-600 transition hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Forgot password?
              </button>
            </div>

            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={17} />

              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={loggingIn || loading}
                className="h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/50 pl-11 pr-11 text-xs font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10 disabled:cursor-not-allowed disabled:bg-slate-100"
              />

              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                disabled={loggingIn || loading}
                aria-label={
                  showPassword
                    ? "Hide password"
                    : "Show password"
                }
                className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Sign In Button */}
          <button
            type="submit"
            disabled={
              loggingIn ||
              loading ||
              !email.trim() ||
              !password
            }
            className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 text-xs font-bold text-white shadow-lg shadow-violet-600/25 transition duration-150 hover:-translate-y-0.5 hover:bg-violet-700 active:translate-y-0 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:hover:translate-y-0"
          >
            {loggingIn ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                <span>Signing in...</span>
              </>
            ) : (
              <span>Sign In</span>
            )}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-center gap-2 text-center text-[11px] font-medium text-slate-400">
          <ShieldCheck className="text-violet-600" size={14} />
          <span>Secure access to your workspace</span>
        </div>
      </div>
    </main>
  );
}