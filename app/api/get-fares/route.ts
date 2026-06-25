import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const faresData = {
      "Bike": [
        {
          id: "uber-bike-1",
          name: "Uber Bike",
          provider: "Uber",
          category: "Bike",
          price: 95,
          durationMinutes: 20,
          etaMinutes: 5,
          deeplink: "#",
          discountApplied: null
        }
      ],
      "Auto": [
        {
          id: "uber-auto-1",
          name: "Uber Auto",
          provider: "Uber",
          category: "Auto",
          price: 175,        // Adjusted closer to real
          durationMinutes: 23,
          etaMinutes: 6,
          deeplink: "#",
          discountApplied: null
        }
      ],
      "EcoCab": [   // This shows for "Mini"
        {
          id: "uber-mini-1",
          name: "Uber Mini / Eco",
          provider: "Uber",
          category: "EcoCab",
          price: 265,
          durationMinutes: 22,
          etaMinutes: 7,
          deeplink: "#",
          discountApplied: null
        }
      ],
      "PremiumSedan": [   // This shows for "Sedan"
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
      ],
      "Prime": [   // Added for "Prime"
        {
          id: "uber-prime-1",
          name: "Uber Prime",
          provider: "Uber",
          category: "Prime",
          price: 480,
          durationMinutes: 21,
          etaMinutes: 7,
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
      note: "Showing estimated prices (Live scraping paused due to Uber changes)"
    });

  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ 
      metadata: { distance: "0 km", duration: "0 min" },
      fares: {},
      note: "Error loading fares" 
    });
  }
}
