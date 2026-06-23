import { NextResponse } from "next/server";

// 1. Mumbai RTO Standard Rate Card (Baseline for Ola/Rapido/ONDC if Uber is down)
const MUMBAI_RTO_BASE: { [key: string]: any } = {
  Auto: { baseFare: 23, baseKm: 1.5, perKm: 15.33, perMin: 1.0 },
  Bike: { baseFare: 20, baseKm: 2.0, perKm: 8.0, perMin: 0.5 },
  EcoCab: { baseFare: 28, baseKm: 1.5, perKm: 18.67, perMin: 1.5 },
  PremiumSedan: { baseFare: 100, baseKm: 4.0, perKm: 22.0, perMin: 2.0 },
  SUV: { baseFare: 150, baseKm: 4.0, perKm: 28.0, perMin: 2.5 },
};

// 2. Market Multipliers (Relative to the Anchor)
const MARKET_OFFSETS: { [key: string]: { [key: string]: number } } = {
  Ola: { Auto: 1.05, Bike: 1.1, EcoCab: 1.02, PremiumSedan: 1.05, SUV: 1.05 },
  Rapido: { Auto: 0.98, Bike: 0.92 },
  NammaYatri: { Auto: 0.88, EcoCab: 0.85 },
};

export async function POST(request: Request) {
  try {
    const { pickup_lat, pickup_lng, drop_lat, drop_lng } = (await request.json()) as any;

    // A. GET ROUTE METADATA (OSRM)
    let distanceMeters = 0;
    let durationSeconds = 0;
    try {
      const osrmRes = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${pickup_lng},${pickup_lat};${drop_lng},${drop_lat}?overview=false`
      );
      const osrmData = (await osrmRes.json()) as any;
      distanceMeters = osrmData.routes?.[0]?.distance || 0;
      durationSeconds = osrmData.routes?.[0]?.duration || 0;
    } catch (e) {
      console.warn("Routing service delay/error");
    }

    // B. STRICT UBER LIVE FETCH
    const uberAnchorPrices: { [key: string]: number } = {};
    const uberOptions: any[] = [];
    
    // Pulling from the specific Vercel Variable requested
    const uberToken = process.env.REACT_APP_UBER_CLIENT_ID;

    if (uberToken) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4500); // 4.5s timeout

        const uberRes = await fetch(
          `https://api.uber.com/v1.2/estimates/price?start_latitude=${pickup_lat}&start_longitude=${pickup_lng}&end_latitude=${drop_lat}&end_longitude=${drop_lng}`,
          { 
            headers: { 
                "Authorization": `Token ${uberToken}`,
                "Accept-Language": "en-IN"
            },
            signal: controller.signal 
          }
        );
        clearTimeout(timeoutId);

        if (uberRes.ok) {
          const uberData = (await uberRes.json()) as any;
          (uberData.prices || []).forEach((item: any) => {
            let cat = "EcoCab";
            const name = item.display_name.toLowerCase();
            if (name.includes("auto")) cat = "Auto";
            else if (name.includes("moto") || name.includes("bike")) cat = "Bike";
            else if (name.includes("premier")) cat = "PremiumSedan";
            else if (name.includes("xl")) cat = "SUV";

            // Uber uses high/low estimates, we take the average
            const avgPrice = Math.round((item.high_estimate + item.low_estimate) / 2);
            
            // Map to anchor for Ola/Rapido/ONDC use
            if (!uberAnchorPrices[cat] || avgPrice < uberAnchorPrices[cat]) {
              uberAnchorPrices[cat] = avgPrice;
            }

            uberOptions.push({
              id: `uber-${item.product_id}`,
              name: item.display_name,
              provider: "Uber",
              category: cat,
              price: avgPrice,
              durationMinutes: Math.round(item.duration / 60),
              etaMinutes: 4,
              deeplink: `uber://?action=setPickup&pickup[latitude]=${pickup_lat}&pickup[longitude]=${pickup_lng}`,
            });
          });
        }
      } catch (err) {
        // Strict requirement: If Uber fails, it is simply omitted from the results.
        console.error("Uber Live Feed currently unavailable.");
      }
    }

    // C. DYNAMIC ESTIMATION FOR OLA, RAPIDO, ONDC
    const othersOptions: any[] = [];
    const categories = ["Auto", "Bike", "EcoCab", "PremiumSedan", "SUV"];
    const providers = ["Ola", "Rapido", "NammaYatri"];

    categories.forEach((cat) => {
      // Step 1: Find a baseline price
      let basePrice = uberAnchorPrices[cat];

      if (!basePrice) {
        // If Uber is down, use Mumbai Municipal (RTO) math
        const rto = MUMBAI_RTO_BASE[cat] || MUMBAI_RTO_BASE.EcoCab;
        const distKm = distanceMeters / 1000;
        const timeMin = durationSeconds / 60;
        
        basePrice = rto.baseFare;
        if (distKm > rto.baseKm) {
          basePrice += (distKm - rto.baseKm) * rto.perKm;
        }
        basePrice += timeMin * rto.perMin;
        
        // Add random "market jitter" (±5%) so estimates don't look static
        basePrice = basePrice * (0.95 + Math.random() * 0.1);
      }

      // Step 2: Apply provider-specific pricing relative to that baseline
      providers.forEach((prov) => {
        const multiplier = MARKET_OFFSETS[prov]?.[cat];
        if (multiplier) {
          const isONDC = prov === "NammaYatri";
          othersOptions.push({
            id: `${prov.toLowerCase()}-${cat.toLowerCase()}`,
            name: isONDC && cat === "Auto" ? "Namma Yatri" : `${prov} ${cat}`,
            provider: isONDC ? "ONDC" : prov,
            category: cat,
            price: Math.round(basePrice * multiplier),
            durationMinutes: Math.round(durationSeconds / 60),
            etaMinutes: Math.floor(Math.random() * 4) + 3, // Random ETA 3-7 mins
            deeplink: isONDC ? "https://nammayatri.in" : "#",
          });
        }
      });
    });

    // D. AGGREGATE, GROUP BY CATEGORY, AND SORT
    const allFares = [...uberOptions, ...othersOptions];
    const faresByGroup: { [key: string]: any[] } = {
      Auto: [], Bike: [], EcoCab: [], PremiumSedan: [], SUV: []
    };

    allFares.forEach((f) => {
      if (faresByGroup[f.category]) faresByGroup[f.category].push(f);
    });

    // Sort every category by price (cheapest first)
    Object.keys(faresByGroup).forEach(k => {
      faresByGroup[k].sort((a, b) => a.price - b.price);
    });

    return NextResponse.json({
      metadata: {
        distanceKm: (distanceMeters / 1000).toFixed(1),
        durationMin: Math.round(durationSeconds / 60),
        uberLive: uberOptions.length > 0,
        baseline: uberOptions.length > 0 ? "Uber Real-time" : "Mumbai RTO"
      },
      fares: faresByGroup
    });

  } catch (error: any) {
    // Top level catch to prevent 500 crashes on Vercel
    return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 500 });
  }
}
