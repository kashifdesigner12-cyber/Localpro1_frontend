import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Eye,
  EyeOff,
  LockKeyhole,
  UserRound,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import api from "../../services/api";

export default function Login({ onLogin }) {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const normalizedUsername = username.trim().toLowerCase();

    if (!normalizedUsername || !password) {
      setError("Please enter your username and password.");
      return;
    }

    try {
      setLoading(true);

      const response = await api.post("/auth/login", {
        username: normalizedUsername,
        password,
      });

      const user = response.data?.user;

      if (!response.data?.success || !user?.role || !user?.id) {
        throw new Error("Invalid login response from server.");
      }

      if (!["admin", "manager", "user"].includes(user.role)) {
        throw new Error("Your account has an invalid role.");
      }

      if (typeof onLogin === "function") {
        onLogin(user);
      }

      navigate(user.role === "user" ? "/user/dashboard" : "/admin", {
        replace: true,
      });
    } catch (err) {
      setError(
        err.message || "Unable to sign in. Please check your credentials.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100/70 px-4 py-8 sm:px-6">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-2xl lg:grid-cols-2">
        <section className="relative hidden min-h-[620px] flex-col justify-between overflow-hidden bg-gradient-to-br from-[#292653] via-[#43387a] to-[#6555B7] p-10 text-white lg:flex xl:p-12">
          <div className="absolute -right-24 -top-20 h-80 w-80 rounded-full border border-white/10" />
          <div className="absolute -right-12 top-12 h-60 w-60 rounded-full border border-white/10" />
          <div className="absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-white/[0.06]" />

          <div className="relative z-10 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20 backdrop-blur-md">
              <ShieldCheck size={26} />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight">LocalPro1</h1>
              <p className="text-xs text-violet-200">
                Workspace Management
              </p>
            </div>
          </div>

          <div className="relative z-10 max-w-md">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-semibold backdrop-blur-md">
              <CheckCircle2 size={15} className="text-amber-300" />
              One workspace, everything organised
            </span>

            <h2 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight xl:text-5xl">
              Work better.
              <br />
              Stay organised.
            </h2>

            <p className="mt-4 max-w-sm text-sm leading-relaxed text-violet-100/90">
              Manage attendance, tasks and your team in one simple, professional workspace.
            </p>

            <div className="mt-8 space-y-3.5">
              {[
                "Track attendance and working hours",
                "Manage tasks and team activities",
                "Keep your workspace organised",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 text-sm font-medium text-violet-100"
                >
                  <CheckCircle2
                    size={18}
                    className="shrink-0 text-emerald-300"
                  />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <p className="relative z-10 text-xs font-medium text-violet-200/70">
            LocalPro1 CRM · Workspace Portal
          </p>
        </section>

        <section className="flex min-h-[600px] items-center justify-center px-6 py-12 sm:px-10 lg:min-h-[620px] xl:px-14">
          <div className="w-full max-w-md">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-sm">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900">
                  LocalPro1
                </h1>
                <p className="text-xs text-slate-400">
                  Workspace Management
                </p>
              </div>
            </div>

            <div className="mb-8">
              <span className="text-xs font-bold tracking-wider text-violet-600 uppercase">
                Welcome to LocalPro1
              </span>
              <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 mt-1">
                Sign in
              </h2>
              <p className="mt-1.5 text-xs text-slate-400">
                Sign in with your username and password.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="username"
                  className="mb-2 block text-sm font-bold text-slate-800"
                >
                  Username
                </label>

                <div className="relative">
                  <UserRound
                    size={18}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="Enter your username"
                    className="min-h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50/40 pl-11 pr-4 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-100"
                    required
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-bold text-slate-800"
                >
                  Password
                </label>

                <div className="relative">
                  <LockKeyhole
                    size={18}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    className="min-h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50/40 pl-11 pr-12 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-100"
                    required
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword((previous) => !previous)
                    }
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-xl p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  >
                    {showPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Signing in..." : "Sign in"}
                {!loading && <ArrowRight size={18} />}
              </button>
            </form>

            <div className="mt-8 flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
              <ShieldCheck
                size={19}
                className="mt-0.5 shrink-0 text-violet-600"
              />
              <p className="text-xs leading-relaxed text-slate-400">
                Your account role and permissions are verified securely by the server.
              </p>
            </div>

            <p className="mt-8 text-center text-xs text-slate-400">
              © LocalPro1 CRM · All rights reserved
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}