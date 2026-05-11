import { NextResponse } from "next/server";

type ReverseGeoResponse = {
  city?: string;
  locality?: string;
  principalSubdivision?: string;
  countryName?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
};

function asNumber(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function cleanParts(parts: Array<string | undefined>): string[] {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const lat = asNumber(url.searchParams.get("lat"));
  const lon = asNumber(url.searchParams.get("lon"));

  if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ detail: "Valid latitude and longitude are required." }, { status: 400 });
  }

  try {
    const upstream = new URL("https://api.bigdatacloud.net/data/reverse-geocode-client");
    upstream.searchParams.set("latitude", String(lat));
    upstream.searchParams.set("longitude", String(lon));
    upstream.searchParams.set("localityLanguage", "en");

    const resp = await fetch(upstream, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });

    if (!resp.ok) {
      return NextResponse.json({ detail: "Could not resolve this location." }, { status: resp.status });
    }

    const data = (await resp.json().catch(() => ({}))) as ReverseGeoResponse;
    const city = data.city || data.locality || undefined;
    const region = data.principalSubdivision || undefined;
    const country = data.countryName || undefined;
    const labelParts = cleanParts([city, country]);

    return NextResponse.json({
      city,
      region,
      country,
      countryCode: data.countryCode || undefined,
      latitude: data.latitude ?? lat,
      longitude: data.longitude ?? lon,
      label: labelParts.length ? labelParts.join(", ") : `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
    });
  } catch {
    return NextResponse.json({ detail: "Location lookup is unavailable right now." }, { status: 503 });
  }
}
