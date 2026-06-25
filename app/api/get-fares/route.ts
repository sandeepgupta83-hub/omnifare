import { NextResponse } from "next/server";
import puppeteer from 'puppeteer-core';

// Tariff Rules
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

function calculateCalibratedFare(category: string, distanceMeters: number, durationSeconds: number, surgeMultiplier: number): number {
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

// Improved Uber Scraping
async function scrapeUberFares(pickupAddress: string, dropAddress: string) {
  const browserlessToken = process.env.BROWSERLESS_TOKEN;
  if (!browserlessToken) return null;

  try {
    const browser = await puppeteer.connect({
      browserWSEndpoint: `wss://production-sfo.browserless.io?token=${browserlessToken}&stealth=true`,
    });

    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15");
    await page.setViewport({ width: 390, height: 844 });

    await page.goto('https://m.uber.com/looking', { waitUntil: 'networkidle2' });

    // Improved input handling
    await page.waitForSelector('input[placeholder*="Where to?" i]', { timeout: 25000 });
    await page.type('input[placeholder*="Where to?" i]', pickupAddress);
    await new Promise(r => setTimeout(r, 2500));
    await page.keyboard.press('Enter');

    await page.waitForSelector('input[placeholder*="drop" i]', { timeout: 20000 });
    await page.type('input[placeholder*="drop" i]', dropAddress);
    await new Promise(r => setTimeout(r, 3000));
    await page.keyboard.press('Enter');

    // Longer wait for prices
    await page.waitForSelector('[data-testid*="fare"], .ride-option, [class*="price"], button', { timeout: 35000 });

    const fares = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('[data-testid*="ride"], .ride-option, [class*="fare-card"], [class*="price"]'));
      return items.map(el => {
        const name = (el.textContent || '').match(/Uber\s*(Auto|Mini|Sedan|Prime|XL|Go)?/i)?.[0] || 'Uber Ride';
        const priceMatch = (el.textContent || '').match(/₹?\s*(\d+)/);
        const price = priceMatch ? parseInt(priceMatch[1]) : 0;
        return { name, price, provider: "Uber (Live)" };
      }).filter(f => f.price > 50);
    });

    await browser.close();
    return fares.length > 0 ? fares : null;
  } catch (err: any) {
    console.error("Uber scraping failed:", err.message);
    return null;
  }
}

// Main Handler
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { pickup_lat, pickup_lng, drop_lat, drop_lng, pickup_address, drop_address } = body;

    if (!pickup_lat || !pickup_lng || !drop_lat || !drop_lng) {
      return NextResponse.json({ error: "Missing location data" }, { status: 400 });
    }

    let distanceMeters = 8000;
    let durationSeconds = 1200;

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
        durationMinutes: 20,
        etaMinutes: 5,
        deeplink: "#",
        discountApplied: null,
      }));
    } else {
      // Strong fallback
      uberPricing = [
        { id: "uber-1", name: "Uber Auto", provider: "Uber", category: "Auto", price: 120, durationMinutes: 20, etaMinutes: 5, deeplink: "#" },
        { id: "uber-2", name: "Uber Eco", provider: "Uber", category: "EcoCab", price: 250, durationMinutes: 20, etaMinutes: 6, deeplink: "#" },
        { id: "uber-3", name: "Uber Sedan", provider: "Uber", category: "PremiumSedan", price: 380, durationMinutes: 20, etaMinutes: 7, deeplink: "#" },
      ];
    }

    const allFares = [...uberPricing];

    return NextResponse.json({
      metadata: { distance: "8.0 km", duration: "20 min", timestamp: new Date().toISOString() },
      fares: { "Ride Sharing": allFares },
      note: scrapedUber ? "✅ Uber LIVE prices" : "⚠️ Using estimated prices (scraping failed)",
    });

  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
