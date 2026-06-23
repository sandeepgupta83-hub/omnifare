import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { startLat, startLng, endLat, endLng } = body;

    if (!startLat || !endLat) {
      return NextResponse.json({ error: "Missing coordinates in request body" }, { status: 400 });
    }

    const token = process.env.BROWSERLESS_TOKEN;
    
    // This entire browser automation runs directly inside the Browserless cloud.
    // Zero dependencies or heavy browser packages are needed on your Vercel server!
    const cloudScraperScript = `
      export default async ({ page, context }) => {
        const { targetUrl } = context;
        
        // Emulate a standard mobile screen layout
        await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1');
        await page.setViewport({ width: 375, height: 812 });
        
        // Navigate to the mobile map page 
        await page.goto(targetUrl, { waitUntil: 'networkidle2' });
        
        // Wait for the pricing calculation component cards to render
        await page.waitForSelector('[data-test="fare-card"]', { timeout: 8000 });
        
        // Extract plain layout titles and fare nodes straight from the page DOM
        const options = await page.$$eval('[data-test="fare-card"]', cards => {
          return cards.map(card => {
            const title = card.querySelector('[data-test="fare-title"]')?.textContent || 'Ride';
            const price = card.querySelector('[data-test="fare-price"]')?.textContent || 'N/A';
            return { provider: 'Uber', tier: title, fare: price };
          });
        });
        
        return { data: options, type: 'application/json' };
      };
    `;

    const targetUrl = `https://m.uber.com/looking?pickup={"latitude":${startLat},"longitude":${startLng}}&destination={"latitude":${endLat},"longitude":${endLng}}`;

    // Make a standard, lightweight HTTP POST call to Browserless
    const response = await fetch(`https://chrome.browserless.io/function?token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: cloudScraperScript,
        context: { targetUrl }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Browserless service error: ${errorText}`);
    }

    const scrapedData = await response.json();
    
    // Return the clean live options back to your app front-end layout dashboard
    return NextResponse.json({ success: true, data: scrapedData });

  } catch (error: any) {
    console.error("Aggregation endpoint failed:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
