import { NextResponse } from "next/server";
import puppeteer from 'puppeteer-core';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { pickup_address, drop_address, pickup_lat, pickup_lng, drop_lat, drop_lng } = body;

    const pickupAddr = pickup_address || `${pickup_lat},${pickup_lng}`;
    const dropAddr = drop_address || `${drop_lat},${drop_lng}`;

    // Try Live Scraping First
    const scraped = await scrapeUberFares(pickupAddr, dropAddr);

    let faresData: any = {};

    if (scraped && scraped.length > 0) {
      // Convert scraped data to frontend-expected format
      faresData = {
        "Bike": scraped.filter((f: any) => f.name.toLowerCase().includes("bike") || f.name.toLowerCase().includes("moto")),
        "Auto": scraped.filter((f: any) => f.name.toLowerCase().includes("auto")),
        "EcoCab": scraped.filter((f: any) => f.name.toLowerCase().includes("mini") || f.name.toLowerCase().includes("eco") || f.name.toLowerCase().includes("go")),
        "PremiumSedan": scraped.filter((f: any) => f.name.toLowerCase().includes("sedan") || f.name.toLowerCase().includes("prime")),
        "Prime": scraped.filter((f: any) => f.name.toLowerCase().includes("prime") || f.name.toLowerCase().includes("xl")),
      };
    } else {
      // Good fallback prices
      faresData = {
        "Bike": [{ id: "bike-1", name: "Uber Bike", provider: "Uber", category: "Bike", price: 110, durationMinutes: 20, etaMinutes: 5, deeplink: "#", discountApplied: null }],
        "Auto": [{ id: "auto-1", name: "Uber Auto", provider: "Uber", category: "Auto", price: 195, durationMinutes: 23, etaMinutes: 6, deeplink: "#", discountApplied: null }],
        "EcoCab": [{ id: "eco-1", name: "Uber Mini / Eco", provider: "Uber", category: "EcoCab", price: 265, durationMinutes: 22, etaMinutes: 7, deeplink: "#", discountApplied: null }],
        "PremiumSedan": [{ id: "sedan-1", name: "Uber Sedan", provider: "Uber", category: "PremiumSedan", price: 420, durationMinutes: 22, etaMinutes: 8, deeplink: "#", discountApplied: null }],
        "Prime": [{ id: "prime-1", name: "Uber Prime", provider: "Uber", category: "Prime", price: 480, durationMinutes: 21, etaMinutes: 7, deeplink: "#", discountApplied: null }],
      };
    }

    return NextResponse.json({
      metadata: { distance: "8.5 km", duration: "22 min", timestamp: new Date().toISOString() },
      fares: faresData,
      note: scraped ? "✅ Live prices from Uber" : "⚠️ Using estimates (scraping failed)"
    });

  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ fares: {}, note: "Error" });
  }
}

// Live Scraping Function
async function scrapeUberFares(pickupAddress: string, dropAddress: string) {
  const token = process.env.BROWSERLESS_TOKEN;
  if (!token) return null;

  try {
    const browser = await puppeteer.connect({
      browserWSEndpoint: `wss://production-sfo.browserless.io?token=${token}&stealth=true`,
    });

    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15");
    await page.setViewport({ width: 390, height: 844 });

    await page.goto('https://m.uber.com/looking', { waitUntil: 'networkidle2' });

    // Try multiple possible selectors
    await page.waitForSelector('input[placeholder*="Where to?" i], input[aria-label*="pickup" i]', { timeout: 25000 });
    await page.type('input[placeholder*="Where to?" i], input[aria-label*="pickup" i]', pickupAddress);
    await new Promise(r => setTimeout(r, 2500));
    await page.keyboard.press('Enter');

    await page.waitForSelector('input[placeholder*="drop" i]', { timeout: 20000 });
    await page.type('input[placeholder*="drop" i]', dropAddress);
    await new Promise(r => setTimeout(r, 3000));
    await page.keyboard.press('Enter');

    await page.waitForSelector('[data-testid*="fare"], .ride-option, [class*="price"]', { timeout: 35000 });

    const fares = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('[data-testid*="ride"], .ride-option, [class*="fare"]'));
      return cards.map(el => {
        const text = (el.textContent || '').trim();
        const nameMatch = text.match(/(Bike|Auto|Mini|Eco|Sedan|Prime|XL|Go)/i);
        const priceMatch = text.match(/₹?\s*(\d{2,4})/);
        return {
          name: nameMatch ? nameMatch[0] : 'Uber Ride',
          price: priceMatch ? parseInt(priceMatch[1]) : 0,
          provider: "Uber (Live)"
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
