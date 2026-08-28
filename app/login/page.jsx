"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
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

  /*
   * If the user is already authenticated and opens /login,
   * send them directly to their own dashboard.
   *
   * This prevents authenticated users from staying on the
   * login page.
   */
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

    setFormError("Your account does not have a valid role.");
  }, [loading, isAuthenticated, user, router]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (loggingIn) {
      return;
    }

    setFormError("");

    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      setFormError("Please enter your email address.");
      return;
    }

    if (!password) {
      setFormError("Please enter your password.");
      return;
    }

    try {
      const result = await login(normalizedEmail, password);

      if (!result?.success) {
        setFormError(
          result?.error || "Invalid email or password."
        );
        return;
      }

      const role = result?.user?.role?.toLowerCase?.();

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
        "Your account does not have a valid role."
      );
    } catch {
      setFormError(
        "Unable to sign in. Please try again."
      );
    }
  };

  return (
    <main className="min-h-screen bg-[#F8FAFC]">
      <div className="grid min-h-screen lg:grid-cols-2">
        {/* Left Side */}
        <section className="hidden bg-[#171B3A] lg:flex">
          <div className="flex w-full flex-col justify-between p-12 xl:p-16">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#2563EB] text-white">
                <ShieldCheck size={23} />
              </div>

              <div>
                <h1 className="text-xl font-bold text-white">
                  Local Pro 1
                </h1>

                <p className="mt-0.5 text-xs text-slate-400">
                  Business Management Platform
                </p>
              </div>
            </div>

            <div className="max-w-md">
              <div className="mb-5 h-1 w-12 rounded-full bg-[#2563EB]" />

              <h2 className="text-3xl font-semibold leading-tight text-white xl:text-4xl">
                Welcome to Local Pro 1
              </h2>

              <p className="mt-5 text-base leading-7 text-slate-300">
                A simple and secure workspace for managing your
                business, team, tasks, and daily operations.
              </p>
            </div>

            <p className="text-sm text-slate-500">
              © {new Date().getFullYear()} Local Pro 1
            </p>
          </div>
        </section>

        {/* Right Side */}
        <section className="flex min-h-screen items-center justify-center bg-white px-5 py-10 sm:px-8 lg:px-12">
          <div className="w-full max-w-md">
            {/* Mobile Branding */}
            <div className="mb-10 flex items-center gap-3 lg:hidden">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#2563EB] text-white">
                <ShieldCheck size={23} />
              </div>

              <div>
                <h1 className="text-xl font-bold text-[#171B3A]">
                  Local Pro 1
                </h1>

                <p className="text-xs text-[#64748B]">
                  Business Management Platform
                </p>
              </div>
            </div>

            <div className="mb-8">
              <p className="text-sm font-semibold text-[#2563EB]">
                SIGN IN
              </p>

              <h2 className="mt-2 text-3xl font-bold tracking-tight text-[#171B3A]">
                Welcome back
              </h2>

              <p className="mt-2 text-sm leading-6 text-[#64748B]">
                Sign in to access your Local Pro 1 workspace.
              </p>
            </div>

            {/* Error */}
            {formError && (
              <div
                role="alert"
                className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
              >
                {formError}
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="space-y-5"
            >
              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-semibold text-[#26344D]"
                >
                  Email Address
                </label>

                <div className="relative">
                  <Mail
                    size={19}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#64748B]"
                  />

                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={(event) =>
                      setEmail(event.target.value)
                    }
                    placeholder="Enter your email"
                    autoComplete="email"
                    disabled={loggingIn || loading}
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-[#26344D] outline-none transition placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:bg-slate-50"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="block text-sm font-semibold text-[#26344D]"
                  >
                    Password
                  </label>

                  <button
                    type="button"
                    disabled={loggingIn || loading}
                    className="text-sm font-semibold text-[#2563EB] transition hover:text-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Forgot password?
                  </button>
                </div>

                <div className="relative">
                  <LockKeyhole
                    size={19}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#64748B]"
                  />

                  <input
                    id="password"
                    name="password"
                    type={
                      showPassword ? "text" : "password"
                    }
                    value={password}
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    disabled={loggingIn || loading}
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-12 text-sm text-[#26344D] outline-none transition placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:bg-slate-50"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        (current) => !current
                      )
                    }
                    disabled={loggingIn || loading}
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                    className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#64748B] transition hover:bg-slate-100 hover:text-[#26344D] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {showPassword ? (
                      <EyeOff size={19} />
                    ) : (
                      <Eye size={19} />
                    )}
                  </button>
                </div>
              </div>

              {/* Sign In */}
              <button
                type="submit"
                disabled={
                  loggingIn ||
                  loading ||
                  !email.trim() ||
                  !password
                }
                className="flex h-12 w-full items-center justify-center rounded-xl bg-[#2563EB] px-5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#1D4ED8] hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
              >
                {loggingIn
                  ? "Signing in..."
                  : "Sign In"}
              </button>
            </form>

            <div className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-[#64748B]">
              <ShieldCheck
                size={15}
                className="text-[#2563EB]"
              />

              <span>
                Secure access to your business workspace
              </span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
