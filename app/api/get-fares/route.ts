import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const faresData = {
      "Bike": [{ 
        id: "b1", 
        name: "Uber Bike", 
        provider: "Uber", 
        category: "Bike", 
        price: 105, 
        durationMinutes: 20, 
        etaMinutes: 5, 
        deeplink: "#", 
        discountApplied: null 
      }],
      "Auto": [{ 
        id: "a1", 
        name: "Uber Auto", 
        provider: "Uber", 
        category: "Auto", 
        price: 195, 
        durationMinutes: 23, 
        etaMinutes: 6, 
        deeplink: "#", 
        discountApplied: null 
      }],
      "EcoCab": [{ 
        id: "e1", 
        name: "Uber Mini / Eco", 
        provider: "Uber", 
        category: "EcoCab", 
        price: 275, 
        durationMinutes: 22, 
        etaMinutes: 7, 
        deeplink: "#", 
        discountApplied: null 
      }],
      "PremiumSedan": [{ 
        id: "s1", 
        name: "Uber Sedan", 
        provider: "Uber", 
        category: "PremiumSedan", 
        price: 415, 
        durationMinutes: 22, 
        etaMinutes: 8, 
        deeplink: "#", 
        discountApplied: null 
      }],
      "Prime": [{ 
        id: "p1", 
        name: "Uber Prime", 
        provider: "Uber", 
        category: "Prime", 
        price: 475, 
        durationMinutes: 21, 
        etaMinutes: 7, 
        deeplink: "#", 
        discountApplied: null 
      }]
    };

    return NextResponse.json({
      metadata: { 
        distance: "8.5 km", 
        duration: "22 min", 
        timestamp: new Date().toISOString() 
      },
      fares: faresData,
      note: "Estimated prices (Live scraping temporarily disabled due to Uber changes)"
    });

  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ fares: {}, note: "Error loading fares" });
  }
}
