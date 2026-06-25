import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const allFares = [
      {
        id: "uber-auto",
        name: "Uber Auto",
        provider: "Uber",
        category: "Auto",
        price: 145,
        durationMinutes: 22,
        etaMinutes: 6,
        deeplink: "#"
      },
      {
        id: "uber-eco",
        name: "Uber Eco",
        provider: "Uber",
        category: "EcoCab",
        price: 265,
        durationMinutes: 22,
        etaMinutes: 7,
        deeplink: "#"
      },
      {
        id: "uber-sedan",
        name: "Uber Sedan",
        provider: "Uber",
        category: "PremiumSedan",
        price: 395,
        durationMinutes: 22,
        etaMinutes: 8,
        deeplink: "#"
      }
    ];

    return NextResponse.json({
      metadata: {
        distance: "8.5 km",
        duration: "22 min",
        timestamp: new Date().toISOString()
      },
      fares: {
        "Ride Sharing": allFares
      },
      note: "Showing estimated prices (Live Uber scraping paused)"
    });

  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ 
      metadata: { distance: "0 km", duration: "0 min" },
      fares: { "Ride Sharing": [] },
      note: "Error loading fares" 
    });
  }
}
