const handleSelectSuggestion = async (item: AutocompleteResult, type: "pickup" | "drop") => {
    setIsSearching(true);
    try {
      let coords = { lat: 0, lng: 0 };
      
      // SAFETY CHECK: Ensure display_name exists
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
          // Apply same safety check to google response
          const googleName = data.display_name || "";
          shortName = typeof googleName === 'string' 
            ? googleName.split(",").slice(0, 3).join(",") 
            : "Selected Location";
        } else {
          throw new Error("Invalid coordinates from proxy");
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
