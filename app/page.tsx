"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Smartphone,
  Shield,
  ArrowRight,
  Sparkles,
  Zap,
  Globe,
  Sun,
  Moon,
  Contrast,
  Laptop,
} from "lucide-react";

export default function LandingPage() {
  const [theme, setTheme] = useState<"light" | "dark" | "hybrid" | "system">("system");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedTheme = localStorage.getItem("omnifare_theme") as "light" | "dark" | "hybrid" | "system" | null;
      if (storedTheme) {
        setTheme(storedTheme);
        applyTheme(storedTheme);
      } else {
        applyTheme("system");
      }

      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleSystemThemeChange = (e: MediaQueryListEvent) => {
        const stored = localStorage.getItem("omnifare_theme");
        if (!stored || stored === "system") {
          const root = document.documentElement;
          if (e.matches) {
            root.classList.add("dark");
            root.classList.remove("hybrid");
          } else {
            root.classList.remove("dark");
            root.classList.remove("hybrid");
          }
        }
      };
      mediaQuery.addEventListener("change", handleSystemThemeChange);
      return () => mediaQuery.removeEventListener("change", handleSystemThemeChange);
    }
  }, []);

  const applyTheme = (newTheme: "light" | "dark" | "hybrid" | "system") => {
    const root = document.documentElement;
    if (newTheme === "dark") {
      root.classList.add("dark");
      root.classList.remove("hybrid");
    } else if (newTheme === "light") {
      root.classList.remove("dark");
      root.classList.remove("hybrid");
    } else if (newTheme === "hybrid") {
      root.classList.remove("dark");
      root.classList.add("hybrid");
    } else {
      root.classList.remove("hybrid");
      const systemIsDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (systemIsDark) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    }
  };

  const handleThemeChange = (nextTheme: "light" | "dark" | "hybrid" | "system") => {
    setTheme(nextTheme);
    localStorage.setItem("omnifare_theme", nextTheme);
    applyTheme(nextTheme);
  };

  return (
    <div className="flex-1 min-h-screen bg-background text-foreground flex flex-col justify-between relative overflow-hidden font-sans transition-colors duration-300">
      {/* Decorative gradient radial orbs for premium visual layout */}
      <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] bg-emerald-500/10 rounded-full filter blur-[120px] pointer-events-none z-0"></div>
      <div className="absolute bottom-[-10%] right-[-10%] h-[500px] w-[500px] bg-teal-500/10 rounded-full filter blur-[120px] pointer-events-none z-0"></div>

      {/* Header Navigation */}
      <header className="max-w-6xl mx-auto w-full px-6 py-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <span className="font-extrabold text-slate-950 text-base font-sora">O</span>
          </div>
          <span className="font-black text-lg text-slate-900 dark:text-slate-100 tracking-tight font-sora">
            Omni<span className="text-emerald-500 dark:text-emerald-400">Fare</span>
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Landing theme controller */}
          <div className="flex items-center bg-slate-100 dark:bg-[#0c0a1a] p-0.5 rounded-xl border border-slate-200 dark:border-[#221e42]/60 shadow-inner mr-2">
            <button
              onClick={() => handleThemeChange("light")}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                theme === "light"
                  ? "bg-white dark:bg-slate-800 text-amber-500 shadow-md scale-105"
                  : "text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
              title="Light Mode"
            >
              <Sun className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => handleThemeChange("dark")}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                theme === "dark"
                  ? "bg-white dark:bg-slate-800 text-indigo-400 shadow-md scale-105"
                  : "text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
              title="Dark Mode"
            >
              <Moon className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => handleThemeChange("hybrid")}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                theme === "hybrid"
                  ? "bg-white dark:bg-slate-800 text-indigo-500 shadow-md scale-105"
                  : "text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
              title="Mixed Mode"
            >
              <Contrast className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => handleThemeChange("system")}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                theme === "system"
                  ? "bg-white dark:bg-slate-800 text-emerald-400 shadow-md scale-105"
                  : "text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
              title="System Generated Mode"
            >
              <Laptop className="h-3.5 w-3.5" />
            </button>
          </div>

          <Link
            href="/dashboard"
            className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors uppercase tracking-wider"
          >
            Dashboard
          </Link>
          
          <Link
            href="/compare"
            className="px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:border-emerald-500/30 transition-all uppercase tracking-wider shadow-sm"
          >
            Launch App
          </Link>
        </div>
      </header>

      {/* Main Hero & Presentation Section */}
      <main className="max-w-5xl mx-auto w-full px-6 py-12 md:py-20 flex flex-col items-center text-center gap-12 z-10 flex-1 justify-center">
        {/* Sparkle Tag */}
        <div className="inline-flex items-center gap-2 bg-emerald-500/10 px-4 py-1.5 rounded-full border border-emerald-500/20 animate-pulse">
          <Sparkles className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 tracking-widest uppercase">
            COMMISSION-FREE RIDE COMPARISONS
          </span>
        </div>

        {/* Hero Headlines */}
        <div className="flex flex-col gap-4">
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-slate-900 dark:text-slate-100 font-sora leading-[1.1] max-w-3xl">
            Smarter Rides.<br />
            Personalized <span className="bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 dark:from-emerald-400 dark:via-teal-300 dark:to-emerald-400 bg-clip-text text-transparent">Live Fares</span>.
          </h1>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-semibold max-w-xl mx-auto leading-relaxed mt-2">
            OmniFare aggregates and calibrates 100% accurate, side-by-side pricing metrics across major ride networks—integrating your live Uber VIP and Ola Select loyalty tiers with open ONDC pathways.
          </p>
        </div>

        {/* Interactive CTA buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center sm:w-auto">
          <Link
            href="/compare"
            className="w-full sm:w-auto px-8 py-4 rounded-xl font-bold text-xs tracking-wider uppercase btn-emerald-glow text-slate-950 hover:shadow-emerald-500/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            Compare Live Fares
            <ArrowRight className="h-4.5 w-4.5 stroke-[2.5px]" />
          </Link>

          <Link
            href="/dashboard"
            className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100 flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
          >
            Access User Dashboard
          </Link>
        </div>

        {/* 4 Core Premium Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 w-full mt-8">
          {/* Card 1 */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-200 dark:border-slate-900/60 text-left flex flex-col justify-between h-44 hover:border-emerald-500/20 transition-all duration-300">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm">
              <Globe className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">Keyless Dual Maps</h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold leading-relaxed mt-1">
                Zero-config, completely free Nominatim autocomplete and OSRM routing bypassing Google Cloud constraints.
              </p>
            </div>
          </div>

          {/* Card 2 */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-200 dark:border-slate-900/60 text-left flex flex-col justify-between h-44 hover:border-emerald-500/20 transition-all duration-300">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm">
              <TrendingUp className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">Dynamic RTO Engine</h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold leading-relaxed mt-1">
                Calibrates Ola and Rapido prices on distance/duration matrices, scaled against real-time municipal rate tariffs.
              </p>
            </div>
          </div>

          {/* Card 3 */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-200 dark:border-slate-900/60 text-left flex flex-col justify-between h-44 hover:border-emerald-500/20 transition-all duration-300">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm">
              <Smartphone className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">In-App Account Link</h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold leading-relaxed mt-1">
                Simulates seamless phone SMS authentication to securely extract your loyalty rewards and display actual personal pricing.
              </p>
            </div>
          </div>

          {/* Card 4 */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-200 dark:border-slate-900/60 text-left flex flex-col justify-between h-44 hover:border-emerald-500/20 transition-all duration-300">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm">
              <Zap className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">ONDC Network Direct</h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold leading-relaxed mt-1">
                Connects open-protocol Beckn gateways (Namma Yatri) to secure 100% surge-free, zero-commission rates.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/60 dark:border-slate-900/60 py-6 text-center z-10 bg-slate-100/20 dark:bg-slate-950/20 backdrop-blur-sm">
        <p className="text-[9px] font-bold text-slate-500 dark:text-slate-600 tracking-wider uppercase">
          OMNIFARE MOBILITY TECHNOLOGIES • PROTOTYPE ECOSYSTEM
        </p>
      </footer>
    </div>
  );
}
