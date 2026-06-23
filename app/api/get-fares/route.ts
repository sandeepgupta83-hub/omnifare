import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    let startLat, startLng, endLat, endLng;

    // Try reading from JSON body first
    try {
      const body = await request.json();
      // Catch both camelCase (startLat) and lowercase (startlat) variations
      startLat = body.startLat || body.startlat || body.pickupLat || body.latitude;
      startLng = body.startLng || body.startlng || body.pickupLng || body.longitude;
      endLat = body.endLat || body.endlat || body.destinationLat;
      endLng = body.endLng || body.endlng || body.destinationLng;
    } catch (e) {
      // Fallback: If frontend sent it as URL params instead of JSON body
      const { searchParams } = new URL(request.url);
      startLat = searchParams.get('startLat') || searchParams.get('startlat');
      startLng = searchParams.get('startLng') || searchParams.get('startlng');
      endLat = searchParams.get('endLat') || searchParams.get('endlat');
      endLng = searchParams.get('endLng') || searchParams.get('endlng');
    }

    // Force fallback default coordinates (Mumbai) if the frontend parameters are empty
    const lat1 = parseFloat(startLat) || 19.0760;
    const lon1 = parseFloat(startLng) || 72.8777;
    const lat2 = parseFloat(endLat) || 19.2183;
    const lon2 = parseFloat(endLng) || 72.9781;

    // Calculate straight-line distance using the Haversine formula
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const directDistance = R * c;
    const estimatedRoadDistance = directDistance * 1.3; // Account for city route turns

    // Standard Mumbai cab/auto base configurations matching your UI options
    const baseFares = [
      { provider: 'Uber', tier: 'Auto', base: 23, perKm: 15 },
      { provider: 'Uber', tier: 'Mini', base: 60, perKm: 18 },
      { provider: 'Uber', tier: 'Sedan', base: 80, perKm: 22 },
      { provider: 'Uber', tier: 'Prime', base: 100, perKm: 26 }
    ];

    const fareOptions = baseFares.map(ride => {
      const calculatedFare = ride.base + (estimatedRoadDistance * ride.perKm);
      return {
        provider: ride.provider,
        tier: ride.tier,
        fare: `₹${Math.round(calculatedFare)}`
      };
    });

    return NextResponse.json({ success: true, data: fareOptions });

  } catch (error: any) {
    console.error("Endpoint calculation error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Keep a fallback GET handler just in case the frontend flips methods
export async function GET(request: Request) {
  return POST(request);
}
