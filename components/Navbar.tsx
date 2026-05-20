"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sun,
  Moon,
  Contrast,
  Laptop,
  User,
  LogOut,
  Lock,
  Mail,
  Sparkles,
  Smartphone,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";

interface UserSession {
  email: string;
  name: string;
  isLoggedIn: boolean;
}

export default function Navbar() {
  const pathname = usePathname();

  // Authentication States
  const [session, setSession] = useState<UserSession>({
    email: "",
    name: "",
    isLoggedIn: false,
  });
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTab, setAuthTab] = useState<"signin" | "signup">("signin");
  const [emailInput, setEmailInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Theme Switcher States ("light" | "dark" | "hybrid" | "system")
  const [theme, setTheme] = useState<"light" | "dark" | "hybrid" | "system">("system");

  // Dynamic analytic counters for the Navbar pill
  const [savedAmount, setSavedAmount] = useState(0);
  const [ridesCount, setRidesCount] = useState(0);

  // 1. DYNAMIC SYSTEM/USER THEME CALIBRATION
  useEffect(() => {
    // Load stored theme or default to system
    const storedTheme = localStorage.getItem("omnifare_theme") as "light" | "dark" | "hybrid" | "system" | null;
    if (storedTheme) {
      setTheme(storedTheme);
      applyTheme(storedTheme);
    } else {
      applyTheme("system");
    }

    // Dynamic system media query listener
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
        window.dispatchEvent(new CustomEvent("omnifare_theme_changed", { detail: e.matches ? "dark" : "light" }));
      }
    };
    mediaQuery.addEventListener("change", handleSystemThemeChange);

    // Global listener so other elements can open the Auth Modal easily
    const handleTriggerAuth = () => {
      setAuthTab("signin");
      setShowAuthModal(true);
    };
    window.addEventListener("omnifare_trigger_auth", handleTriggerAuth);

    // Load active session from localStorage
    const storedSession = localStorage.getItem("omnifare_user_session");
    if (storedSession) {
      setSession(JSON.parse(storedSession));
    }

    // Load stats for the top pill
    const storedHistory = localStorage.getItem("omnifare_rides_history");
    if (storedHistory) {
      const history = JSON.parse(storedHistory);
      const total = history.reduce((sum: number, item: any) => sum + (item.wealth_saved || 0), 0);
      setSavedAmount(total);
      setRidesCount(history.length);
    }

    // Listen to localstorage updates in case transactions happen on other pages
    const handleStorageChange = () => {
      const storedHistory = localStorage.getItem("omnifare_rides_history");
      if (storedHistory) {
        const history = JSON.parse(storedHistory);
        const total = history.reduce((sum: number, item: any) => sum + (item.wealth_saved || 0), 0);
        setSavedAmount(total);
        setRidesCount(history.length);
      }

      const storedSession = localStorage.getItem("omnifare_user_session");
      if (storedSession) {
        setSession(JSON.parse(storedSession));
      } else {
        setSession({ email: "", name: "", isLoggedIn: false });
      }
    };

    window.addEventListener("storage", handleStorageChange);
    // Listen to internal custom storage sync events as well
    window.addEventListener("omnifare_sync_storage", handleStorageChange);

    return () => {
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
      window.removeEventListener("omnifare_trigger_auth", handleTriggerAuth);
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("omnifare_sync_storage", handleStorageChange);
    };
  }, []);

  const applyTheme = (newTheme: "light" | "dark" | "hybrid" | "system") => {
    const root = document.documentElement;
    let resolvedTheme: "light" | "dark" | "hybrid" = "dark";

    if (newTheme === "dark") {
      root.classList.add("dark");
      root.classList.remove("hybrid");
      resolvedTheme = "dark";
    } else if (newTheme === "light") {
      root.classList.remove("dark");
      root.classList.remove("hybrid");
      resolvedTheme = "light";
    } else if (newTheme === "hybrid") {
      root.classList.remove("dark");
      root.classList.add("hybrid");
      resolvedTheme = "hybrid";
    } else {
      // System generated mode
      root.classList.remove("hybrid");
      const systemIsDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (systemIsDark) {
        root.classList.add("dark");
        resolvedTheme = "dark";
      } else {
        root.classList.remove("dark");
        resolvedTheme = "light";
      }
    }

    // Dispatch custom event to notify dynamic Leaflet Map tiles
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("omnifare_theme_changed", { detail: resolvedTheme }));
    }, 50);
  };

  const handleThemeChange = (newTheme: "light" | "dark" | "hybrid" | "system") => {
    setTheme(newTheme);
    localStorage.setItem("omnifare_theme", newTheme);
    applyTheme(newTheme);
  };

  // 2. MOCK CUSTOMER AUTH LOGIC
  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput || !passwordInput) return;
    setIsSubmitting(true);

    setTimeout(() => {
      const userSession = {
        email: emailInput,
        name: authTab === "signup" ? nameInput || "Ride Partner" : "Ride Partner",
        isLoggedIn: true,
      };
      localStorage.setItem("omnifare_user_session", JSON.stringify(userSession));
      setSession(userSession);
      setIsSubmitting(false);
      setShowAuthModal(false);
      
      // Dispatch sync event so other pages know user is logged in
      window.dispatchEvent(new Event("omnifare_sync_storage"));
      
      // Clear inputs
      setEmailInput("");
      setNameInput("");
      setPasswordInput("");
    }, 1200);
  };

  const handleSignOut = () => {
    localStorage.removeItem("omnifare_user_session");
    setSession({ email: "", name: "", isLoggedIn: false });
    window.dispatchEvent(new Event("omnifare_sync_storage"));
  };

  return (
    <>
      <nav className="w-full border-b border-slate-200/40 dark:border-slate-900 hybrid:border-slate-900 bg-white/60 dark:bg-slate-950/60 hybrid:bg-[#0c0a1a]/90 backdrop-blur-md sticky top-0 z-40 transition-colors duration-300">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          
          {/* Logo with Green Circle O */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-500 via-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-all">
              <span className="font-extrabold text-slate-950 text-base font-sora">O</span>
            </div>
            <span className="font-black text-lg text-slate-900 dark:text-slate-100 hybrid:text-slate-100 tracking-tight font-sora">
              Omni<span className="text-emerald-500 dark:text-emerald-400">Fare</span>
            </span>
          </Link>

          {/* Quick Nav Links */}
          <div className="hidden md:flex items-center gap-6">
            <Link
              href="/compare"
              className={`text-xs font-bold uppercase tracking-wider transition-colors ${
                pathname === "/compare"
                  ? "text-indigo-500 dark:text-indigo-400 hybrid:text-indigo-400"
                  : "text-slate-500 dark:text-slate-400 hybrid:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hybrid:hover:text-slate-200"
              }`}
            >
              Compare Fares
            </Link>
            <Link
              href="/dashboard"
              className={`text-xs font-bold uppercase tracking-wider transition-colors ${
                pathname === "/dashboard"
                  ? "text-indigo-500 dark:text-indigo-400 hybrid:text-indigo-400"
                  : "text-slate-500 dark:text-slate-400 hybrid:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hybrid:hover:text-slate-200"
              }`}
            >
              Dashboard
            </Link>
          </div>

          {/* Right Segment: Stats Pill + Theme + Account */}
          <div className="flex items-center gap-4">
            
            {/* Savings stats pill directly matching original prototype look */}
            <Link 
              href="/dashboard" 
              className="flex flex-col text-right bg-slate-100/80 dark:bg-[#0c0a1a] hybrid:bg-[#080616] px-3.5 py-1.5 rounded-xl border border-slate-200/50 dark:border-[#221e42]/50 hybrid:border-indigo-500/20 hover:border-emerald-500/30 transition-all shadow-sm"
            >
              <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 hybrid:text-emerald-400 font-sora">
                ₹{savedAmount}
              </span>
              <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 hybrid:text-slate-400 tracking-wide uppercase">
                saved • {ridesCount} {ridesCount === 1 ? "ride" : "rides"}
              </span>
            </Link>

            {/* Premium segmented control theme selector */}
            <div className="flex items-center bg-slate-100 dark:bg-[#0c0a1a] hybrid:bg-[#080616] p-0.5 rounded-xl border border-slate-200/80 dark:border-[#221e42]/60 hybrid:border-indigo-500/20 shadow-inner">
              <button
                onClick={() => handleThemeChange("light")}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  theme === "light"
                    ? "bg-white dark:bg-slate-800 hybrid:bg-slate-800 text-amber-500 shadow-md scale-105"
                    : "text-slate-400 dark:text-slate-500 hybrid:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hybrid:hover:text-slate-300"
                }`}
                title="Light Mode"
              >
                <Sun className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => handleThemeChange("dark")}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  theme === "dark"
                    ? "bg-white dark:bg-slate-800 hybrid:bg-slate-800 text-indigo-400 shadow-md scale-105"
                    : "text-slate-400 dark:text-slate-500 hybrid:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hybrid:hover:text-slate-300"
                }`}
                title="Dark Mode"
              >
                <Moon className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => handleThemeChange("hybrid")}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  theme === "hybrid"
                    ? "bg-white dark:bg-slate-800 hybrid:bg-slate-800 text-indigo-500 hybrid:text-indigo-400 shadow-md scale-105"
                    : "text-slate-400 dark:text-slate-500 hybrid:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hybrid:hover:text-slate-300"
                }`}
                title="Mixed Mode"
              >
                <Contrast className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => handleThemeChange("system")}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  theme === "system"
                    ? "bg-white dark:bg-slate-800 hybrid:bg-slate-800 text-emerald-400 shadow-md scale-105"
                    : "text-slate-400 dark:text-slate-500 hybrid:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hybrid:hover:text-slate-300"
                }`}
                title="System Generated Mode"
              >
                <Laptop className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Auth Session Button */}
            {session.isLoggedIn ? (
              <div className="flex items-center gap-3">
                {/* User avatar indicator */}
                <Link href="/dashboard" className="h-8 w-8 rounded-xl bg-gradient-to-tr from-indigo-500/10 to-emerald-500/10 border border-indigo-500/20 hybrid:border-indigo-500/20 hover:border-emerald-500/50 flex items-center justify-center text-indigo-500 dark:text-indigo-400 hybrid:text-indigo-400 transition-all" title={session.email}>
                  <User className="h-4 w-4" />
                </Link>
                <button
                  onClick={handleSignOut}
                  className="hidden md:flex items-center gap-1.5 text-[10px] font-bold text-slate-500 hybrid:text-slate-400 hover:text-rose-500 hybrid:hover:text-rose-400 transition-colors uppercase tracking-wider cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setAuthTab("signin");
                  setShowAuthModal(true);
                }}
                className="px-4 py-2 rounded-xl text-xs font-black tracking-wider uppercase border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hybrid:text-emerald-400 bg-gradient-to-r from-emerald-500/5 to-teal-500/5 hover:from-emerald-500 hover:to-teal-400 hover:text-slate-950 dark:hover:text-slate-950 hybrid:hover:text-slate-950 transition-all cursor-pointer shadow-md shadow-emerald-500/5"
              >
                Sign In / Sign Up
              </button>
            )}

          </div>
        </div>
      </nav>

      {/* 3. PREMIUM SIGN UP / SIGN IN DIALOG PORTAL */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm glass-panel p-6 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-2xl flex flex-col gap-4 animate-scaleUp">
            
            {/* Header / Tabs */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-900 pb-3">
              <div className="flex gap-4">
                <button
                  onClick={() => setAuthTab("signin")}
                  className={`text-sm font-bold tracking-wide uppercase transition-colors cursor-pointer ${
                    authTab === "signin"
                      ? "text-emerald-500 dark:text-emerald-400"
                      : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                  }`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => setAuthTab("signup")}
                  className={`text-sm font-bold tracking-wide uppercase transition-colors cursor-pointer ${
                    authTab === "signup"
                      ? "text-emerald-500 dark:text-emerald-400"
                      : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                  }`}
                >
                  Sign Up
                </button>
              </div>
              <button
                onClick={() => setShowAuthModal(false)}
                className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-bold"
              >
                Cancel
              </button>
            </div>

            {/* Sparkle Notification info */}
            <div className="flex items-start gap-2 bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/10 text-[10px] text-emerald-500/90 leading-relaxed font-semibold">
              <Sparkles className="h-4 w-4 shrink-0 mt-0.5" />
              <span>Sign in to automatically sync your trip ledgers and save wealth progress across devices!</span>
            </div>

            {/* Input Form */}
            <form onSubmit={handleAuthSubmit} className="flex flex-col gap-3.5">
              
              {authTab === "signup" && (
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">FULL NAME</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
                    <input
                      type="text"
                      required
                      value={nameInput}
                      placeholder="e.g. John Doe"
                      onChange={(e) => setNameInput(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-emerald-500/40"
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">EMAIL ADDRESS</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
                  <input
                    type="email"
                    required
                    value={emailInput}
                    placeholder="name@example.com"
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-emerald-500/40"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">PASSWORD</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={passwordInput}
                    placeholder="••••••••"
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-emerald-500/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 mt-2 rounded-xl font-bold text-xs uppercase tracking-wider btn-emerald-glow text-slate-950 hover:shadow-emerald-500/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : authTab === "signin" ? (
                  "Access Account"
                ) : (
                  "Create Secure Account"
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
