import { NextResponse } from "next/server";

// Standardize categories
type Category = "Auto" | "Bike" | "EcoCab" | "PremiumSedan" | "SUV";

interface RideOption {
  id: string;
  name: string;
  provider: string;
  category: Category;
  price: number;
  durationMinutes: number;
  etaMinutes: number;
  deeplink: string;
  discountApplied?: string | null;
}

// 1. ANCHOR RATIOS: How other brands price relative to Uber's live data
// Logic: Rapido is usually cheaper for bikes, Ola is competitive on cabs, 
// Namma Yatri (ONDC) is cheaper because of zero commission.
const MARKET_OFFSETS: Record<string, Record<string, number>> = {
  Ola: { Auto: 1.02, Bike: 1.05, EcoCab: 0.98, PremiumSedan: 1.05, SUV: 1.03 },
  Rapido: { Auto: 0.95, Bike: 0.88 }, // Rapido focused on Auto/Bike
  NammaYatri: { Auto: 0.85, EcoCab: 0.82 }, // ONDC: Approx 15-20% cheaper (no commission)
};

// 2. FALLBACK TARIFFS (Used only if Uber API fails)
const TARIFFS: Record<string, any> = {
  Auto: { baseFare: 30, perKmRate: 15, perMin: 1 },
  Bike: { baseFare: 20, perKmRate: 8, perMin: 0.5 },
  EcoCab: { baseFare: 60, perKmRate: 18, perMin: 1.5 },
  PremiumSedan: { baseFare: 100, perKmRate: 22, perMin: 2 },
  SUV: { baseFare: 150, perKmRate: 28, perMin: 2.5 },
};

export async function POST(request: Request) {
  try {
    const { pickup_lat, pickup_lng, drop_lat, drop_lng } = await request.json();

    // A. Get Routing Metadata (OSRM)
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${pickup_lng},${pickup_lat};${drop_lng},${drop_lat}?overview=false`;
    const osrmRes = await fetch(osrmUrl);
    const osrmData = await osrmRes.json();
    const distanceM = osrmData.routes?.[0]?.distance || 5000;
    const durationS = osrmData.routes?.[0]?.duration || 900;

    // B. Fetch LIVE Uber Anchor Pricing
    let anchorFares: Partial<Record<Category, number>> = {};
    let finalOptions: RideOption[] = [];
    const uberToken = process.env.UBER_SERVER_TOKEN;

    if (uberToken) {
      try {
        const uberRes = await fetch(
          `https://api.uber.com/v1.2/estimates/price?start_latitude=${pickup_lat}&start_longitude=${pickup_lng}&end_latitude=${drop_lat}&end_longitude=${drop_lng}`,
          { headers: { Authorization: `Token ${uberToken}` } }
        );
        const uberData = await uberRes.json();

        (uberData.prices || []).forEach((item: any) => {
          let cat: Category = "EcoCab";
          const name = item.display_name.toLowerCase();
          if (name.includes("auto")) cat = "Auto";
          else if (name.includes("moto") || name.includes("bike")) cat = "Bike";
          else if (name.includes("premier")) cat = "PremiumSedan";
          else if (name.includes("xl")) cat = "SUV";

          const avgPrice = Math.round((item.high_estimate + item.low_estimate) / 2);
          anchorFares[cat] = avgPrice;

          finalOptions.push({
            id: `uber-${item.product_id}`,
            name: item.display_name,
            provider: "Uber",
            category: cat,
            price: avgPrice,
            durationMinutes: Math.round(item.duration / 60),
            etaMinutes: 4,
            deeplink: `uber://?action=setPickup&pickup[latitude]=${pickup_lat}&pickup[longitude]=${pickup_lng}&dropoff[latitude]=${drop_lat}&dropoff[longitude]=${drop_lng}`,
          });
        });
      } catch (e) {
        console.warn("Uber API failed, switching to manual anchor calculation.");
      }
    }

    // C. SMART ESTIMATION: Fill in Ola, Rapido, and Namma Yatri
    const categories: Category[] = ["Auto", "Bike", "EcoCab", "PremiumSedan", "SUV"];

    categories.forEach((cat) => {
      // 1. Get the base price for this category (either Uber's live price or Fallback math)
      let basePrice = anchorFares[cat];
      
      if (!basePrice) {
        const t = TARIFFS[cat];
        basePrice = t.baseFare + ((distanceM / 1000) * t.perKmRate) + ((durationS / 60) * t.perMin);
        // Add a random "surge" between 1.0 and 1.3 to simulate real conditions
        basePrice *= (1 + Math.random() * 0.3);
      }

      // 2. Generate Ola Estimation
      if (MARKET_OFFSETS.Ola[cat]) {
        finalOptions.push({
          id: `ola-${cat.toLowerCase()}`,
          name: `Ola ${cat}`,
          provider: "Ola",
          category: cat,
          price: Math.round(basePrice * MARKET_OFFSETS.Ola[cat]),
          durationMinutes: Math.round(durationS / 60),
          etaMinutes: 5,
          deeplink: `olacabs://app/launch?lat=${pickup_lat}&lng=${pickup_lng}`,
        });
      }

      // 3. Generate Rapido Estimation (Only for Auto/Bike)
      if (MARKET_OFFSETS.Rapido[cat]) {
        finalOptions.push({
          id: `rapido-${cat.toLowerCase()}`,
          name: `Rapido ${cat}`,
          provider: "Rapido",
          category: cat,
          price: Math.round(basePrice * MARKET_OFFSETS.Rapido[cat]),
          durationMinutes: Math.round(durationS / 60 * 0.9), // Rapido bikes are "faster"
          etaMinutes: 3,
          deeplink: `rapido://booking?pickup_lat=${pickup_lat}&pickup_lng=${pickup_lng}`,
        });
      }

      // 4. Generate Namma Yatri (ONDC) Estimation
      if (MARKET_OFFSETS.NammaYatri[cat]) {
        finalOptions.push({
          id: `ondc-${cat.toLowerCase()}`,
          name: cat === "Auto" ? "Namma Yatri" : "Yatri Sathi",
          provider: "ONDC",
          category: cat,
          price: Math.round(basePrice * MARKET_OFFSETS.NammaYatri[cat]),
          durationMinutes: Math.round(durationS / 60),
          etaMinutes: 6,
          deeplink: `https://nammayatri.in/`,
          discountApplied: "Zero Commission Pricing",
        });
      }
    });

    // D. Group and Sort
    const response = {
      metadata: {
        distanceKm: (distanceM / 1000).toFixed(1),
        isLiveUber: Object.keys(anchorFares).length > 0,
      },
      fares: {
        Auto: finalOptions.filter(f => f.category === "Auto").sort((a, b) => a.price - b.price),
        Bike: finalOptions.filter(f => f.category === "Bike").sort((a, b) => a.price - b.price),
        EcoCab: finalOptions.filter(f => f.category === "EcoCab").sort((a, b) => a.price - b.price),
        PremiumSedan: finalOptions.filter(f => f.category === "PremiumSedan").sort((a, b) => a.price - b.price),
        SUV: finalOptions.filter(f => f.category === "SUV").sort((a, b) => a.price - b.price),
      }
    };

    return NextResponse.json(response);

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
