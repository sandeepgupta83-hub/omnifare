"use client";

import { useState, useEffect } from "react";

// 1. Define the required data types
interface AutocompleteResult {
  display_name?: string;
  is_google?: boolean;
  place_id?: string;
  lat: string;
  lng: string;
}

export default function ComparePage() {
  // --- STATES ---
  const [isSearching, setIsSearching] = useState(false);

  // Input text states
  const [pickupText, setPickupText] = useState("");
  const [dropText, setDropText] = useState("");

  // Debounced text states (prevents map from crashing)
  const [debouncedPickup, setDebouncedPickup] = useState("");
  const [debouncedDrop, setDebouncedDrop] = useState("");

  // Suggestions lists
  const [pickupSuggestions, setPickupSuggestions] = useState<AutocompleteResult[]>([]);
  const [dropSuggestions, setDropSuggestions] = useState<AutocompleteResult[]>([]);

  // Final selected coordinates
  const [pickupCoords, setPickupCoords] = useState({ lat: 0, lng: 0 });
  const [dropCoords, setDropCoords] = useState({ lat: 0, lng: 0 });

  const [activeInput, setActiveInput] = useState<"pickup" | "drop" | null>(null);

  // --- DEBOUNCE TIMERS (Fixes the crashing issue) ---
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedPickup(pickupText), 500);
    return () => clearTimeout(timer);
  }, [pickupText]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedDrop(dropText), 500);
    return () => clearTimeout(timer);
  }, [dropText]);

  // --- FETCH SUGGESTIONS (Safe from crashes) ---
  useEffect(() => {
    if (!debouncedPickup) {
      setPickupSuggestions([]);
      return;
    }
    const fetchPickup = async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${debouncedPickup}`);
        if (!res.ok) throw new Error("Map API rate limit");
        const data = await res.json();
        setPickupSuggestions(data);
      } catch (error) {
        console.error("Safely caught map error:", error);
        setPickupSuggestions([]);
      }
    };
    fetchPickup();
  }, [debouncedPickup]);

  useEffect(() => {
    if (!debouncedDrop) {
      setDropSuggestions([]);
      return;
    }
    const fetchDrop = async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${debouncedDrop}`);
        if (!res.ok) throw new Error("Map API rate limit");
        const data = await res.json();
        setDropSuggestions(data);
      } catch (error) {
        console.error("Safely caught map error:", error);
        setDropSuggestions([]);
      }
    };
    fetchDrop();
  }, [debouncedDrop]);

  // --- HANDLE SELECTION ---
  const handleSelectSuggestion = async (item: AutocompleteResult, type: "pickup" | "drop") => {
    setIsSearching(true);
    try {
      let coords = { lat: 0, lng: 0 };
      const rawDisplayName = item.display_name || "Unknown Location";
      let shortName = typeof rawDisplayName === 'string'
        ? rawDisplayName.split(",").slice(0, 3).join(",")
        : "Selected Location";

      if (item.is_google) {
        const url = `/api/autocomplete?action=details&place_id=${item.place_id}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.lat && data.lng) {
          coords = { lat: parseFloat(data.lat), lng: parseFloat(data.lng) };
          const googleName = data.display_name || "";
          shortName = typeof googleName === 'string'
            ? googleName.split(",").slice(0, 3).join(",")
            : "Selected Location";
        } else {
          throw new Error("Invalid coordinates from proxy");
        }
      } else {
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

  // --- RENDER UI ---
  return (
    <main style={{ maxWidth: '600px', margin: '40px auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Compare Fares</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        
        {/* Pickup Input */}
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="Pickup Location..."
            value={pickupText}
            onChange={(e) => setPickupText(e.target.value)}
            onFocus={() => setActiveInput("pickup")}
            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ccc' }}
          />
          {activeInput === "pickup" && pickupSuggestions.length > 0 && (
            <ul style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #ccc', zIndex: 10, listStyle: 'none', padding: 0, margin: 0, maxHeight: '200px', overflowY: 'auto' }}>
              {pickupSuggestions.map((s, i) => (
                <li key={i} onClick={() => handleSelectSuggestion(s, "pickup")} style={{ padding: '10px', borderBottom: '1px solid #eee', cursor: 'pointer' }}>
                  {s.display_name}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Drop Input */}
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="Where to? (Enter Drop Location...)"
            value={dropText}
            onChange={(e) => setDropText(e.target.value)}
            onFocus={() => setActiveInput("drop")}
            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ccc' }}
          />
          {activeInput === "drop" && dropSuggestions.length > 0 && (
            <ul style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #ccc', zIndex: 10, listStyle: 'none', padding: 0, margin: 0, maxHeight: '200px', overflowY: 'auto' }}>
              {dropSuggestions.map((s, i) => (
                <li key={i} onClick={() => handleSelectSuggestion(s, "drop")} style={{ padding: '10px', borderBottom: '1px solid #eee', cursor: 'pointer' }}>
                  {s.display_name}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Compare Button */}
        <button 
          disabled={isSearching}
          style={{ padding: '15px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {isSearching ? "Searching..." : "Compare Fares →"}
        </button>

      </div>
    </main>
  );
}
