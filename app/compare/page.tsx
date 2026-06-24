"use client";

import React, { useState, useEffect } from "react";

interface AutocompleteResult {
  display_name?: string;
  is_google?: boolean;
  place_id?: string;
  lat: string;
  lng: string;
}

export default function ComparePage() {
  const [isSearching, setIsSearching] = useState(false);
  const [pickupText, setPickupText] = useState("Apple hospital road, Bhayander East, Mira-Bhayander");
  const [dropText, setDropText] = useState("");
  const [debouncedPickup, setDebouncedPickup] = useState("");
  const [debouncedDrop, setDebouncedDrop] = useState("");
  const [pickupSuggestions, setPickupSuggestions] = useState<AutocompleteResult[]>([]);
  const [dropSuggestions, setDropSuggestions] = useState<AutocompleteResult[]>([]);
  const [activeInput, setActiveInput] = useState<"pickup" | "drop" | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState("Auto");

  // Debounce inputs to prevent API rate-limit crashes
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedPickup(pickupText), 500);
    return () => clearTimeout(timer);
  }, [pickupText]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedDrop(dropText), 500);
    return () => clearTimeout(timer);
  }, [dropText]);

  // Safe fetch mechanisms
  useEffect(() => {
    if (!debouncedPickup || debouncedPickup.length < 3) {
      setPickupSuggestions([]);
      return;
    }
    const fetchPickup = async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(debouncedPickup)}`);
        if (!res.ok) throw new Error("API Limit reached");
        const data = await res.json();
        if (Array.isArray(data)) {
          setPickupSuggestions(data);
        }
      } catch (error) {
        console.error("Handled pickup fetch gracefully:", error);
      }
    };
    fetchPickup();
  }, [debouncedPickup]);

  useEffect(() => {
    if (!debouncedDrop || debouncedDrop.length < 3) {
      setDropSuggestions([]);
      return;
    }
    const fetchDrop = async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(debouncedDrop)}`);
        if (!res.ok) throw new Error("API Limit reached");
        const data = await res.json();
        if (Array.isArray(data)) {
          setDropSuggestions(data);
        }
      } catch (error) {
        console.error("Handled drop fetch gracefully:", error);
      }
    };
    fetchDrop();
  }, [debouncedDrop]);

  const handleSelectSuggestion = (item: AutocompleteResult, type: "pickup" | "drop") => {
    const rawName = item.display_name || "";
    const shortName = rawName.split(",").slice(0, 3).join(",");
    
    if (type === "pickup") {
      setPickupText(shortName);
      setPickupSuggestions([]);
    } else {
      setDropText(shortName);
      setDropSuggestions([]);
    }
    setActiveInput(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased font-sans">
      {/* Global Navigation Header */}
      <header className="flex items-center justify-between px-8 py-4 bg-white border-b border-slate-100 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-white font-black text-xl shadow-md">O</div>
          <span className="text-xl font-black tracking-tight text-slate-900">Omni<span className="text-emerald-500">Fare</span></span>
        </div>
        <nav className="flex items-center gap-8 font-semibold text-sm tracking-wide">
          <a href="#" className="text-indigo-600 border-b-2 border-indigo-600 pb-1">COMPARE FARES</a>
          <a href="#" className="text-slate-500 hover:text-slate-900 transition">DASHBOARD</a>
        </nav>
        <div className="flex items-center gap-4">
          <div className="bg-slate-100 px-3 py-1.5 rounded-full text-xs font-bold text-slate-600 border border-slate-200">
            ₹0 <span className="text-slate-400 font-medium ml-1">SAVED • 0 RIDES</span>
          </div>
          <button type="button" className="bg-emerald-50 text-emerald-600 border border-emerald-200 font-bold px-4 py-2 rounded-xl text-xs hover:bg-emerald-100 transition shadow-sm">
            SIGN IN / SIGN UP
          </button>
        </div>
      </header>

      {/* Main Interface Split Layout */}
      <main className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Control Panel */}
        <section className="lg:col-span-5 space-y-6">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Omni<span className="text-emerald-500">Fare</span></h1>
            <p className="text-slate-500 text-sm mt-1 font-medium">Compare all cabs. Pay less. Always.</p>
          </div>

          {/* Loyalty Unlock Banner */}
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 p-4 rounded-2xl flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 text-lg">🔒</div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Unlock Personalized Loyalty Rates</h4>
                <p className="text-[11px] text-slate-500 mt-0.5 max-w-[240px]">Sign In to link your Uber VIP and Ola Select tiers for live custom prices!</p>
              </div>
            </div>
            <button type="button" className="bg-indigo-600 text-white text-[11px] font-bold px-3 py-2 rounded-xl hover:bg-indigo-700 transition shadow-sm whitespace-nowrap">
              SIGN IN / SIGN UP
            </button>
          </div>

          {/* Core Interactive Routing Card */}
          <div className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-200/50 border border-slate-100 space-y-5">
            
            {/* Input Group with Chain Connectors */}
            <div className="relative space-y-3">
              {/* Pickup Field */}
              <div className="relative">
                <span className="absolute left-4 top-4 w-2.5 h-2.5 rounded-full bg-indigo-500 z-10" />
                <input
                  type="text"
                  value={pickupText}
                  onChange={(e) => setPickupText(e.target.value)}
                  onFocus={() => setActiveInput("pickup")}
                  placeholder="Enter Pickup Location..."
                  className="pl-11 pr-4 py-3.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200/80 rounded-xl text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-full"
                />
                {activeInput === "pickup" && pickupSuggestions.length > 0 && (
                  <ul className="absolute left-0 right-0 top-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto z-50 divide-y divide-slate-50">
                    {pickupSuggestions.map((s, i) => (
                      <li key={i} onClick={() => handleSelectSuggestion(s, "pickup")} className="p-3 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer font-medium transition">
                        {s.display_name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Reverse Locations Button */}
              <button type="button" className="absolute right-4 top-1/2 -translate-y-1/2 bg-white border border-slate-200 hover:border-slate-300 shadow-sm w-7 h-7 rounded-full flex items-center justify-center text-slate-500 z-20 transition active:scale-95 text-xs font-bold">
                ⇅
              </button>

              {/* Drop Field */}
              <div className="relative">
                <span className="absolute left-4 top-4 w-2.5 h-2.5 rounded-full bg-emerald-500 z-10" />
                <input
                  type="text"
                  value={dropText}
                  onChange={(e) => setDropText(e.target.value)}
                  onFocus={() => setActiveInput("drop")}
                  placeholder="Where to? (Enter Drop Location...)"
                  className="pl-11 pr-4 py-3.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200/80 rounded-xl text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-full"
                />
                {activeInput === "drop" && dropSuggestions.length > 0 && (
                  <ul className="absolute left-0 right-0 top-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto z-50 divide-y divide-slate-50">
                    {dropSuggestions.map((s, i) => (
                      <li key={i} onClick={() => handleSelectSuggestion(s, "drop")} className="p-3 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer font-medium transition">
                        {s.display_name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Horizontal Vehicle Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {["Bike", "Auto", "Mini", "Sedan", "Prime"].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setSelectedVehicle(v)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold tracking-wide transition shadow-sm border ${
                    selectedVehicle === v
                      ? "bg-indigo-600 border-indigo-600 text-white"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>

            {/* Core Action Button */}
            <button
              type="button"
              disabled={isSearching}
              className="w-full py-4 rounded-2xl font-bold text-sm text-white tracking-wide shadow-lg shadow-emerald-500/20 transition duration-200 active:scale-[0.99] bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600"
            >
              {isSearching ? "Calculating Best Fares..." : "Compare Fares →"}
            </button>
          </div>

          {/* Quick Shortcuts Matrix */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Home", sub: "Indiranagar metro", icon: "🏠" },
              { label: "Office", sub: "EcoSpace ORR", icon: "💼" },
              { label: "Airport", sub: "Kempegowda airport", icon: "✈️" },
              { label: "Station", sub: "Koramangala 5th", icon: "🚉" },
            ].map((loc, idx) => (
              <div key={idx} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition cursor-pointer flex items-center gap-3 group">
                <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-sm group-hover:bg-indigo-50 group-hover:border-indigo-100 transition">
                  {loc.icon}
                </div>
                <div>
                  <h5 className="text-xs font-bold text-slate-800">{loc.label}</h5>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5 truncate max-w-[100px]">{loc.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Right Viewport (Map Frame Component) */}
        <section className="lg:col-span-7 h-[600px] lg:h-[640px] sticky top-10">
          <div className="w-full h-full bg-slate-100 border-2 border-slate-200/60 rounded-3xl p-1 shadow-inner relative overflow-hidden flex items-center justify-center group">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
              <div className="text-center space-y-2 opacity-40 group-hover:opacity-60 transition">
                <div className="text-4xl">🗺️</div>
                <p className="text-xs font-bold tracking-wider text-slate-500 uppercase">Map Canvas Interface</p>
              </div>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
