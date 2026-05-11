"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { AppButton } from "@/components/ui/button";
import { queryKeys } from "@/lib/query-keys";

import { ProductPageChrome } from "./ProductPageChrome";

type Profile = {
  email?: string;
  persona?: string | null;
  current_role?: string | null;
  years_experience?: string | null;
  location?: string | null;
  contact_preferences?: string | null;
  plan_tier?: string | null;
};

const PERSONAS = [
  { id: "student", label: "Student / recent graduate" },
  { id: "employed_exploring", label: "Employed, exploring" },
  { id: "active_search", label: "Actively job searching" },
  { id: "career_switcher", label: "Career switcher" },
];

export function SettingsProfileClient() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: queryKeys.profile,
    queryFn: async () => {
      const r = await fetch("/api/me/profile", { cache: "no-store" });
      if (!r.ok) throw new Error("profile");
      return r.json() as Promise<Profile>;
    },
  });

  const [persona, setPersona] = useState("active_search");
  const [currentRole, setCurrentRole] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [location, setLocation] = useState("");
  const [contactPrefs, setContactPrefs] = useState("");

  useEffect(() => {
    if (!q.data) return;
    const p = q.data;
    if (typeof p.persona === "string" && p.persona) setPersona(p.persona);
    if (typeof p.current_role === "string") setCurrentRole(p.current_role);
    if (typeof p.years_experience === "string") setYearsExperience(p.years_experience);
    if (typeof p.location === "string") setLocation(p.location);
    if (typeof p.contact_preferences === "string") setContactPrefs(p.contact_preferences);
  }, [q.data]);

  const save = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/me/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          persona: persona || null,
          current_role: currentRole || null,
          years_experience: yearsExperience || null,
          location: location || null,
          contact_preferences: contactPrefs || null,
        }),
      });
      if (!r.ok) throw new Error("save");
      return r.json() as Promise<Profile>;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.profile });
      await qc.invalidateQueries({ queryKey: queryKeys.workspaceSummary });
    },
  });

  return (
    <ProductPageChrome
      title="Settings & billing"
      description="Profile fields sync to FastAPI via PUT /me/profile. Paid plans are managed under Billing (Clerk Billing)."
    >
      {q.isLoading ? (
        <p className="text-[13px] text-[var(--app-text-secondary)]">Loading profile…</p>
      ) : q.isError ? (
        <p className="text-[13px] text-[var(--app-badge-red-fg)]">Could not load profile.</p>
      ) : (
        <div className="max-w-xl space-y-5 rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-6">
          <div className="text-[13px] text-[var(--app-text-secondary)]">
            Signed in as{" "}
            <span className="font-medium text-[var(--app-text-primary)]">{q.data?.email ?? "—"}</span>
            {q.data?.plan_tier ? (
              <>
                {" "}
                · Plan:{" "}
                <span className="font-mono text-[12px] text-[var(--app-text-primary)]">{q.data.plan_tier}</span>
              </>
            ) : null}
          </div>

          <label className="block text-[12px] font-medium text-[var(--app-text-secondary)]">
            Persona
            <select
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--app-border)] bg-[var(--app-bg-page)] px-3 py-2 text-[13px] text-[var(--app-text-primary)]"
            >
              {PERSONAS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-[12px] font-medium text-[var(--app-text-secondary)]">
            Current role
            <input
              value={currentRole}
              onChange={(e) => setCurrentRole(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--app-border)] bg-[var(--app-bg-page)] px-3 py-2 text-[13px] text-[var(--app-text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]"
            />
          </label>

          <label className="block text-[12px] font-medium text-[var(--app-text-secondary)]">
            Years experience
            <input
              value={yearsExperience}
              onChange={(e) => setYearsExperience(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--app-border)] bg-[var(--app-bg-page)] px-3 py-2 text-[13px] text-[var(--app-text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]"
            />
          </label>

          <label className="block text-[12px] font-medium text-[var(--app-text-secondary)]">
            Location
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--app-border)] bg-[var(--app-bg-page)] px-3 py-2 text-[13px] text-[var(--app-text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]"
            />
          </label>

          <label className="block text-[12px] font-medium text-[var(--app-text-secondary)]">
            Contact preferences
            <textarea
              value={contactPrefs}
              onChange={(e) => setContactPrefs(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-[var(--app-border)] bg-[var(--app-bg-page)] px-3 py-2 text-[13px] text-[var(--app-text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]"
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <AppButton
              type="button"
              disabled={save.isPending}
              onClick={() => save.mutate()}
              className="justify-center"
            >
              {save.isPending ? "Saving…" : "Save profile"}
            </AppButton>
            <Link
              href="/app/billing"
              className="text-[13px] font-medium text-[var(--app-accent)] hover:underline"
            >
              Open billing & subscriptions →
            </Link>
          </div>
          {save.isError ? (
            <p className="text-[13px] text-[var(--app-badge-red-fg)]">Save failed. Try again.</p>
          ) : null}
        </div>
      )}
    </ProductPageChrome>
  );
}
