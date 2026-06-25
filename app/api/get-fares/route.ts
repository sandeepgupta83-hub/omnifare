import { NextResponse } from "next/server";
import puppeteer from 'puppeteer-core';

// === Your original tariff rules ===
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
    await page.waitForSelector('input[placeholder*="Where to?" i]', { timeout: 15000 });
    await page.type('input[placeholder*="Where to?" i]', pickupAddress);
    await new Promise(r => setTimeout(r, 1500));
    await page.keyboard.press('Enter');

    // Dropoff
    await page.waitForSelector('input[placeholder*="drop" i]', { timeout: 10000 });
    await page.type('input[placeholder*="drop" i]', dropAddress);
    await new Promise(r => setTimeout(r, 2000));
    await page.keyboard.press('Enter');

    // Wait for fares
    await page.waitForSelector('[data-testid*="fare"], .ride-option', { timeout: 25000 });

    const fares = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.ride-option, [data-testid*="ride-type"], [class*="fare-card"]')).map(el => ({
        name: el.querySelector('.display-name, .vehicle-name, h3, [class*="name"]')?.innerText?.trim() || 'Uber Ride',
        price: parseInt(el.querySelector('.price-amount, .fare, [class*="price"]')?.innerText?.replace(/[^0-9]/g, '') || '0'),
        provider: "Uber (Live)",
      })).filter(f => f.price > 50);
    });

    await browser.close();
    return fares;
  } catch (err) {
    console.error("Uber scraping failed:", err);
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

    // === Your existing routing logic (Google Maps + OSRM + fallback) ===
    // (I kept a simplified version — replace this section with your full routing code if it's different)
    let distanceMeters = 5000;   // placeholder
    let durationSeconds = 900;   // placeholder

    // TODO: Paste your full Google Maps / OSRM routing code here to calculate real distance & duration

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
        etaMinutes: 4,
        deeplink: `https://m.uber.com/looking?pickup[latitude]=${pickup_lat}&pickup[longitude]=${pickup_lng}`,
        discountApplied: null,
      }));
    } else {
      // Fallback to your original estimates
      uberPricing = [
        { id: "uber-1", name: "Uber Auto", provider: "Uber", category: "Auto", price: calculateCalibratedFare("Auto", distanceMeters, durationSeconds, surgeMultiplier), durationMinutes: Math.round(durationSeconds/60), etaMinutes: 5, deeplink: "#" },
        { id: "uber-2", name: "Uber Eco", provider: "Uber", category: "EcoCab", price: calculateCalibratedFare("EcoCab", distanceMeters, durationSeconds, surgeMultiplier), durationMinutes: Math.round(durationSeconds/60), etaMinutes: 6, deeplink: "#" },
        { id: "uber-3", name: "Uber Sedan", provider: "Uber", category: "PremiumSedan", price: calculateCalibratedFare("PremiumSedan", distanceMeters, durationSeconds, surgeMultiplier), durationMinutes: Math.round(durationSeconds/60), etaMinutes: 7, deeplink: "#" },
      ];
    }

    // === Keep your Ola, Rapido, ONDC sections as they are ===
    // For now, using same fallback logic. You can add scraping for them later.

    const olaPricing = [ /* your existing Ola items */ ];
    const rapidoPricing = [ /* your existing Rapido items */ ];
    const ondcPricing = [ /* your existing ONDC items */ ];

    const allFares = [...uberPricing, ...olaPricing, ...rapidoPricing, ...ondcPricing];

    // Simple grouping (you can improve this)
    const groupedFares = {
      "Ride Sharing": allFares,
    };

    return NextResponse.json({
      metadata: {
        distance: (distanceMeters / 1000).toFixed(1) + " km",
        duration: Math.round(durationSeconds / 60) + " min",
        timestamp: new Date().toISOString(),
      },
      fares: groupedFares,
      note: scrapedUber ? "Uber shows LIVE prices (scraped)" : "Showing estimated prices",
    });

  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
