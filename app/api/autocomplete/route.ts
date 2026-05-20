import { NextResponse } from "next/server";

const NKP_MOCKS = [
  {
    display_name: "Nirlon Knowledge Park, B4 Building, Western Express Hwy, Goregaon East, Mumbai, Maharashtra 400063",
    place_id: "nkp-b4",
    is_google: false,
    lat: "19.1663",
    lng: "72.8541"
  },
  {
    display_name: "Nirlon Knowledge Park, B5 Building, Western Express Hwy, Goregaon East, Mumbai, Maharashtra 400063",
    place_id: "nkp-b5",
    is_google: false,
    lat: "19.1664",
    lng: "72.8542"
  },
  {
    display_name: "Nirlon Knowledge Park, B6 Building, Western Express Hwy, Goregaon East, Mumbai, Maharashtra 400063",
    place_id: "nkp-b6",
    is_google: false,
    lat: "19.1665",
    lng: "72.8543"
  },
  {
    display_name: "Nirlon Knowledge Park, B7 Building (Nirlon IT Park), Goregaon East, Mumbai, Maharashtra 400063",
    place_id: "nkp-b7",
    is_google: false,
    lat: "19.1666",
    lng: "72.8544"
  },
  {
    display_name: "Nirlon Knowledge Park, Hubtown Sunstone, Goregaon East, Mumbai, Maharashtra 400063",
    place_id: "nkp-hubtown",
    is_google: false,
    lat: "19.1660",
    lng: "72.8539"
  },
  {
    display_name: "Nirlon Knowledge Park, Main Gate 1, Western Express Hwy, Goregaon East, Mumbai, Maharashtra 400063",
    place_id: "nkp-gate1",
    is_google: false,
    lat: "19.1658",
    lng: "72.8538"
  }
];

