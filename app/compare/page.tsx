"use client";

import { useState } from "react";

// 1. Define the type at the top
interface AutocompleteResult {
  display_name?: string;
  is_google?: boolean;
  place_id?: string;
  lat: string;
  lng: string;
}

export default function ComparePage() {
  // 2. Define the states that the function uses
  const [isSearching, setIsSearching] = useState(false);
  const [pickupText, setPickupText] = useState("");
  const [dropText, setDropText] = useState("");
  const [pickupCoords, setPickupCoords] = useState({ lat: 0, lng: 0 });
  const [dropCoords, setDropCoords] = useState({ lat: 0, lng: 0 });
  const [pickupSuggestions, setPickupSuggestions] = useState<AutocompleteResult[]>([]);
  const [dropSuggestions, setDropSuggestions] = useState<AutocompleteResult[]>([]);
  const [activeInput, setActiveInput] = useState<"pickup" | "drop" | null>(null);

  // 3. Your logic inside the component
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

  // 4. Return the UI
  return (
    <div style={{ padding: '20px' }}>
      <h1>Compare Fares</h1>
      <p>Select your location to get started.</p>
    </div>
  );
}
