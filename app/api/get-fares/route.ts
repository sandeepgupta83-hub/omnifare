import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const faresData = {
      "Auto": [
        {
          id: "uber-auto-1",
          name: "Uber Auto",
          provider: "Uber",
          category: "Auto",
          price: 185,           // Improved
          durationMinutes: 22,
          etaMinutes: 6,
          deeplink: "#",
          discountApplied: null
        }
      ],
      "EcoCab": [
        {
          id: "uber-eco-1",
          name: "Uber Eco / Mini",
          provider: "Uber",
          category: "EcoCab",
          price: 265,
          durationMinutes: 22,
          etaMinutes: 7,
          deeplink: "#",
          discountApplied: null
        }
      ],
      "PremiumSedan": [
        {
          id: "uber-sedan-1",
          name: "Uber Sedan",
          provider: "Uber",
          category: "PremiumSedan",
          price: 420,
          durationMinutes: 22,
          etaMinutes: 8,
          deeplink: "#",
          discountApplied: null
        }
      ]
    };

    return NextResponse.json({
      metadata: {
        distance: "8.5 km",
        duration: "22 min",
        timestamp: new Date().toISOString()
      },
      fares: faresData,
      note: "Showing estimated prices • Live scraping paused"
    });

  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ 
      metadata: { distance: "0 km", duration: "0 min" },
      fares: { "Auto": [], "EcoCab": [], "PremiumSedan": [] },
      note: "Error loading fares" 
    });
  }
}
