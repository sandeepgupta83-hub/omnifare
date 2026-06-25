import { NextResponse } from "next/server";
import puppeteer from 'puppeteer-core';

// === Tariff Rules (your original estimates) ===
interface TariffConfig {
  baseFare: number;
  baseDistanceMeters: number;
  perKmRate: number;
  perMinuteRate: number;
}

const TARIFFS: Record<string, TariffConfig> = {
  Auto: { baseFare: 30.0, baseDistanceMeters: 1500, perKmRate: 15.0, perMinuteRate: 1.0 },
  EcoCab: { baseFare: 60.0, baseDistanceMeters: 3000, perKmRate: 18.0, perMinuteRate: 1.5 },
  PremiumSedan: { baseFare: 100.0, baseDistanceMeters: 4000, perKmRate: 22.0, perMinuteRate: 2.0 },
  SUV: { baseFare: 150.0, baseDistanceMeters: 4000, perKmRate: 28.0, perMinuteRate: 2.5 },
  Bike: { baseFare: 20.0, baseDistanceMeters: 2000, perKmRate: 8.0, perMinuteRate: 0.5 },
};

function calculateCalibratedFare(
  category: string,
  distanceMeters: number,
  durationSeconds: number,
  surgeMultiplier: number
): number {
  const tariff = TARIFFS[category] || TARIFFS.EcoCab;
  if (distanceMeters <= 0) return tariff.baseFare;

  let fare = tariff.baseFare;
  const remainingDistance = Math.max(0, distanceMeters - tariff.baseDistanceMeters);
  fare += (remainingDistance / 1000) * tariff.perKmRate;
  const tripMinutes = durationSeconds / 60;
  fare += tripMinutes * tariff.perMinuteRate;
  fare = fare * surgeMultiplier;

  return Math.round(fare);
}

// === Uber Live Scraping with browserless.io ===
async function scrapeUberFares(pickupAddress: string, dropAddress: string) {
  const browserlessToken = process.env.BROWSERLESS_TOKEN;
  if (!browserlessToken) {
    console.log("No BROWSERLESS_TOKEN found");
    return null;
  }

  try {
    const browser = await puppeteer.connect({
      browserWSEndpoint: `wss://production-sfo.browserless.io?token=${browserlessToken}&stealth=true`,
    });

    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15");
    await page.setViewport({ width: 390, height: 844 });

    await page.goto('https://m.uber.com/looking', { waitUntil: 'networkidle2' });

    // Pickup
    await page.waitForSelector('input[placeholder*="Where to?" i]', { timeout: 20000 });
    await page.type('input[placeholder*="Where to?" i]', pickupAddress);
    await new Promise(r => setTimeout(r, 2000));
    await page.keyboard.press('Enter');

    // Dropoff
    await page.waitForSelector('input[placeholder*="drop" i]', { timeout: 15000 });
    await page.type('input[placeholder*="drop" i]', dropAddress);
    await new Promise(r => setTimeout(r, 2500));
    await page.keyboard.press('Enter');

    // Wait for fares
    await page.waitForSelector('[data-testid*="fare"], .ride-option, [class*="price"]', { timeout: 30000 });

    const fares = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.ride-option, [data-testid*="ride-type"], [class*="fare"]'));
      return items.map(el => {
        const nameEl = el.querySelector('.display-name, .vehicle-name, h3, [class*="name"]');
        const priceEl = el.querySelector('.price-amount, .fare, [class*="price"]');
        
        const name = nameEl ? (nameEl.textContent || nameEl.innerText || '').trim() : 'Uber Ride';
        let priceText = priceEl ? (priceEl.textContent || priceEl.innerText || '0') : '0';
        const price = parseInt(priceText.replace(/[^0-9]/g, '')) || 0;

        return {
          name,
          price,
          provider: "Uber (Live)",
        };
      }).filter(f => f.price > 50);
    });

    await browser.close();
    return fares;
  } catch (err: any) {
    console.error("Uber scraping failed:", err.message);
    return null;
  }
}

// === Main API Handler ===
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      pickup_lat, pickup_lng, drop_lat, drop_lng, 
      pickup_address, drop_address 
    } = body;

    if (!pickup_lat || !pickup_lng || !drop_lat || !drop_lng) {
      return NextResponse.json({ error: "Missing location data" }, { status: 400 });
    }

    // === Distance & Duration Calculation ===
    // TODO: Replace this placeholder with your original OSRM / Google Maps routing code
    let distanceMeters = 8000;   // Default fallback (8 km)
    let durationSeconds = 1200;  // Default fallback (20 minutes)

    // === Surge Multiplier ===
    const currentHour = new Date().getHours();
    let surgeMultiplier = 1.0;
    if ((currentHour >= 8 && currentHour <= 11) || (currentHour >= 17 && currentHour <= 21)) {
      surgeMultiplier = 1.35;
    } else if (currentHour >= 23 || currentHour <= 4) {
      surgeMultiplier = 1.2;
    }

    // === Try Live Uber Prices ===
    const pickupAddr = pickup_address || `${pickup_lat},${pickup_lng}`;
    const dropAddr = drop_address || `${drop_lat},${drop_lng}`;

    const scrapedUber = await scrapeUberFares(pickupAddr, dropAddr);

    let uberPricing: any[] = [];

    if (scrapedUber && scrapedUber.length > 0) {
      uberPricing = scrapedUber.map((item: any, index: number) => ({
        id: `uber-live-${index}`,
        name: item.name,
        provider: "Uber (Live)",
        category: "Eco Cab",
        price: item.price,
        durationMinutes: Math.round(durationSeconds / 60),
        etaMinutes: 5,
        deeplink: "#",
        discountApplied: null,
      }));
    } else {
      // Fallback to your original estimates
      uberPricing = [
        { 
          id: "uber-1", 
          name: "Uber Auto", 
          provider: "Uber", 
          category: "Auto", 
          price: calculateCalibratedFare("Auto", distanceMeters, durationSeconds, surgeMultiplier), 
          durationMinutes: Math.round(durationSeconds/60), 
          etaMinutes: 5, 
          deeplink: "#" 
        },
        { 
          id: "uber-2", 
          name: "Uber Eco", 
          provider: "Uber", 
          category: "EcoCab", 
          price: calculateCalibratedFare("EcoCab", distanceMeters, durationSeconds, surgeMultiplier), 
          durationMinutes: Math.round(durationSeconds/60), 
          etaMinutes: 6, 
          deeplink: "#" 
        },
        { 
          id: "uber-3", 
          name: "Uber Sedan", 
          provider: "Uber", 
          category: "PremiumSedan", 
          price: calculateCalibratedFare("PremiumSedan", distanceMeters, durationSeconds, surgeMultiplier), 
          durationMinutes: Math.round(durationSeconds/60), 
          etaMinutes: 7, 
          deeplink: "#" 
        },
      ];
    }

    // === Other Providers (Add your Ola, Rapido, ONDC here) ===
    const otherPricing: any[] = [];

    const allFares = [...uberPricing, ...otherPricing];

    return NextResponse.json({
      metadata: {
        distance: (distanceMeters / 1000).toFixed(1) + " km",
        duration: Math.round(durationSeconds / 60) + " min",
        timestamp: new Date().toISOString(),
      },
      fares: { "Ride Sharing": allFares },
      note: scrapedUber ? "Uber prices are LIVE (scraped)" : "Showing estimated prices",
    });

  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
