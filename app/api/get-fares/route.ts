import { NextResponse } from "next/server";

// Using a broad interface to avoid strict indexing errors during build
interface FareOption {
  id: string;
  name: string;
  provider: string;
  category: string;
  price: number;
  durationMinutes: number;
  etaMinutes: number;
  deeplink: string;
  discountApplied?: string | null;
}

// Market multipliers for smart estimation
// Typed with index signature to allow dynamic string lookup
const MARKET_OFFSETS: { [key: string]: { [key: string]: number } } = {
  Ola: { Auto: 1.02, Bike: 1.05, EcoCab: 0.98, PremiumSedan: 1.05, SUV: 1.03 },
  Rapido: { Auto: 0.95, Bike: 0.88 },
  NammaYatri: { Auto: 0.85, EcoCab: 0.82 },
};

// Fallback pricing configuration
const TARIFFS: { [key: string]: any } = {
  Auto: { base: 30, km: 15, min: 1 },
  Bike: { base: 20, km: 8, min: 0.5 },
  EcoCab: { base: 60, km: 18, min: 1.5 },
  PremiumSedan: { base: 100, km: 22, min: 2 },
  SUV: { base: 150, km: 28, min: 2.5 },
};

export async function POST(request: Request) {
  try {
    const body: any = await request.json();
    const { pickup_lat, pickup_lng, drop_lat, drop_lng } = body;

    // 1. Get Distance Metadata (OSRM)
    let distanceMeters = 5000;
    let durationSeconds = 900;

    try {
      const osrmRes = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${pickup_lng},${pickup_lat};${drop_lng},${drop_lat}?overview=false`
      );
      const osrmData: any = await osrmRes.json();
      if (osrmData.routes?.[0]) {
        distanceMeters = osrmData.routes[0].distance;
        durationSeconds = osrmData.routes[0].duration;
      }
    } catch (e) {
      console.warn("OSRM Route fallback used");
    }

    // 2. Uber Live Fetch (The Anchor)
    const anchorPrices: { [key: string]: number } = {};
    const finalOptions: FareOption[] = [];
    const uberToken = process.env.UBER_SERVER_TOKEN;

    if (uberToken) {
      try {
        const uberUrl = `https://api.uber.com/v1.2/estimates/price?start_latitude=${pickup_lat}&start_longitude=${pickup_lng}&end_latitude=${drop_lat}&end_longitude=${drop_lng}`;
        const uberRes = await fetch(uberUrl, {
          headers: { Authorization: `Token ${uberToken}` },
        });
        const uberData: any = await uberRes.json();

        if (uberData.prices) {
          uberData.prices.forEach((item: any) => {
            let cat = "EcoCab";
            const name = item.display_name.toLowerCase();
            if (name.includes("auto")) cat = "Auto";
            else if (name.includes("moto") || name.includes("bike")) cat = "Bike";
            else if (name.includes("premier")) cat = "PremiumSedan";
            else if (name.includes("xl") || name.includes("suv")) cat = "SUV";

            const price = Math.round((item.high_estimate + item.low_estimate) / 2);
            anchorPrices[cat] = price;

            finalOptions.push({
              id: `uber-${item.product_id || Math.random()}`,
              name: item.display_name,
              provider: "Uber",
              category: cat,
              price: price,
              durationMinutes: Math.round(item.duration / 60) || Math.round(durationSeconds / 60),
              etaMinutes: 4,
              deeplink: `uber://?action=setPickup&pickup[latitude]=${pickup_lat}&pickup[longitude]=${pickup_lng}&dropoff[latitude]=${drop_lat}&dropoff[longitude]=${drop_lng}`,
            });
          });
        }
      } catch (err) {
        console.error("Uber API production error:", err);
      }
    }

    // 3. Smart Estimation for non-API providers
    const categories = ["Auto", "Bike", "EcoCab", "PremiumSedan", "SUV"];
    const providers = ["Ola", "Rapido", "NammaYatri"];

    categories.forEach((cat) => {
      // Establish the base price for this category
      let basePrice = anchorPrices[cat];

      if (!basePrice) {
        const t = TARIFFS[cat] || TARIFFS.EcoCab;
        basePrice = t.base + (distanceMeters / 1000) * t.km + (durationSeconds / 60) * t.min;
        // Apply random organic flux (1.0 to 1.2)
        basePrice = basePrice * (1 + Math.random() * 0.2);
      }

      // Estimate for each provider based on their relative market position
      providers.forEach((prov) => {
        const multiplier = MARKET_OFFSETS[prov]?.[cat];
        if (multiplier) {
          const isONDC = prov === "NammaYatri";
          finalOptions.push({
            id: `${prov.toLowerCase()}-${cat.toLowerCase()}`,
            name: isONDC && cat === "Auto" ? "Namma Yatri" : `${prov} ${cat}`,
            provider: isONDC ? "ONDC" : prov,
            category: cat,
            price: Math.round(basePrice * multiplier),
            durationMinutes: Math.round(durationSeconds / 60),
            etaMinutes: Math.floor(Math.random() * 5) + 2,
            deeplink: isONDC ? "https://nammayatri.in" : "#",
            discountApplied: isONDC ? "Zero Commission Pricing" : null,
          });
        }
      });
    });

    // 4. Group and Return
    const faresByCat: { [key: string]: FareOption[] } = {
      Auto: [],
      Bike: [],
      EcoCab: [],
      PremiumSedan: [],
      SUV: [],
    };

    finalOptions.forEach((option) => {
      if (faresByCat[option.category]) {
        faresByCat[option.category].push(option);
      }
    });

    // Sort each group by price
    Object.keys(faresByCat).forEach((key) => {
      faresByCat[key].sort((a, b) => a.price - b.price);
    });

    return NextResponse.json({
      metadata: {
        distanceKm: (distanceMeters / 1000).toFixed(1),
        durationMin: Math.round(durationSeconds / 60),
        uberLive: Object.keys(anchorPrices).length > 0,
      },
      fares: faresByCat,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
