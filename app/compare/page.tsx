"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import Navbar from "../../components/Navbar";
import {
  MapPin,
  Navigation,
  ArrowUpDown,
  Search,
  ChevronRight,
  Filter,
  Sparkles,
  Smartphone,
  ChevronLeft,
  Loader2,
  Clock,
  Compass,
  TrendingUp,
  MapPinOff,
} from "lucide-react";

// Dynamically import Leaflet Map to prevent SSR build issues
const LeafletMap = dynamic(() => import("../../components/LeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-100 dark:bg-slate-900/60 animate-pulse flex flex-col items-center justify-center border border-slate-200 dark:border-slate-800 rounded-2xl min-h-[300px]">
      <Loader2 className="h-10 w-10 text-emerald-500 animate-spin mb-2" />
      <span className="text-slate-500 dark:text-slate-400 text-sm font-semibold">Loading maps context...</span>
    </div>
  ),
});

interface AutocompleteResult {
  display_name: string;
  place_id: string;
  is_google: boolean;
  lat: string;
  lng: string;
}

interface FareCard {
  id: string;
  name: string;
  provider: string;
  category: string;
  price: number;
  durationMinutes: number;
  etaMinutes: number;
  deeplink: string;
  discountApplied: string | null;
}

export default function RedesignedComparePage() {
  // Input fields state
  const [pickupText, setPickupText] = useState("");
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [dropText, setDropText] = useState("");
  const [dropCoords, setDropCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Suggestions states
  const [pickupSuggestions, setPickupSuggestions] = useState<AutocompleteResult[]>([]);
  const [dropSuggestions, setDropSuggestions] = useState<AutocompleteResult[]>([]);
  const [activeInput, setActiveInput] = useState<"pickup" | "drop" | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Aggregated fares state
  const [fares, setFares] = useState<Record<string, FareCard[]>>({});
  const [metadata, setMetadata] = useState<any>(null);
  const [isLoadingFares, setIsLoadingFares] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("Auto"); // Mapped to the highlighted category in screenshot
  const [sortBy, setSortBy] = useState<"cheapest" | "fastest">("cheapest");

  // Booking Feedback States
  const [bookedFare, setBookedFare] = useState<FareCard | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);

  const pickupTimer = useRef<NodeJS.Timeout | null>(null);
  const dropTimer = useRef<NodeJS.Timeout | null>(null);

  // Dynamic analytic pill counters
  const [savedAmount, setSavedAmount] = useState(0);
  const [ridesCount, setRidesCount] = useState(0);

  // Synchronized Customer Session State
  const [session, setSession] = useState<{ email: string; name: string; isLoggedIn: boolean }>({
    email: "",
    name: "",
    isLoggedIn: false,
  });

  // 1. AUTO-DETECT LOCATION ON INITIAL MOUNT
  useEffect(() => {
    if (typeof window !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          setPickupCoords({ lat: latitude, lng: longitude });
          
          try {
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`;
            const res = await fetch(url, {
              headers: { "User-Agent": "OmniFareAggregator" },
            });
            const data = await res.json();
            if (data?.display_name) {
              const addressShort = data.display_name.split(",").slice(0, 3).join(",");
              setPickupText(addressShort);
            } else {
              setPickupText(`My Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
            }
          } catch (e) {
            setPickupText(`My Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
          }
        },
        (error) => {
          console.warn("Geolocation auto-detection blocked. Defaulting to Bangalore center.", error);
          setPickupCoords({ lat: 12.9716, lng: 77.5946 });
          setPickupText("M.G. Road Metro Station, Bangalore");
        }
      );
    }

    // Load top pill stats
    const loadSessionAndStats = () => {
      const storedHistory = localStorage.getItem("omnifare_rides_history");
      if (storedHistory) {
        const history = JSON.parse(storedHistory);
        const total = history.reduce((sum: number, item: any) => sum + (item.wealth_saved || 0), 0);
        setSavedAmount(total);
        setRidesCount(history.length);
      } else {
        setSavedAmount(0);
        setRidesCount(0);
      }

      const storedSession = localStorage.getItem("omnifare_user_session");
      if (storedSession) {
        setSession(JSON.parse(storedSession));
      } else {
        setSession({ email: "", name: "", isLoggedIn: false });
      }
    };

    loadSessionAndStats();
    
    // Listener for custom sync triggers and storage updates
    window.addEventListener("storage", loadSessionAndStats);
    window.addEventListener("omnifare_sync_storage", loadSessionAndStats);

    return () => {
      window.removeEventListener("storage", loadSessionAndStats);
      window.removeEventListener("omnifare_sync_storage", loadSessionAndStats);
    };
  }, []);

  // 2. SECURE DUAL-ENGINE PLACES SEARCH PROXY
  const handlePickupChange = (val: string) => {
    setPickupText(val);
    if (!val.trim()) {
      setPickupSuggestions([]);
      return;
    }

    if (pickupTimer.current) clearTimeout(pickupTimer.current);
    pickupTimer.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const url = `/api/autocomplete?q=${encodeURIComponent(val)}`;
        const res = await fetch(url);
        const data = await res.json();
        setPickupSuggestions(data);
      } catch (err) {
        console.error("Autocomplete Search failed", err);
      } finally {
        setIsSearching(false);
      }
    }, 400);
  };

  const handleDropChange = (val: string) => {
    setDropText(val);
    if (!val.trim()) {
      setDropSuggestions([]);
      return;
    }

    if (dropTimer.current) clearTimeout(dropTimer.current);
    dropTimer.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const url = `/api/autocomplete?q=${encodeURIComponent(val)}`;
        const res = await fetch(url);
        const data = await res.json();
        setDropSuggestions(data);
      } catch (err) {
        console.error("Autocomplete Search failed", err);
      } finally {
        setIsSearching(false);
      }
    }, 400);
  };

  const handleSelectSuggestion = async (item: AutocompleteResult, type: "pickup" | "drop") => {
    setIsSearching(true);
    try {
      let coords = { lat: 0, lng: 0 };
      let shortName = item.display_name.split(",").slice(0, 3).join(",");

      if (item.is_google) {
        // Resolve precise coordinates and full address using details action
        const url = `/api/autocomplete?action=details&place_id=${item.place_id}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.lat && data.lng) {
          coords = { lat: data.lat, lng: data.lng };
          shortName = data.display_name.split(",").slice(0, 3).join(",");
        } else {
          throw new Error("Invalid coordinate details from proxy");
        }
      } else {
        // Direct coordinates from Nominatim fallback
        coords = { lat: parseFloat(item.lat), lng: parseFloat(item.lng) };
      }

      if (type === "pickup") {
        setPickupText(shortName);
        setPickupCoords(coords);
        setPickupSuggestions([]);
      } else {
        setDropText(shortName);
        setDropCoords(coords);
        setDropSuggestions([]);
      }
    } catch (err) {
      console.error("Failed to select address suggestion", err);
    } finally {
      setIsSearching(false);
      setActiveInput(null);
    }
  };

  const handleSwap = () => {
    const tempText = pickupText;
    const tempCoords = pickupCoords;
    
    setPickupText(dropText);
    setPickupCoords(dropCoords);
    setDropText(tempText);
    setDropCoords(tempCoords);
  };

  // 3. EMOJI PREFILL QUICK DESTINATIONS SHORTCUTS
  // Custom destinations mapped to highly realistic points in Bangalore for test compatibility
  const selectQuickDestination = (dest: "home" | "office" | "airport" | "station") => {
    if (dest === "home") {
      setPickupCoords({ lat: 12.9784, lng: 77.6408 }); // Indiranagar Metro
      setPickupText("Indiranagar 100 Feet Rd, Bangalore 🏠");
      
      setDropCoords({ lat: 12.9135, lng: 77.6324 }); // HSR Layout
      setDropText("HSR Layout Sector 3, Bangalore");
    } else if (dest === "office") {
      setPickupCoords({ lat: 12.9279, lng: 77.6833 }); // Bellandur Tech Park
      setPickupText("EcoSpace Business Park, Outer Ring Road 💼");
      
      setDropCoords({ lat: 12.9719, lng: 77.6412 }); // Indiranagar
      setDropText("Indiranagar 100 Feet Rd, Bangalore");
    } else if (dest === "airport") {
      setPickupCoords({ lat: 12.9716, lng: 77.5946 }); // MG Road Metro
      setPickupText("M.G. Road Metro Station, Bangalore ✈️");
      
      setDropCoords({ lat: 13.1986, lng: 77.7066 }); // BLR Airport
      setDropText("Kempegowda International Airport (BLR)");
    } else if (dest === "station") {
      setPickupCoords({ lat: 12.9352, lng: 77.6133 }); // Koramangala
      setPickupText("Koramangala 5th Block, Bangalore 🚉");
      
      setDropCoords({ lat: 12.9779, lng: 77.5696 }); // KSR Railway Stn
      setDropText("KSR Bangalore Railway Station");
    }
  };

  // 4. FETCH CONCURRENT AGGREGATOR FARES
  const handleCompareFares = async () => {
    if (!pickupCoords || !dropCoords) return;
    setIsLoadingFares(true);
    try {
      const storedServices = localStorage.getItem("omnifare_linked_services");
      const linkedServices = storedServices ? JSON.parse(storedServices) : null;

      const response = await fetch("/api/get-fares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup_lat: pickupCoords.lat,
          pickup_lng: pickupCoords.lng,
          drop_lat: dropCoords.lat,
          drop_lng: dropCoords.lng,
          linked_services: linkedServices,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setFares(data.fares);
        setMetadata(data.metadata);
      } else {
        console.error("API error getting fares:", data.error);
      }
    } catch (error) {
      console.error("Failed fetching aggregator fares:", error);
    } finally {
      setIsLoadingFares(false);
    }
  };

  // Auto-fetch if both coords exist initially (like when quick shortcuts are clicked)
  useEffect(() => {
    if (pickupCoords && dropCoords) {
      handleCompareFares();
    }
  }, [pickupCoords, dropCoords]);

  // Reconcile and filter lists based on categories
  const getCategorizedFares = (): FareCard[] => {
    let list: FareCard[] = [];
    
    // Map custom UI categories to backend category keys
    let categoryKey = selectedCategory;
    if (selectedCategory === "Mini") categoryKey = "EcoCab";
    if (selectedCategory === "Prime") categoryKey = "PremiumSedan";
    if (selectedCategory === "SUV") categoryKey = "SUV";
    
    list = fares[categoryKey] || [];

    // Sort accordingly
    if (sortBy === "cheapest") {
      return [...list].sort((a, b) => a.price - b.price);
    } else {
      return [...list].sort(
        (a, b) => a.durationMinutes + a.etaMinutes - (b.durationMinutes + b.etaMinutes)
      );
    }
  };

  const activeFares = getCategorizedFares();
  const cheapestFare = activeFares.length > 0 ? [...activeFares].sort((a, b) => a.price - b.price)[0] : null;
  const mostExpensiveFare = activeFares.length > 0 ? [...activeFares].sort((a, b) => b.price - a.price)[0] : null;

  const savings =
    cheapestFare && mostExpensiveFare && mostExpensiveFare.price > cheapestFare.price
      ? mostExpensiveFare.price - cheapestFare.price
      : 0;

  const savingsPercent =
    cheapestFare && mostExpensiveFare && mostExpensiveFare.price > 0
      ? Math.round((savings / mostExpensiveFare.price) * 100)
      : 0;

  // 5. BOOKING DISPATCH LOGGER HANDLER
  const handleBookRide = (fare: FareCard) => {
    setBookedFare(fare);
    setShowBookingModal(true);

    // Deep link redirection call
    setTimeout(() => {
      window.open(fare.deeplink, "_blank");
    }, 2000);

    // Log transaction
    const storedHistory = localStorage.getItem("omnifare_rides_history");
    const history = storedHistory ? JSON.parse(storedHistory) : [];

    const categoryKey = fare.category === "Eco Cab" ? "EcoCab" : fare.category;
    const categoryAlternatives = fares[categoryKey] || [];
    const maxAlternative = categoryAlternatives.length > 0 ? [...categoryAlternatives].sort((a, b) => b.price - a.price)[0] : null;
    const highestFare = maxAlternative ? maxAlternative.price : fare.price;
    const wealthSaved = Math.max(0, highestFare - fare.price);

    const newRide = {
      id: Math.random().toString(36).substring(7),
      date: new Date().toISOString(),
      pickup_address: pickupText || "Pickup Location",
      drop_address: dropText || "Dropoff Location",
      pickup_lat: pickupCoords?.lat,
      pickup_lng: pickupCoords?.lng,
      drop_lat: dropCoords?.lat,
      drop_lng: dropCoords?.lng,
      vehicle_category: fare.category,
      provider: fare.provider,
      price_selected: fare.price,
      highest_fare: highestFare,
      wealth_saved: wealthSaved,
    };

    const updatedHistory = [newRide, ...history];
    localStorage.setItem("omnifare_rides_history", JSON.stringify(updatedHistory));

    // Update Navbar stats
    const totalSaved = updatedHistory.reduce((sum, item) => sum + item.wealth_saved, 0);
    setSavedAmount(totalSaved);
    setRidesCount(updatedHistory.length);
  };

  return (
    <div className="flex-1 min-h-screen bg-background text-foreground flex flex-col transition-colors duration-300 relative font-sans">
      {/* Visual glowing layers */}
      <div className="absolute top-[20%] right-[-10%] h-[400px] w-[400px] bg-emerald-500/5 rounded-full filter blur-[100px] pointer-events-none z-0"></div>
      
      {/* Top Navbar */}
      <Navbar />

      {/* Main comparative workspace */}
      <main className="max-w-6xl mx-auto w-full px-4 lg:px-6 py-8 flex flex-col lg:flex-row gap-8 z-10 flex-1 h-[calc(100vh-80px)] overflow-hidden">
        
        {/* LEFT COLUMN: THE GORGEOUS COMPARISON CONTROL PANEL */}
        <div className="w-full lg:w-[480px] flex flex-col gap-6 h-full overflow-y-auto pr-1">
          
          {/* Header titles matching the exact original prototype layout style */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black font-sora tracking-tight text-slate-900 dark:text-slate-100">
                Omni<span className="text-emerald-500 dark:text-emerald-400">Fare</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-0.5 tracking-wide">
                Compare all cabs. Pay less. Always.
              </p>
            </div>
            
            {/* Visual Savings ledger link pill directly matching prototype screenshot for mob/cockpit sync */}
            <Link 
              href="/dashboard" 
              className="sm:hidden flex flex-col text-right bg-white dark:bg-[#0c0a1a] px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-[#221e42]/50 hover:border-emerald-500/30 transition-all shadow-sm"
            >
              <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 font-sora">
                ₹{savedAmount}
              </span>
              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 tracking-wide uppercase">
                saved • {ridesCount} {ridesCount === 1 ? "ride" : "rides"}
              </span>
            </Link>
          </div>

          {/* Prominent glowing welcome promo for guest logins */}
          {!session.isLoggedIn && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-emerald-500/10 to-teal-500/10 border border-indigo-500/20 dark:border-indigo-400/20 shadow-lg shadow-indigo-500/5 dark:shadow-indigo-950/20 flex flex-col sm:flex-row items-center justify-between gap-4 animate-scaleUp">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-xl bg-indigo-500/20 dark:bg-indigo-500/10 flex items-center justify-center text-lg shrink-0 mt-0.5 shadow-md">
                  🔓
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 font-sora">
                    Unlock Personalized Loyalty Rates
                  </h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold leading-relaxed mt-0.5">
                    Sign In / Sign Up to link your Uber VIP and Ola Select cards and fetch personal prices!
                  </p>
                </div>
              </div>
              <button
                onClick={() => window.dispatchEvent(new Event("omnifare_trigger_auth"))}
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-[10px] font-black tracking-wider uppercase bg-[#5e5aef] hover:bg-[#4f46e5] text-white shadow-md shadow-indigo-500/15 shrink-0 text-center cursor-pointer transition-all active:scale-[0.98]"
              >
                Sign In / Sign Up
              </button>
            </div>
          )}

          {/* Core Panel Card containing Inputs, Categories and comparing action button */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#0d0b1c]/80 hybrid:bg-[#0d0b1c]/95 border border-slate-200 dark:border-[#232145]/40 hybrid:border-[#232145]/60 shadow-xl dark:shadow-black/20 hybrid:shadow-indigo-950/10 flex flex-col gap-4 relative">
            
            {/* Input pickup/drop card panel */}
            <div className="flex flex-col gap-3 relative">
              
              {/* Swap action button */}
              <button
                onClick={handleSwap}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full border border-slate-200 dark:border-slate-800 hybrid:border-slate-800 bg-white dark:bg-slate-900 hybrid:bg-slate-900 text-slate-400 hover:text-emerald-500 hover:border-emerald-500/30 flex items-center justify-center transition-all z-10 shadow-md shadow-slate-100 dark:shadow-black cursor-pointer"
                title="Swap Locations"
              >
                <ArrowUpDown className="h-4.5 w-4.5" />
              </button>

              {/* Pickup Address Input */}
              <div className="relative">
                <span className="absolute left-3.5 top-4 flex h-2 w-2 rounded-full bg-indigo-500"></span>
                <input
                  type="text"
                  value={pickupText}
                  placeholder="Enter Pickup Location..."
                  onChange={(e) => handlePickupChange(e.target.value)}
                  onFocus={() => setActiveInput("pickup")}
                  className="w-full pl-9 pr-12 py-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 hybrid:border-slate-800 bg-slate-50 dark:bg-slate-950 hybrid:bg-slate-950 text-slate-800 dark:text-slate-100 hybrid:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 hybrid:placeholder-slate-600 focus:outline-none focus:border-emerald-500/40 focus:bg-white dark:focus:bg-slate-900 hybrid:focus:bg-slate-900 transition-all font-semibold"
                />

                {activeInput === "pickup" && pickupSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-2 rounded-xl border border-slate-200 dark:border-slate-800 hybrid:border-slate-800 bg-white dark:bg-slate-900 hybrid:bg-slate-900 shadow-2xl overflow-hidden z-50">
                    {pickupSuggestions.map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSelectSuggestion(item, "pickup")}
                        className="w-full text-left px-4 py-2.5 border-b border-slate-100 dark:border-slate-800/50 hybrid:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800 hybrid:hover:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-300 hybrid:text-slate-300 flex items-start gap-2.5 transition-colors cursor-pointer font-semibold"
                      >
                        <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                        <span>{item.display_name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Vertical connecting line indicator */}
              <div className="absolute left-[17px] top-[40px] w-0.5 h-[34px] bg-slate-200 dark:bg-slate-800 hybrid:bg-slate-800 pointer-events-none"></div>

              {/* Drop Address Input */}
              <div className="relative">
                <span className="absolute left-3.5 top-4 flex h-2 w-2 rounded-full bg-emerald-500"></span>
                <input
                  type="text"
                  value={dropText}
                  placeholder="Where to? (Enter Drop Location...)"
                  onChange={(e) => handleDropChange(e.target.value)}
                  onFocus={() => setActiveInput("drop")}
                  className="w-full pl-9 pr-12 py-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 hybrid:border-slate-800 bg-slate-50 dark:bg-slate-950 hybrid:bg-slate-950 text-slate-800 dark:text-slate-100 hybrid:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 hybrid:placeholder-slate-600 focus:outline-none focus:border-emerald-500/40 focus:bg-white dark:focus:bg-slate-900 hybrid:focus:bg-slate-900 transition-all font-semibold"
                />

                {activeInput === "drop" && dropSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-2 rounded-xl border border-slate-200 dark:border-slate-800 hybrid:border-slate-800 bg-white dark:bg-slate-900 hybrid:bg-slate-900 shadow-2xl overflow-hidden z-50">
                    {dropSuggestions.map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSelectSuggestion(item, "drop")}
                        className="w-full text-left px-4 py-2.5 border-b border-slate-100 dark:border-slate-800/50 hybrid:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800 hybrid:hover:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-300 hybrid:text-slate-300 flex items-start gap-2.5 transition-colors cursor-pointer font-semibold"
                      >
                        <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                        <span>{item.display_name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Horizontal Segmented Category Selector directly matching prototype screenshot */}
            <div className="flex items-center justify-between gap-1.5 pb-1 mt-1 overflow-x-auto scrollbar-none">
              {["Bike", "Auto", "Mini", "Sedan", "Prime"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-250 cursor-pointer text-center flex-1 min-w-[75px] hover:scale-[1.04] active:scale-[0.98] ${
                    selectedCategory === cat
                      ? "bg-[#5e5aef] text-white shadow-[0_6px_20px_rgba(94,90,239,0.35)] border border-[#7d79ff]/40"
                      : "bg-white/80 dark:bg-[#111024]/80 hybrid:bg-[#111024]/80 border border-slate-200 dark:border-[#232145]/50 hybrid:border-[#232145]/50 text-slate-500 dark:text-slate-400 hybrid:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hybrid:hover:text-slate-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Large Blue-to-Emerald Gradient comparing submit button */}
            <button
              onClick={handleCompareFares}
              disabled={!pickupText || !dropText || isLoadingFares}
              className="w-full py-4.5 rounded-2xl font-black text-sm tracking-wider text-white shadow-xl shadow-emerald-500/10 flex items-center justify-center gap-2 cursor-pointer transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none text-center bg-gradient-to-r from-indigo-500 via-emerald-500 to-teal-400 hover:shadow-emerald-500/20 active:scale-[0.99]"
            >
              {isLoadingFares ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  AGGRREGATING RIDE STREAMS...
                </>
              ) : (
                "Compare Fares →"
              )}
            </button>
          </div>

          {/* Quick Destination Shortcut Shortcuts Grid */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => selectQuickDestination("home")}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-900 hybrid:border-slate-200 bg-white dark:bg-slate-900/20 hybrid:bg-white flex items-center gap-3 hover:border-indigo-500/30 transition-all group cursor-pointer animate-scaleUp"
            >
              <div className="h-9 w-9 rounded-lg bg-indigo-500/10 flex items-center justify-center text-lg shadow-sm border border-indigo-500/10">
                🏠
              </div>
              <div className="text-left">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 hybrid:text-slate-800 group-hover:text-indigo-400 transition-colors">
                  Home
                </h4>
                <span className="text-[9px] text-slate-400 dark:text-slate-500 hybrid:text-slate-500 font-bold block mt-0.5">
                  Indiranagar metro
                </span>
              </div>
            </button>

            <button
              onClick={() => selectQuickDestination("office")}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-900 hybrid:border-slate-200 bg-white dark:bg-slate-900/20 hybrid:bg-white flex items-center gap-3 hover:border-indigo-500/30 transition-all group cursor-pointer animate-scaleUp"
            >
              <div className="h-9 w-9 rounded-lg bg-indigo-500/10 flex items-center justify-center text-lg shadow-sm border border-indigo-500/10">
                💼
              </div>
              <div className="text-left">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 hybrid:text-slate-800 group-hover:text-indigo-400 transition-colors">
                  Office
                </h4>
                <span className="text-[9px] text-slate-400 dark:text-slate-500 hybrid:text-slate-500 font-bold block mt-0.5">
                  EcoSpace ORR
                </span>
              </div>
            </button>

            <button
              onClick={() => selectQuickDestination("airport")}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-900 hybrid:border-slate-200 bg-white dark:bg-slate-900/20 hybrid:bg-white flex items-center gap-3 hover:border-indigo-500/30 transition-all group cursor-pointer animate-scaleUp"
            >
              <div className="h-9 w-9 rounded-lg bg-indigo-500/10 flex items-center justify-center text-lg shadow-sm border border-indigo-500/10">
                ✈️
              </div>
              <div className="text-left">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 hybrid:text-slate-800 group-hover:text-indigo-400 transition-colors">
                  Airport
                </h4>
                <span className="text-[9px] text-slate-400 dark:text-slate-500 hybrid:text-slate-500 font-bold block mt-0.5">
                  Kempegowda airport
                </span>
              </div>
            </button>

            <button
              onClick={() => selectQuickDestination("station")}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-900 hybrid:border-slate-200 bg-white dark:bg-slate-900/20 hybrid:bg-white flex items-center gap-3 hover:border-indigo-500/30 transition-all group cursor-pointer animate-scaleUp"
            >
              <div className="h-9 w-9 rounded-lg bg-indigo-500/10 flex items-center justify-center text-lg shadow-sm border border-indigo-500/10">
                🚉
              </div>
              <div className="text-left">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 hybrid:text-slate-800 group-hover:text-indigo-400 transition-colors">
                  Station
                </h4>
                <span className="text-[9px] text-slate-400 dark:text-slate-500 hybrid:text-slate-500 font-bold block mt-0.5">
                  Koramangala 5th
                </span>
              </div>
            </button>
          </div>

          {/* Aggregated fare card lists shown below the inputs when fares load! */}
          {activeFares.length > 0 && (
            <div className="flex flex-col gap-4 mt-2">
              <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 hybrid:border-slate-200 pb-2">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 hybrid:text-slate-500 tracking-wider uppercase">
                  SIDE-BY-SIDE MATCHES
                </span>
                <span className="text-[10px] font-bold text-emerald-500/90 flex items-center gap-1">
                  <Sparkles className="h-3 w-3 animate-pulse" />
                  Save up to {savingsPercent}%
                </span>
              </div>

              <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-1">
                {activeFares.map((fare) => {
                  const isCheapest = cheapestFare && fare.id === cheapestFare.id;
                  
                  return (
                    <div
                      key={fare.id}
                      className={`p-3.5 rounded-xl border flex items-center justify-between transition-all duration-200 ${
                        isCheapest
                          ? "bg-slate-50 dark:bg-slate-900/80 hybrid:bg-slate-50 border-emerald-500/30 shadow-lg shadow-emerald-500/2"
                          : "bg-white dark:bg-slate-900/20 hybrid:bg-white border-slate-200 dark:border-slate-800/80 hybrid:border-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Circular Logo provider indicator matches exact prototype aesthetics */}
                        <div
                          className={`h-9 w-9 rounded-xl border flex items-center justify-center font-extrabold text-[10px] tracking-tighter ${
                            fare.provider === "Uber"
                              ? "bg-slate-950 text-slate-100 border-slate-800"
                              : fare.provider === "Ola"
                              ? "bg-lime-400 text-slate-950 border-lime-500/20"
                              : fare.provider.includes("ONDC")
                              ? "bg-amber-500 text-slate-950 border-amber-500/30"
                              : "bg-yellow-400 text-slate-950 border-yellow-500/20"
                          }`}
                        >
                          {fare.provider.charAt(0)}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                            {fare.name}
                            {isCheapest && (
                              <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 animate-pulse">
                                Best
                              </span>
                            )}
                          </h4>
                          <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold block mt-0.5">
                            {fare.provider} • {fare.durationMinutes}m ({fare.etaMinutes}m ETA)
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3.5">
                        <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100 font-sora">
                          ₹{fare.price}
                        </span>
                        <button
                          onClick={() => handleBookRide(fare)}
                          className={`px-3 py-1.5 rounded-lg text-[9px] font-extrabold tracking-wider uppercase transition-all duration-200 cursor-pointer ${
                            isCheapest
                              ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/10"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                          }`}
                        >
                          Book
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* "AGGREGATING LIVE FROM" rounded colorful provider indicators matching original prototype */}
          <div className="mt-auto pt-6 flex flex-col items-center gap-3 border-t border-slate-200/50 dark:border-slate-900/60 pb-3">
            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 tracking-widest uppercase">
              AGGREGATING LIVE FROM
            </span>
            <div className="flex items-center gap-4">
              <div
                className="h-9 w-9 rounded-xl bg-black border border-slate-200 dark:border-white/10 flex items-center justify-center font-black text-white text-xs shadow-[0_4px_12px_rgba(0,0,0,0.5)] dark:shadow-[0_0_15px_rgba(255,255,255,0.15)] hover:scale-110 active:scale-95 duration-200 transition-all cursor-default"
                title="Uber Stream Active"
              >
                U
              </div>
              <div
                className="h-9 w-9 rounded-xl bg-emerald-500 border border-emerald-400/30 dark:border-emerald-400/20 flex items-center justify-center font-black text-slate-950 text-xs shadow-[0_4px_12px_rgba(16,185,129,0.3)] dark:shadow-[0_0_15px_rgba(16,185,129,0.25)] hover:scale-110 active:scale-95 duration-200 transition-all cursor-default"
                title="Ola Calibrations Active"
              >
                O
              </div>
              <div
                className="h-9 w-9 rounded-xl bg-amber-400 border border-amber-400/30 dark:border-amber-400/20 flex items-center justify-center font-black text-slate-950 text-xs shadow-[0_4px_12px_rgba(245,158,11,0.3)] dark:shadow-[0_0_15px_rgba(245,158,11,0.25)] hover:scale-110 active:scale-95 duration-200 transition-all cursor-default"
                title="Rapido Calibrations Active"
              >
                R
              </div>
              <div
                className="h-9 w-9 rounded-xl bg-[#5e5aef] border border-indigo-400/30 dark:border-indigo-400/20 flex items-center justify-center font-black text-white text-xs shadow-[0_4px_12px_rgba(94,90,239,0.3)] dark:shadow-[0_0_15px_rgba(94,90,239,0.25)] hover:scale-110 active:scale-95 duration-200 transition-all cursor-default"
                title="Beckn ONDC gateways Connected"
              >
                N
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: STUNNING DARK/LIGHT HIGH-FIDELITY MAP CANVAS */}
        <div className="flex-1 h-full rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden relative shadow-2xl min-h-[350px]">
          <LeafletMap
            pickupLat={pickupCoords?.lat}
            pickupLng={pickupCoords?.lng}
            dropLat={dropCoords?.lat}
            dropLng={dropCoords?.lng}
          />

          {/* Floating street-routing analysis overlay widget */}
          {metadata && (
            <div className="absolute top-4 left-4 z-10 bg-white/95 dark:bg-slate-950/95 hybrid:bg-slate-950/95 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800/85 hybrid:border-slate-800/85 shadow-2xl max-w-[280px] pointer-events-none flex flex-col gap-1">
              <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 hybrid:text-emerald-400 tracking-wider uppercase font-sora">
                ROUTE ANALYSIS
              </span>
              <h3 className="text-base font-black text-slate-900 dark:text-slate-100 hybrid:text-slate-100 font-sora">
                {metadata.distanceKm} km • {metadata.durationMinutes} mins
              </h3>
              <p className="text-[9px] text-slate-500 dark:text-slate-400 hybrid:text-slate-400 font-bold mt-0.5">
                Commute Surge: {metadata.surgeMultiplier}x •{" "}
                {metadata.isGoogleRoute ? "Google Matrix Engine" : "OSRM Free Driver"}
              </p>
            </div>
          )}
        </div>

      </main>

      {/* Booking simulation dispatch modal */}
      {showBookingModal && bookedFare && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm glass-panel p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col items-center text-center gap-4 animate-scaleUp">
            <div className="h-16 w-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 animate-bounce">
              <Smartphone className="h-8 w-8" />
            </div>

            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                Connecting to {bookedFare.provider}
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 leading-relaxed px-4">
                Forwarding coordinates to the native dispatch app. Please standby...
              </p>
            </div>

            <div className="w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-left flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Vehicle chosen:</span>
                <span className="font-bold text-slate-800 dark:text-slate-100">{bookedFare.name}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Fare Selected:</span>
                <span className="font-bold text-slate-800 dark:text-slate-100">₹{bookedFare.price}</span>
              </div>
              {cheapestFare && bookedFare.id === cheapestFare.id && savings > 0 && (
                <div className="flex items-center justify-between text-xs text-emerald-500/90 border-t border-slate-200 dark:border-slate-800/80 pt-2 mt-1 font-bold">
                  <span>Dynamic Savings:</span>
                  <span className="font-extrabold font-sora">₹{savings} ({savingsPercent}%)</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 text-emerald-500 animate-spin" />
              <span className="text-[10px] font-bold text-emerald-500 tracking-widest uppercase animate-pulse">
                LAUNCHING MOBILE SCHEMES...
              </span>
            </div>

            <button
              onClick={() => setShowBookingModal(false)}
              className="mt-1 text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors uppercase tracking-wider cursor-pointer"
            >
              Dismiss Dispatch
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
