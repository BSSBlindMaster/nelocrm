export async function geocodeAddress(
  address: string,
): Promise<{ lat: number; lng: number } | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_KEY;
  if (!token || !address) {
    return null;
  }

  const encoded = encodeURIComponent(address);
  const response = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${token}&country=US&limit=1`,
  );
  const data = (await response.json()) as {
    features?: Array<{ center?: [number, number] }>;
  };

  if (data.features && data.features.length > 0 && data.features[0].center) {
    const [lng, lat] = data.features[0].center;
    return { lat, lng };
  }

  return null;
}
