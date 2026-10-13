"use client";

import { CheckCircle2, FileText, Sparkles } from "lucide-react";

export default function PoliciesPage() {
  const policies = [
    "Employees should be entitled to 8 Casual Leaves and 8 Sick Leaves annually.",
    "All leave requests should be sent via email to hr@localpro1.com.",
    "Leave should only be approved after confirmation from HR.",
    "Any leave taken without prior information or approval should be marked as absent.",
    "If leaves exceed the annual limit, salary should be deducted for the extra days.",
    "In case of sickness for more than 2 days, a medical certificate should be provided if required.",
    "Employees should inform HR in case of emergency leave as soon as possible.",
  ];

  return (
    <div className="relative min-h-screen w-full bg-[#f7f8fc] p-4 text-slate-900 sm:p-6 lg:p-8 animate-fadeIn">
      {/* Background ambient lighting */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-72 w-72 rounded-full bg-violet-400/10 blur-3xl animate-pulse" />
        <div className="absolute right-0 top-20 h-80 w-80 rounded-full bg-pink-400/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-orange-300/10 blur-3xl" />
      </div>

      <div className="mx-auto w-full max-w-5xl space-y-6">
        {/* HERO SECTION */}
        <section className="relative overflow-hidden rounded-[30px] bg-gradient-to-br from-[#4211b8] via-[#6414d8] to-[#a617c8] p-6 text-white shadow-[0_25px_70px_rgba(93,36,190,0.25)] sm:p-8">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-fuchsia-400/20 blur-2xl" />
          <div className="relative z-10">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-md">
              <Sparkles size={13} />
              Employee Guidelines
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl lg:text-4xl">
              Employee&apos;s Leave Policy
            </h1>
            <p className="mt-2 text-sm text-white/80 max-w-xl">
              Localpro1 2026 Guidelines. Please review the official leave rules and policies.
            </p>
          </div>
        </section>

        {/* POLICY LIST CONTAINER */}
        <section className="overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-[0_10px_35px_rgba(45,35,100,0.05)]">
          <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4.5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                <FileText size={18} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Official Regulations</h2>
                <p className="text-xs text-slate-500">Effective for 2026 operations.</p>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            <div className="space-y-4">
              {policies.map((policy, index) => (
                <div
                  key={index}
                  className="group flex gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5 transition duration-150 hover:border-violet-200 hover:bg-violet-50/30"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 transition group-hover:bg-violet-600 group-hover:text-white">
                    <CheckCircle2 size={17} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-violet-600">
                      Policy Rule {index + 1}
                    </p>
                    <p className="text-xs font-medium leading-relaxed text-slate-700 sm:text-sm">
                      {policy}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}