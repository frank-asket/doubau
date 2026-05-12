"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { OnboardingStepFrame } from "@/components/onboarding/OnboardingStepFrame";

type Profile = {
  location?: string | null;
  contact_preferences?: string | null;
  goals?: {
    focus?: string[];
    opportunity_locations?: string[];
    job_pool_strategy?: string;
    geo?: GeoResult;
  } | null;
};

type GeoResult = {
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
  label?: string;
};

const contactOptions = [
  "Email first",
  "Email and LinkedIn",
  "Recruiters can contact me",
  "Only show verified employers",
];

function unique(values: Array<string | undefined | null>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

function opportunityLocations(location: string, geo: GeoResult | null): string[] {
  return unique([
    location,
    geo?.city,
    geo?.region,
    geo?.country,
    geo?.city && geo?.country ? `${geo.city}, ${geo.country}` : null,
    "Remote",
  ]);
}

function currentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      maximumAge: 1000 * 60 * 30,
      timeout: 12000,
    });
  });
}

export default function OnboardingContactPage() {
  const router = useRouter();
  const [location, setLocation] = useState("");
  const [contactPreferences, setContactPreferences] = useState("");
  const [goals, setGoals] = useState<Profile["goals"]>(null);
  const [geo, setGeo] = useState<GeoResult | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [geoMessage, setGeoMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locationHints = useMemo(() => opportunityLocations(location, geo), [geo, location]);
  const hasDetectedLocation = Boolean(geo?.label || geo?.city || geo?.country);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch("/api/me/profile", { cache: "no-store" });
        if (!resp.ok) return;
        const data = (await resp.json().catch(() => ({}))) as Profile;
        if (cancelled) return;
        if (typeof data.location === "string") setLocation(data.location);
        if (typeof data.contact_preferences === "string") setContactPreferences(data.contact_preferences);
        if (data.goals && typeof data.goals === "object") {
          setGoals(data.goals);
          if (data.goals.geo) setGeo(data.goals.geo);
        }
      } catch {
        // Existing profile data is helpful, but not required to continue onboarding.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function detectLocation() {
    setGeoMessage(null);
    setError(null);

    if (!("geolocation" in navigator)) {
      setGeoMessage("Your browser does not support location detection. You can type your city instead.");
      return;
    }

    setDetecting(true);
    try {
      const position = await currentPosition();
      const { latitude, longitude } = position.coords;
      const resp = await fetch(`/api/geo/reverse?lat=${latitude}&lon=${longitude}`, { cache: "no-store" });
      if (!resp.ok) {
        setGeo({
          latitude,
          longitude,
          label: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
        });
        setGeoMessage("We found your coordinates, but could not name the city. Add the city manually if needed.");
        return;
      }

      const data = (await resp.json().catch(() => ({}))) as GeoResult;
      setGeo(data);
      if (data.label) setLocation(data.label);
      setGeoMessage(data.label ? `Using ${data.label} for nearby opportunities.` : "Location detected.");
    } catch (e) {
      const maybeGeoError = e as { code?: number } | null;
      const message =
        maybeGeoError?.code === 1
          ? "Location access was not allowed. Type your city or country instead."
          : "We could not detect your location. Type your city or country instead.";
      setGeoMessage(message);
    } finally {
      setDetecting(false);
    }
  }

  async function onNext(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const trimmedLocation = location.trim();
      const nextGoals = {
        ...(goals && typeof goals === "object" ? goals : {}),
        opportunity_locations: opportunityLocations(trimmedLocation, geo),
        job_pool_strategy: "controlled_feeds_first",
        geo: geo || undefined,
      };

      const resp = await fetch("/api/me/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          location: trimmedLocation || null,
          contact_preferences: contactPreferences || null,
          goals: nextGoals,
        }),
      });
      if (!resp.ok) {
        setError("Could not save. Please try again.");
        return;
      }
      router.push("/onboarding/resume");
    } finally {
      setLoading(false);
    }
  }

  return (
    <OnboardingStepFrame
      eyebrow="Local matching"
      title="Where should DouBow look first?"
      description="Your city and country help us rank nearby roles, remote options, and sponsorship-friendly opportunities."
      stepLabel="Step 2 of 5"
    >
      <form onSubmit={onNext} className="space-y-5">
        <div className="rounded-[var(--app-radius-md)] border-[0.5px] border-[var(--app-border)] bg-[var(--app-bg-muted)] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[13px] font-semibold text-[var(--app-text-primary)]">
                Detect my current area
              </div>
              <p className="mt-1 text-[12px] leading-5 text-[var(--app-text-secondary)]">
                We only use this to personalize your job search. You can edit the location before saving.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void detectLocation()}
              disabled={detecting}
              className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-[var(--app-radius-pill)] bg-[var(--app-accent)] px-4 text-[12px] font-semibold text-white transition-[background-color,transform] duration-150 ease-out hover:bg-[var(--app-accent-hover)] disabled:opacity-60 active:scale-[0.96]"
            >
              {detecting ? "Detecting..." : hasDetectedLocation ? "Refresh location" : "Use my location"}
            </button>
          </div>
          {geoMessage ? (
            <p className="mt-3 text-[12px] leading-5 text-[var(--app-text-secondary)]">{geoMessage}</p>
          ) : null}
        </div>

        <label className="block">
          <span className="text-[13px] font-medium text-[var(--app-text-primary)]">City or country</span>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            name="location"
            autoComplete="address-level2"
            placeholder="e.g. Accra, Ghana"
            className="mt-2 h-11 w-full rounded-[var(--app-radius-md)] border-[0.5px] border-[var(--app-border)] bg-transparent px-3 text-[14px] text-[var(--app-text-primary)] outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]"
          />
        </label>

        <div>
          <div className="text-[13px] font-medium text-[var(--app-text-primary)]">Opportunity areas</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {locationHints.map((hint) => (
              <button
                key={hint}
                type="button"
                onClick={() => setLocation(hint === "Remote" ? "Remote" : hint)}
                className="rounded-[var(--app-radius-pill)] border-[0.5px] border-[var(--app-border)] bg-[var(--app-bg-page)] px-3 py-1.5 text-[12px] font-medium text-[var(--app-text-secondary)] transition-colors hover:border-[var(--app-accent)] hover:text-[var(--app-text-primary)]"
              >
                {hint}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-[var(--app-radius-md)] border-[0.5px] border-[color-mix(in_srgb,var(--app-accent)_28%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-accent)_7%,var(--app-bg-elevated))] p-4">
          <div className="text-[13px] font-semibold text-[var(--app-text-primary)]">
            How matching works in your market
          </div>
          <p className="mt-1 text-[12px] leading-5 text-[var(--app-text-secondary)]">
            DouBow starts with job feeds and APIs we can attribute, refresh, and control. Your location helps rank nearby,
            regional, and remote roles, but coverage can vary by city and country while the index grows.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-[var(--app-radius-pill)] bg-[var(--app-badge-blue-bg)] px-3 py-1.5 text-[11px] font-semibold text-[var(--app-accent)]">
              Controlled feeds first
            </span>
            <span className="rounded-[var(--app-radius-pill)] bg-[var(--app-badge-gray-bg)] px-3 py-1.5 text-[11px] font-semibold text-[var(--app-badge-gray-fg)]">
              Source shown on every job
            </span>
            <span className="rounded-[var(--app-radius-pill)] bg-[var(--app-badge-green-bg)] px-3 py-1.5 text-[11px] font-semibold text-[var(--app-badge-green-fg)]">
              Remote roles included
            </span>
          </div>
        </div>

        <div>
          <div className="text-[13px] font-medium text-[var(--app-text-primary)]">Contact preference</div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {contactOptions.map((option) => {
              const checked = contactPreferences === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setContactPreferences(option)}
                  aria-pressed={checked}
                  className={[
                    "min-h-11 rounded-[var(--app-radius-md)] border-[0.5px] px-3 text-left text-[13px] font-medium transition-[background-color,border-color,transform] duration-150 ease-out active:scale-[0.96]",
                    checked
                      ? "border-[color-mix(in_srgb,var(--app-accent)_55%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-accent)_9%,var(--app-bg-elevated))] text-[var(--app-text-primary)]"
                      : "border-[var(--app-border)] text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-muted)]",
                  ].join(" ")}
                >
                  {option}
                </button>
              );
            })}
          </div>
          <input
            value={contactPreferences}
            onChange={(e) => setContactPreferences(e.target.value)}
            name="contact_preferences"
            autoComplete="off"
            placeholder="Or write your own preference"
            className="mt-3 h-11 w-full rounded-[var(--app-radius-md)] border-[0.5px] border-[var(--app-border)] bg-transparent px-3 text-[14px] text-[var(--app-text-primary)] outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]"
          />
        </div>

        {error ? (
          <div className="rounded-[var(--app-radius-md)] border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-600 dark:text-red-300">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-11 w-full items-center justify-center rounded-[var(--app-radius-md)] bg-[var(--app-accent)] text-[14px] font-semibold text-white transition-transform disabled:opacity-60 active:scale-[0.96]"
        >
          {loading ? "Saving..." : "Continue"}
        </button>
      </form>
    </OnboardingStepFrame>
  );
}
