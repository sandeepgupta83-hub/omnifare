"use client"; // Required for useState and async functions

import { useState } from "react";

// Define the shape of your suggestion data
interface AutocompleteResult {
  display_name?: string;
  is_google?: boolean;
  place_id?: string;
  lat: string;
  lng: string;
}

export default function ComparePage() {
  // 1. Declare your states (you likely have these defined elsewhere)
  const [isSearching, setIsSearching] = useState(false);
  const [pickupText, setPickupText] = useState("");
  const [dropText, setDropText] = useState("");
  // Add other states (setPickupCoords, setPickupSuggestions, etc.) here

  // 2. Your function
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
        // Ensure you have these setter functions defined
      } else {
        setDropText(shortName);
      }
    } catch (err) {
      console.error("Failed to select address suggestion", err);
    } finally {
      setIsSearching(false);
    }
  };

  // 3. Mandatory return (JSX)
  return (
    <main>
      <h1>Compare Fares</h1>
      {/* Your existing UI logic goes here */}
    </main>
  );
}
