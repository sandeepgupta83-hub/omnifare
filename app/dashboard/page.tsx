"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "../../components/Navbar";
import {
  TrendingUp,
  History,
  CheckCircle,
  ChevronRight,
  Shield,
  ArrowUpRight,
  RefreshCw,
  Lock,
} from "lucide-react";

interface RideHistoryItem {
  id: string;
  date: string;
  pickup_address: string;
  drop_address: string;
  pickup_lat: number;
  pickup_lng: number;
  drop_lat: number;
  drop_lng: number;
  vehicle_category: string;
  provider: string;
  price_selected: number;
  highest_fare: number;
  wealth_saved: number;
}

export default function UserDashboard() {
  // Database States
  const [rides, setRides] = useState<RideHistoryItem[]>([]);
  const [totalSaved, setTotalSaved] = useState(0);
  const [totalRidesCount, setTotalRidesCount] = useState(0);

  // Auth / Accounts Syncing States
  const [linkedServices, setLinkedServices] = useState({
    uber: { linked: false, phone: "", tier: "Standard Member" },
    ola: { linked: false, phone: "", tier: "Standard Member" },
  });

  const [activeSyncModal, setActiveSyncModal] = useState<"uber" | "ola" | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpStep, setOtpStep] = useState(1); // 1 = Phone input, 2 = OTP verification
  const [isSyncing, setIsSyncing] = useState(false);

  // Synchronized Customer Session State
  const [session, setSession] = useState<{ email: string; name: string; isLoggedIn: boolean }>({
    email: "",
    name: "",
    isLoggedIn: false,
  });

  // Seed default items in LocalStorage if it's empty so the demo dashboard looks spectacular immediately!
  useEffect(() => {
    if (typeof window !== "undefined") {
      // 1. Load Session Status
      const loadSession = () => {
        const storedSession = localStorage.getItem("omnifare_user_session");
        if (storedSession) {
          setSession(JSON.parse(storedSession));
        } else {
          setSession({ email: "", name: "", isLoggedIn: false });
        }
      };

      loadSession();

      // 2. Load Ride History
      const storedHistory = localStorage.getItem("omnifare_rides_history");
      if (storedHistory) {
        const history: RideHistoryItem[] = JSON.parse(storedHistory);
        setRides(history);
        calculateStats(history);
      } else {
        // Pre-populate with beautiful high-fidelity mock ride records
        const seedHistory: RideHistoryItem[] = [
          {
            id: "ride-1",
            date: new Date(Date.now() - 3600000 * 24 * 1.5).toISOString(), // 1.5 days ago
            pickup_address: "Kempegowda International Airport (BLR), Bangalore",
            drop_address: "Indiranagar 100 Feet Road, Bangalore",
            pickup_lat: 13.1986,
            pickup_lng: 77.7066,
            drop_lat: 12.9719,
            drop_lng: 77.6412,
            vehicle_category: "Eco Cab",
            provider: "ONDC (Yatri Sathi)",
            price_selected: 820,
            highest_fare: 1150, // Uber Premier was 1150
            wealth_saved: 330,
          },
          {
            id: "ride-2",
            date: new Date(Date.now() - 3600000 * 24 * 3).toISOString(), // 3 days ago
            pickup_address: "Indiranagar Metro Station, Bangalore",
            drop_address: "Forum Mall Koramangala, Bangalore",
            pickup_lat: 12.9784,
            pickup_lng: 77.6408,
            drop_lat: 12.9352,
            drop_lng: 77.6133,
            vehicle_category: "Auto",
            provider: "ONDC (Namma Yatri)",
            price_selected: 110,
            highest_fare: 175, // Ola Auto was 175
            wealth_saved: 65,
          },
          {
            id: "ride-3",
            date: new Date(Date.now() - 3600000 * 24 * 5.2).toISOString(), // 5.2 days ago
            pickup_address: "Phoenix Marketcity, Mahadevapura, Bangalore",
            drop_address: "Whitefield Main Road, Bangalore",
            pickup_lat: 12.9968,
            pickup_lng: 77.6961,
            drop_lat: 12.9698,
            drop_lng: 77.7499,
            vehicle_category: "Bike",
            provider: "Rapido",
            price_selected: 75,
            highest_fare: 110, // Uber Moto was 110
            wealth_saved: 35,
          },
        ];
        localStorage.setItem("omnifare_rides_history", JSON.stringify(seedHistory));
        setRides(seedHistory);
        calculateStats(seedHistory);
      }

      // 3. Load Account Sync Statuses
      const storedServices = localStorage.getItem("omnifare_linked_services");
      if (storedServices) {
        setLinkedServices(JSON.parse(storedServices));
      } else {
        const defaultServices = {
          uber: { linked: false, phone: "", tier: "Standard Member" },
          ola: { linked: false, phone: "", tier: "Standard Member" },
        };
        localStorage.setItem("omnifare_linked_services", JSON.stringify(defaultServices));
        setLinkedServices(defaultServices);
      }

      // Dynamic listeners
      window.addEventListener("storage", loadSession);
      window.addEventListener("omnifare_sync_storage", loadSession);

      return () => {
        window.removeEventListener("storage", loadSession);
        window.removeEventListener("omnifare_sync_storage", loadSession);
      };
    }
  }, []);

  const calculateStats = (history: RideHistoryItem[]) => {
    const total = history.reduce((sum, item) => sum + item.wealth_saved, 0);
    setTotalSaved(total);
    setTotalRidesCount(history.length);
  };

  // CLEAR HISTORY LOG
  const handleClearHistory = () => {
    localStorage.removeItem("omnifare_rides_history");
    setRides([]);
    setTotalSaved(0);
    setTotalRidesCount(0);
  };

  // IN-APP SERVICE LINKER HANDLERS
  const openSyncModal = (service: "uber" | "ola") => {
    setPhoneNumber("");
    setOtpCode("");
    setOtpStep(1);
    setActiveSyncModal(service);
  };

  const handleSendOtp = () => {
    if (phoneNumber.length < 10) return;
    setIsSyncing(true);
    // Simulate API dispatch time
    setTimeout(() => {
      setIsSyncing(false);
      setOtpStep(2);
    }, 1200);
  };

  const handleVerifyOtp = () => {
    if (otpCode.length < 4) return;
    setIsSyncing(true);

    setTimeout(() => {
      const updated = { ...linkedServices };
      if (activeSyncModal === "uber") {
        updated.uber = {
          linked: true,
          phone: phoneNumber,
          tier: "Uber VIP Gold Member", // High tier discount trigger!
        };
      } else if (activeSyncModal === "ola") {
        updated.ola = {
          linked: true,
          phone: phoneNumber,
          tier: "Ola Select Platinum", // High tier discount trigger!
        };
      }

      localStorage.setItem("omnifare_linked_services", JSON.stringify(updated));
      setLinkedServices(updated);
      setIsSyncing(false);
      setActiveSyncModal(null);
    }, 1500);
  };

  const handleDisconnect = (service: "uber" | "ola") => {
    const updated = { ...linkedServices };
    updated[service] = { linked: false, phone: "", tier: "Standard Member" };
    localStorage.setItem("omnifare_linked_services", JSON.stringify(updated));
    setLinkedServices(updated);
  };

  return (
    <div className="flex-1 min-h-screen bg-background text-foreground flex flex-col transition-colors duration-300 relative font-sans">
      {/* Visual background glowing orb */}
      <div className="absolute top-[20%] right-[10%] h-[400px] w-[400px] bg-emerald-500/5 rounded-full filter blur-[100px] pointer-events-none z-0"></div>
      <div className="absolute bottom-[10%] left-[5%] h-[350px] w-[350px] bg-teal-500/5 rounded-full filter blur-[80px] pointer-events-none z-0"></div>

      {/* Dynamic unified Navbar */}
      <Navbar />

      <main className="max-w-6xl mx-auto w-full px-6 py-8 flex flex-col gap-8 z-10 flex-1">
        
        {/* 1. DASHBOARD HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/60 dark:border-slate-900 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-400"></span>
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 tracking-widest uppercase">
                Aggregator Dashboard
              </span>
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 font-sora mt-1">
              Welcome back, {session.isLoggedIn ? session.name : "Guest Traveler"}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1">
              Unlock personalized live pricing and optimize your daily mobility spend.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/compare"
              className="px-5 py-3 rounded-xl font-bold text-xs tracking-wider uppercase btn-emerald-glow text-slate-950 hover:shadow-emerald-500/30 flex items-center gap-1.5 transition-all"
            >
              <ArrowUpRight className="h-4.5 w-4.5 stroke-[2.5px]" />
              Start Aggregating
            </Link>
          </div>
        </div>

        {/* 2. STATS & ANALYTICAL COUNTERS ROW */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Counter: Total Wealth Saved */}
          <div className="md:col-span-2 glass-panel p-6 rounded-2xl border border-slate-200 dark:border-slate-900/60 relative overflow-hidden flex flex-col justify-between h-48">
            <div className="absolute right-0 top-0 h-full w-1/3 bg-radial-gradient from-emerald-500/10 to-transparent pointer-events-none"></div>
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 tracking-widest uppercase">
                <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                TOTAL WEALTH SAVED
              </div>
              <h2 className="text-5xl font-black text-slate-900 dark:text-slate-100 font-sora mt-3 tracking-tight">
                ₹{totalSaved}
              </h2>
            </div>
            <div className="border-t border-slate-200/80 dark:border-slate-900/80 pt-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
              <span>Collective difference saved against peak market alternative options.</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">{totalRidesCount > 0 ? `~₹${Math.round(totalSaved / totalRidesCount)}/ride` : "No rides yet"}</span>
            </div>
          </div>

          {/* Side Counter: Metrics Card */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-200 dark:border-slate-900/60 flex flex-col justify-between h-48">
            <div>
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tracking-widest uppercase">
                MOBILITY FREQUENCY
              </span>
              <div className="flex items-baseline gap-2 mt-3">
                <span className="text-4xl font-extrabold text-slate-900 dark:text-slate-100 font-sora">{totalRidesCount}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">Aggregated Trips</span>
              </div>
            </div>
            <div className="border-t border-slate-200/80 dark:border-slate-900/80 pt-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
              <span>Avg savings:</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                {totalRidesCount > 0 ? `${Math.round((totalSaved / (totalSaved + rides.reduce((s, r) => s + r.price_selected, 0))) * 100)}%` : "0%"}
              </span>
            </div>
          </div>
        </div>

        {/* 3. MIDDLE DUAL GRID: RIDE APP LOGIN SYNC vs TRANSACTION LOG */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          
          {/* LEFT SEGMENT: Member Card / Auth Banner & Linked Accounts */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            
            {/* dynamic Member ID Card or Guest Sync Callout */}
            {session.isLoggedIn ? (
              /* Premium Member ID Card */
              <div className="relative p-6 rounded-2xl bg-gradient-to-tr from-indigo-950/40 via-[#111024]/80 to-emerald-950/20 border border-indigo-500/20 dark:border-indigo-400/25 shadow-xl shadow-indigo-950/5 overflow-hidden flex flex-col justify-between h-44 group animate-scaleUp">
                {/* Decorative chip/logo */}
                <div className="absolute right-6 top-6 h-10 w-10 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-lg opacity-85 flex items-center justify-center font-black text-slate-950 font-sora shadow-lg shadow-emerald-500/20">
                  O
                </div>
                <div className="absolute -left-10 -bottom-10 h-32 w-32 bg-indigo-500/10 rounded-full filter blur-xl group-hover:scale-110 transition-transform duration-500"></div>
                
                <div>
                  <span className="text-[9px] font-extrabold text-emerald-600 dark:text-emerald-400 tracking-widest uppercase bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    OMNIFARE PREMIUM MEMBER
                  </span>
                  <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 font-sora mt-2.5 tracking-tight capitalize">
                    {session.name}
                  </h4>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block mt-0.5">
                    ID: OM-9842-{session.email.split("@")[0].toUpperCase()}
                  </span>
                </div>
                
                <div className="flex items-center justify-between mt-4 pt-3.5 border-t border-slate-200/50 dark:border-slate-800/40 text-[9px] font-extrabold text-slate-400 dark:text-slate-500 tracking-wider">
                  <span>TIER: ELITE AGGREGATOR</span>
                  <span className="text-emerald-600 dark:text-emerald-400 animate-pulse">● ACTIVE INTEGRATED</span>
                </div>
              </div>
            ) : (
              /* Guest Welcome Card */
              <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-emerald-500/10 to-teal-500/10 border border-indigo-500/20 dark:border-indigo-400/20 shadow-lg flex flex-col gap-3.5 animate-scaleUp">
                <div className="flex items-start gap-2.5">
                  <div className="h-8 w-8 rounded-xl bg-indigo-500/20 dark:bg-indigo-500/10 flex items-center justify-center text-base shrink-0 mt-0.5 shadow-sm">
                    🔓
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 font-sora">
                      Unlock Personalized Loyalty Rates
                    </h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold leading-relaxed mt-0.5">
                      Sign in to link Uber VIP / Ola Select tiers and sync travel progress across devices.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => window.dispatchEvent(new Event("omnifare_trigger_auth"))}
                  className="w-full py-2.5 rounded-xl text-[10px] font-black tracking-wider uppercase bg-[#5e5aef] hover:bg-[#4f46e5] text-white shadow-md shadow-indigo-500/15 text-center cursor-pointer transition-all active:scale-[0.98]"
                >
                  Sign In / Sign Up
                </button>
              </div>
            )}

            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                Linked Ride Accounts
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Connect your accounts to securely scrape your loyalty discounts (Uber VIP, Ola Select) automatically for side-by-side matches.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              {/* UBER CONNECTION CARD */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-900 bg-white/70 dark:bg-slate-900/20 flex flex-col gap-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-xl bg-black border border-slate-800 flex items-center justify-center font-black text-slate-100 text-xs shadow-md">
                      U
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-300">Uber Account</h4>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block mt-0.5">
                        {linkedServices.uber.linked ? linkedServices.uber.tier : "Not Linked"}
                      </span>
                    </div>
                  </div>

                  {linkedServices.uber.linked ? (
                    <button
                      onClick={() => handleDisconnect("uber")}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-[10px] font-bold text-rose-500 hover:bg-rose-500/5 hover:border-rose-500/20 transition-all cursor-pointer"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      onClick={() => openSyncModal("uber")}
                      className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/30 text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 transition-all cursor-pointer shadow-sm"
                    >
                      Link Account
                    </button>
                  )}
                </div>
              </div>

              {/* OLA CONNECTION CARD */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-900 bg-white/70 dark:bg-slate-900/20 flex flex-col gap-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-xl bg-lime-400 border border-lime-500/20 flex items-center justify-center font-black text-slate-950 text-xs shadow-md">
                      O
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-300">Ola Account</h4>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block mt-0.5">
                        {linkedServices.ola.linked ? linkedServices.ola.tier : "Not Linked"}
                      </span>
                    </div>
                  </div>

                  {linkedServices.ola.linked ? (
                    <button
                      onClick={() => handleDisconnect("ola")}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-[10px] font-bold text-rose-500 hover:bg-rose-500/5 hover:border-rose-500/20 transition-all cursor-pointer"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      onClick={() => openSyncModal("ola")}
                      className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/30 text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 transition-all cursor-pointer shadow-sm"
                    >
                      Link Account
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT PANELS: Previous Rides Scrolling Ledger */}
          <div className="lg:col-span-3 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <History className="h-5 w-5 text-slate-400" />
                  Trip Travel Ledger
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Real-time transactional logs highlighting vehicle selections, provider networks, and wealth saved.
                </p>
              </div>
              {rides.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  className="text-[10px] font-bold text-slate-500 hover:text-rose-500 transition-colors uppercase tracking-wider cursor-pointer"
                >
                  Clear History
                </button>
              )}
            </div>

            <div className="flex flex-col gap-4 max-h-[460px] overflow-y-auto pr-1">
              {rides.length > 0 ? (
                rides.map((ride) => (
                  <div
                    key={ride.id}
                    className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-900/60 bg-white/70 dark:bg-slate-900/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel-hover"
                  >
                    <div className="flex items-start gap-3">
                      {/* Circle provider mark */}
                      <div
                        className={`h-9 w-9 rounded-xl border flex items-center justify-center font-black text-xs shrink-0 ${
                          ride.provider === "Uber"
                            ? "bg-slate-950 text-slate-100 border-slate-800"
                            : ride.provider === "Ola"
                            ? "bg-lime-400 text-slate-950 border-lime-500/20"
                            : ride.provider.includes("ONDC")
                            ? "bg-amber-500 text-slate-950 border-amber-500/30"
                            : "bg-yellow-400 text-slate-950 border-yellow-500/20"
                        }`}
                      >
                        {ride.provider.charAt(0)}
                      </div>
                      <div className="flex flex-col gap-1 max-w-[240px] sm:max-w-[320px]">
                        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 tracking-wide">
                          {new Date(ride.date).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <div className="flex items-center gap-1.5 text-xs text-slate-800 dark:text-slate-300 font-bold">
                          <span>{ride.pickup_address.split(",")[0]}</span>
                          <ChevronRight className="h-3 w-3 text-slate-400 dark:text-slate-600" />
                          <span>{ride.drop_address.split(",")[0]}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                          {ride.provider} • {ride.vehicle_category}
                        </span>
                      </div>
                    </div>

                    <div className="text-left sm:text-right shrink-0">
                      <span className="text-sm font-extrabold text-slate-900 dark:text-slate-200 font-sora">
                        ₹{ride.price_selected}
                      </span>
                      {ride.wealth_saved > 0 && (
                        <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400/90 flex items-center sm:justify-end gap-1 mt-0.5 animate-pulse">
                          <span>Saved ₹{ride.wealth_saved}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-16 border border-dashed border-slate-200 dark:border-slate-900 rounded-2xl flex flex-col items-center justify-center gap-2 bg-white/30 dark:bg-transparent">
                  <History className="h-8 w-8 text-slate-400 dark:text-slate-600 animate-pulse" />
                  <p className="text-slate-500 dark:text-slate-400 text-xs font-bold">No ride histories recorded</p>
                  <span className="text-slate-400 dark:text-slate-500 text-[10px] leading-relaxed px-12">
                    Once you start looking up comparisons and booking rides, your live travel logs will show up here.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* 4. HIGH-FIDELITY ACCOUNT SYNC MODAL */}
      {activeSyncModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm glass-panel p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col gap-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-900 pb-3">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 capitalize">
                <Lock className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                Link {activeSyncModal} API Client
              </h3>
              <button
                onClick={() => setActiveSyncModal(null)}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-bold cursor-pointer"
              >
                Close
              </button>
            </div>

            {otpStep === 1 ? (
              <div className="flex flex-col gap-4">
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                  Enter your registered mobile phone number. OmniFare will fetch your linked profile details, vouchers, and customized tier levels.
                </p>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">PHONE NUMBER</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-3.5 text-xs text-slate-400 dark:text-slate-500 font-bold">+91</span>
                    <input
                      type="tel"
                      value={phoneNumber}
                      maxLength={10}
                      placeholder="98765 43210"
                      onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ""))}
                      className="w-full pl-12 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-emerald-500/40 focus:bg-white dark:focus:bg-slate-950 font-semibold"
                    />
                  </div>
                </div>

                <button
                  disabled={phoneNumber.length < 10 || isSyncing}
                  onClick={handleSendOtp}
                  className="w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider btn-emerald-glow text-slate-950 hover:shadow-emerald-500/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                >
                  {isSyncing ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    "Send Verification Code"
                  )}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                  We sent a 4-digit verification code to <span className="text-slate-800 dark:text-slate-300 font-bold">+91 {phoneNumber}</span>. Type any 4 digits to sync (e.g. <span className="text-emerald-500 dark:text-emerald-400 font-semibold font-mono">1234</span>).
                </p>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">4-DIGIT VERIFICATION CODE</label>
                  <input
                    type="text"
                    maxLength={4}
                    value={otpCode}
                    placeholder="Enter code"
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-center tracking-[8px] text-lg font-bold font-mono text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-emerald-500/40 focus:bg-white dark:focus:bg-slate-950"
                  />
                </div>

                <button
                  disabled={otpCode.length < 4 || isSyncing}
                  onClick={handleVerifyOtp}
                  className="w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider btn-emerald-glow text-slate-950 hover:shadow-emerald-500/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                >
                  {isSyncing ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    "Verify & Establish API Link"
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
