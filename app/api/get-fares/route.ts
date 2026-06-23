import { NextResponse } from 'next/server';
const { chromium } = require('playwright-core');

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startLat = searchParams.get('startLat');
  const startLng = searchParams.get('startLng');
  const endLat = searchParams.get('endLat');
  const endLng = searchParams.get('endLng');

  if (!startLat || !endLat) {
    return NextResponse.json({ error: "Missing coordinates" }, { status: 400 });
  }

  const token = process.env.BROWSERLESS_TOKEN;
  const wsEndpoint = `wss://chrome.browserless.io?token=${token}`;
  
  let browser;
  try {
    // Connect to your free Browserless cloud browser instance
    browser = await chromium.connectOverCDP(wsEndpoint);
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
    });
    
    const page = await context.newPage();

    // Open Uber's public mobile web application interface with user coordinates
    const targetUrl = `https://m.uber.com/looking?pickup={"latitude":${startLat},"longitude":${startLng}}&destination={"latitude":${endLat},"longitude":${endLng}}`;
    await page.goto(targetUrl, { waitUntil: 'networkidle' });

    // Wait for the UI components to calculate and display the live options
    await page.waitForSelector('[data-test="fare-card"]', { timeout: 8000 });

    // Extract the live, real-world text content straight out of the DOM nodes
    const fareOptions = await page.evaluate(() => {
      const cards = document.querySelectorAll('[data-test="fare-card"]');
      return Array.from(cards).map(card => {
        const title = card.querySelector('[data-test="fare-title"]')?.textContent || 'Ride';
        const price = card.querySelector('[data-test="fare-price"]')?.textContent || 'N/A';
        return { provider: 'Uber', tier: title, fare: price };
      });
    });

    return NextResponse.json({ success: true, data: fareOptions });

  } catch (error: any) {
    console.error("Scraping error snapshot:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    if (browser) await browser.close();
  }
}
