import { NextResponse } from "next/server";
import puppeteer from 'puppeteer-core';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { pickup_address, drop_address } = body || {};

    const pickupAddr = pickup_address || "Indiranagar, Bangalore";
    const dropAddr = drop_address || "EcoSpace, Bellandur";

    const scraped = await scrapeUberFares(pickupAddr, dropAddr);

    let faresData = {};

    if (scraped && scraped.length > 0) {
      faresData = {
        "Bike": scraped.filter((f: any) => /bike|moto/i.test(f.name)),
        "Auto": scraped.filter((f: any) => /auto/i.test(f.name)),
        "EcoCab": scraped.filter((f: any) => /mini|eco|go/i.test(f.name)),
        "PremiumSedan": scraped.filter((f: any) => /sedan|prime/i.test(f.name)),
        "Prime": scraped.filter((f: any) => /prime|xl/i.test(f.name)),
      };
    } else {
      // Strong realistic fallback for Bangalore
      faresData = {
        "Bike": [{ id: "b1", name: "Uber Bike", provider: "Uber", category: "Bike", price: 115, durationMinutes: 20, etaMinutes: 5, deeplink: "#", discountApplied: null }],
        "Auto": [{ id: "a1", name: "Uber Auto", provider: "Uber", category: "Auto", price: 185, durationMinutes: 23, etaMinutes: 6, deeplink: "#", discountApplied: null }],
        "EcoCab": [{ id: "e1", name: "Uber Mini / Eco", provider: "Uber", category: "EcoCab", price: 275, durationMinutes: 22, etaMinutes: 7, deeplink: "#", discountApplied: null }],
        "PremiumSedan": [{ id: "s1", name: "Uber Sedan", provider: "Uber", category: "PremiumSedan", price: 415, durationMinutes: 22, etaMinutes: 8, deeplink: "#", discountApplied: null }],
        "Prime": [{ id: "p1", name: "Uber Prime", provider: "Uber", category: "Prime", price: 475, durationMinutes: 21, etaMinutes: 7, deeplink: "#", discountApplied: null }],
      };
    }

    return NextResponse.json({
      metadata: { distance: "8.5 km", duration: "22 min", timestamp: new Date().toISOString() },
      fares: faresData,
      note: scraped ? "✅ Live from Uber" : "⚠️ Estimates (scraping failed)"
    });

  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ fares: {}, note: "Error" });
  }
}

async function scrapeUberFares(pickupAddress: string, dropAddress: string) {
  const token = process.env.BROWSERLESS_TOKEN;
  if (!token) return null;

  try {
    const browser = await puppeteer.connect({
      browserWSEndpoint: `wss://production-sfo.browserless.io?token=${token}&stealth=true`,
    });

    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15");
    await page.setViewport({ width: 390, height: 844 });

    await page.goto('https://m.uber.com/looking', { waitUntil: 'networkidle2' });

    // More flexible selectors
    await page.waitForSelector('input[type="text"], input[placeholder]', { timeout: 25000 });
    
    const inputs = await page.$$('input');
    if (inputs.length > 0) {
      await inputs[0].type(pickupAddress);
      await new Promise(r => setTimeout(r, 2000));
      await page.keyboard.press('Enter');
    }

    await new Promise(r => setTimeout(r, 3000));

    if (inputs.length > 1) {
      await inputs[1].type(dropAddress);
      await new Promise(r => setTimeout(r, 2500));
      await page.keyboard.press('Enter');
    }

    await page.waitForSelector('[class*="price"], [data-testid*="fare"], .ride-option, button', { timeout: 35000 });

    const fares = await page.evaluate(() => {
      const textBlocks = Array.from(document.querySelectorAll('body *'));
      const results = [];
      for (let el of textBlocks) {
        const text = (el.textContent || '').trim();
        if (!text) continue;
        const priceMatch = text.match(/₹?\s*(\d{2,4})/);
        if (priceMatch && parseInt(priceMatch[1]) > 50) {
          const nameMatch = text.match(/(Bike|Auto|Mini|Eco|Sedan|Prime|XL|Go)/i);
          if (nameMatch) {
            results.push({
              name: nameMatch[0],
              price: parseInt(priceMatch[1]),
              provider: "Uber (Live)"
            });
          }
        }
      }
      return results.slice(0, 8); // limit results
    });

    await browser.close();
    return fares;
  } catch (err: any) {
    console.error("Uber scraping failed:", err.message);
    return null;
  }
}
