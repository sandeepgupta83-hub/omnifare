import { NextResponse } from 'next/server';
import { chromium } from 'playwright-core'; // Clean ES import to fix the runtime module error

export async function POST(request: Request) {
  let browser;
  try {
    // 1. Read the parameters out of the incoming POST request body
    const body = await request.json();
    const { startLat, startLng, endLat, endLng } = body;

    if (!startLat || !endLat) {
      return NextResponse.json({ error: "Missing coordinates in request body" }, { status: 400 });
    }

    const token = process.env.BROWSERLESS_TOKEN;
    const wsEndpoint = `wss://chrome.browserless.io?token=${token}`;
    
    // 2. Connect to Browserless over WebSockets
    browser = await chromium.connectOverCDP(wsEndpoint);
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
    });
    
    const page = await context.newPage();

    // 3. Navigate to the target web booker layout using your live coordinates
    const targetUrl = `https://m.uber.com/looking?pickup={"latitude":${startLat},"longitude":${startLng}}&destination={"latitude":${endLat},"longitude":${endLng}}`;
    await page.goto(targetUrl, { waitUntil: 'networkidle' });

    // 4. Wait for the live pricing elements to finish calculating
    await page.waitForSelector('[data-test="fare-card"]', { timeout: 8000 });

    // 5. Parse out titles and fare data nodes safely
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
    console.error("Scraping execution caught an error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    if (browser) await browser.close();
  }
}
