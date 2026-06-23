import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { startLat, startLng, endLat, endLng } = body;

    const token = process.env.BROWSERLESS_TOKEN;
    
    // Diagnostic script to capture a live screenshot of the target state
    const debugScript = `
      export default async ({ page, context }) => {
        const { targetUrl } = context;
        await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1');
        await page.setViewport({ width: 375, height: 812 });
        
        await page.goto(targetUrl, { waitUntil: 'networkidle2' });
        
        // Give it 4 seconds to settle down and render
        await page.waitForTimeout(4000);
        
        // Take a full page screenshot to show us exactly what is on the screen!
        const screenshot = await page.screenshot({ type: 'jpeg', quality: 60 });
        return { data: screenshot.toString('base64'), type: 'text/plain' };
      };
    `;

    const targetUrl = `https://m.uber.com/looking?pickup={"latitude":${startLat || 19.0760},"longitude":${startLng || 72.8777}}&destination={"latitude":${endLat || 19.2183},"longitude":${endLng || 72.9781}}`;

    const response = await fetch(`https://chrome.browserless.io/function?token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: debugScript,
        context: { targetUrl }
      })
    });

    const result = await response.json();
    
    // This will print a long string of letters in your Vercel logs—that is your image data!
    console.log("SCREENSHOT_DATA_START:" + result.data + ":SCREENSHOT_DATA_END");

    return NextResponse.json({ success: true, message: "Screenshot captured in logs" });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