const BANGALORE_MOCKS = [
  {
    display_name: "Indiranagar Metro Station, 100 Feet Rd, Indiranagar, Bangalore, Karnataka 560038",
    place_id: "blr-indiranagar-metro",
    is_google: false,
    lat: "12.9784",
    lng: "77.6408"
  },
  {
    display_name: "EcoSpace Business Park, Bellandur Outer Ring Road, Bangalore, Karnataka 560103",
    place_id: "blr-ecospace",
    is_google: false,
    lat: "12.9279",
    lng: "77.6833"
  },
  {
    display_name: "Kempegowda International Airport (BLR), Terminal 1 Departures, Bangalore, Karnataka 560300",
    place_id: "blr-airport-t1",
    is_google: false,
    lat: "13.1986",
    lng: "77.7066"
  },
  {
    display_name: "Kempegowda International Airport (BLR), Terminal 2 Arrivals, Bangalore, Karnataka 560300",
    place_id: "blr-airport-t2",
    is_google: false,
    lat: "13.2011",
    lng: "77.7080"
  },
  {
    display_name: "Koramangala 5th Block, 80 Feet Road, Koramangala, Bangalore, Karnataka 560095",
    place_id: "blr-koramangala-5",
    is_google: false,
    lat: "12.9352",
    lng: "77.6133"
  },
  {
    display_name: "KSR Bangalore City Railway Station, Majestic, Bangalore, Karnataka 560023",
    place_id: "blr-ksr-station",
    is_google: false,
    lat: "12.9779",
    lng: "77.5696"
  }
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    const action = searchParams.get("action") || "search";
    const placeId = searchParams.get("place_id") || "";

    const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

    // --- ACTION 1: RESOLVE DETAILS FOR GOOGLE PLACE ID OR LOCAL MOCK ID ---
    if (action === "details") {
      if (!placeId) {
        return NextResponse.json({ error: "Missing place_id" }, { status: 400 });
      }

      // Handle local high-fidelity mock IDs
      if (placeId.startsWith("nkp-") || placeId.startsWith("blr-")) {
        const allMocks = [...NKP_MOCKS, ...BANGALORE_MOCKS];
        const matched = allMocks.find(m => m.place_id === placeId);
        if (matched) {
          return NextResponse.json({
            display_name: matched.display_name,
            lat: parseFloat(matched.lat),
            lng: parseFloat(matched.lng),
          });
        }
      }

      if (!googleMapsApiKey) {
        return NextResponse.json(
          { error: "Google Maps API Key not configured for details resolution" },
          { status: 400 }
        );
      }

      try {
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry,formatted_address&key=${googleMapsApiKey}`;
        const response = await fetch(detailsUrl);
        const data = await response.json();

        if (data.status === "OK" && data.result?.geometry?.location) {
          const loc = data.result.geometry.location;
          return NextResponse.json({
            display_name: data.result.formatted_address || "Resolved Address",
            lat: loc.lat,
            lng: loc.lng,
          });
        } else {
          throw new Error(data.error_message || data.status || "Google Details failed");
        }
      } catch (err: any) {
        console.error("Google Place Details proxy error:", err);
        return NextResponse.json(
          { error: "Failed to resolve Google place details", details: err.message },
          { status: 500 }
        );
      }
    }

    // --- ACTION 2: SEARCH AUTOCOMPLETE SUGGESTIONS ---
    if (!q.trim()) {
      return NextResponse.json([]);
    }

    // Determine if any local high-fidelity mock items match the query
    let interceptedMocks: any[] = [];
    const queryLower = q.toLowerCase();

    if (
      queryLower.includes("nirlon") ||
      queryLower.includes("knowledge") ||
      queryLower.includes("nkp") ||
      queryLower.includes("goregaon") ||
      queryLower.includes("b4") ||
      queryLower.includes("b5") ||
      queryLower.includes("b6") ||
      queryLower.includes("b7")
    ) {
      interceptedMocks = [...NKP_MOCKS];
    } else if (
      queryLower.includes("indiranagar") ||
      queryLower.includes("ecospace") ||
      queryLower.includes("airport") ||
      queryLower.includes("kempegowda") ||
      queryLower.includes("blr") ||
      queryLower.includes("koramangala") ||
      queryLower.includes("majestic") ||
      queryLower.includes("ksr")
    ) {
      interceptedMocks = BANGALORE_MOCKS.filter(m =>
        m.display_name.toLowerCase().includes(queryLower)
      );
      if (interceptedMocks.length === 0) {
        interceptedMocks = [...BANGALORE_MOCKS];
      }
    }

    let externalResults: any[] = [];

    // 1. Google Places Autocomplete Proxy
    if (googleMapsApiKey) {
      try {
        const autocompleteUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
          q
        )}&components=country:in&key=${googleMapsApiKey}`;
        const response = await fetch(autocompleteUrl);
        const data = await response.json();

        if (data.status === "OK" && data.predictions) {
          externalResults = data.predictions.map((p: any) => ({
            display_name: p.description,
            place_id: p.place_id,
            is_google: true,
            lat: "",
            lng: "",
          }));
        } else if (data.status !== "ZERO_RESULTS") {
          throw new Error(data.error_message || data.status || "Google Autocomplete failed");
        }
      } catch (err: any) {
        console.warn("Google Autocomplete proxy failed. Falling back to Nominatim.", err);
      }
    }

    // 2. OpenStreetMap Nominatim Search (Fallback or Default Engine)
    if (externalResults.length === 0) {
      try {
        const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          q
        )}&limit=6&countrycodes=in&addressdetails=1`;
        const response = await fetch(nominatimUrl, {
          headers: { "User-Agent": "OmniFareAutocompleteProxy" },
        });
        const data = await response.json();

        if (Array.isArray(data)) {
          externalResults = data.map((item: any) => ({
            display_name: item.display_name,
            place_id: "",
            is_google: false,
            lat: item.lat,
            lng: item.lon,
          }));
        }
      } catch (err: any) {
        console.error("OSM Nominatim proxy error:", err);
      }
    }

    // Combine results, prepending intercepted high-fidelity mocks & removing duplicates by display_name
    const combined = [...interceptedMocks];
    const seenNames = new Set(combined.map(item => item.display_name.toLowerCase()));

    for (const ext of externalResults) {
      if (!seenNames.has(ext.display_name.toLowerCase())) {
        combined.push(ext);
        seenNames.add(ext.display_name.toLowerCase());
      }
    }

    return NextResponse.json(combined.slice(0, 8));
  } catch (error: any) {
    console.error("General autocomplete handler error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
