"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { AppIcon } from "@/components/ui/app-icon";
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [gmailBanner, setGmailBanner] = useState<string | null>(null);

  const googleQ = useQuery({
    queryKey: queryKeys.googleMailbox,
    queryFn: async () => {
      const r = await fetch("/api/me/google/status", { cache: "no-store" });
      if (!r.ok) throw new Error("google");
      return (await r.json()) as {
        oauth_configured: boolean;
        connected: boolean;
        google_account_email?: string | null;
      };
    },
  });

  useEffect(() => {
    const g = searchParams.get("gmail");
    if (!g) return;
    if (g === "connected") {
      setGmailBanner("Gmail connected. You can send applications from Doubow without opening Gmail.");
    } else if (g === "denied") {
      setGmailBanner("Google sign-in was cancelled.");
    } else {
      setGmailBanner("Gmail connection did not complete. Check the API redirect URI and Google Cloud credentials.");
    }
    void qc.invalidateQueries({ queryKey: queryKeys.googleMailbox });
    const t = window.setTimeout(() => router.replace("/app/settings"), 5000);
    return () => window.clearTimeout(t);
  }, [searchParams, router, qc]);

  const disconnectGmail = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/me/google/disconnect", { method: "DELETE" });
      if (!r.ok) throw new Error("disconnect");
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.googleMailbox });
      setGmailBanner("Gmail disconnected.");
    },
  });

  const startGoogleOAuth = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/me/google/oauth-url", { cache: "no-store" });
      const data = (await r.json()) as { authorization_url?: string; detail?: string };
      if (!r.ok) throw new Error(typeof data.detail === "string" ? data.detail : "oauth_url");
      const url = data.authorization_url;
      if (!url) throw new Error("No authorization URL");
      window.location.href = url;
    },
  });

  const q = useQuery({
    queryKey: queryKeys.profile,
    queryFn: async () => {
      const r = await fetch("/api/me/profile", { cache: "no-store" });
      if (!r.ok) throw new Error("profile");
      return (await r.json()) as Profile;
    },
  });

  const [persona, setPersona] = useState("active_search");
  const [currentRole, setCurrentRole] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [location, setLocation] = useState("");
  const [contactPrefs, setContactPrefs] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");

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
      return (await r.json()) as Profile;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.profile });
      await qc.invalidateQueries({ queryKey: queryKeys.workspaceSummary });
    },
  });

  const deleteAccount = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/me/account", { method: "DELETE" });
      const body = (await r.json().catch(() => ({}))) as { detail?: unknown };
      if (!r.ok) {
        throw new Error(typeof body.detail === "string" ? body.detail : "Account deletion failed.");
      }
      return body;
    },
    onSuccess: async () => {
      await qc.clear();
      router.replace("/");
      router.refresh();
    },
  });

  return (
    <ProductPageChrome
      title="Settings"
      description="Keep your profile, preferences, and plan details up to date."
    >
      {q.isLoading ? (
        <p className="text-[13px] text-[var(--app-text-secondary)]">Loading profile…</p>
      ) : q.isError ? (
        <p className="text-[13px] text-[var(--app-badge-red-fg)]">Could not load profile.</p>
      ) : (
        <div className="max-w-2xl space-y-5">
          <div className="space-y-5 rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-6">
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
                className="inline-flex min-h-10 items-center gap-1 rounded-full px-3 text-[13px] font-medium text-[var(--app-accent)] transition-[background-color,transform] duration-150 ease-out hover:bg-[var(--app-bg-muted)] active:scale-[0.96]"
              >
                Open billing & subscriptions <AppIcon name="chevron-right" className="size-4" />
              </Link>
            </div>
            {save.isError ? (
              <p className="text-[13px] text-[var(--app-badge-red-fg)]">Save failed. Try again.</p>
            ) : null}
          </div>

          <div className="space-y-4 rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-6">
            <div>
              <h2 className="text-[15px] font-semibold text-[var(--app-text-primary)]">Gmail (apply without opening Gmail)</h2>
              <p className="mt-2 text-[13px] leading-6 text-[var(--app-text-secondary)]">
                Connect your Google account so Doubow can send outreach from <span className="font-medium">your</span> mailbox
                after you approve a draft. LinkedIn DMs are not automated (ToS); we close the LinkedIn draft in-app when you
                send by email.
              </p>
            </div>
            {gmailBanner ? (
              <p className="rounded-md border border-[var(--app-border)] bg-[var(--app-bg-muted)] px-3 py-2 text-[13px] text-[var(--app-text-secondary)]">
                {gmailBanner}
              </p>
            ) : null}
            {googleQ.isLoading ? (
              <p className="text-[13px] text-[var(--app-text-secondary)]">Checking Gmail connection…</p>
            ) : googleQ.isError ? (
              <p className="text-[13px] text-[var(--app-badge-red-fg)]">Could not load Gmail status.</p>
            ) : !googleQ.data?.oauth_configured ? (
              <p className="text-[13px] text-[var(--app-text-secondary)]">
                Gmail in-app send is not enabled on this deployment yet (API missing{" "}
                <span className="font-mono text-[12px]">DOUBOW_GOOGLE_OAUTH_*</span>).
              </p>
            ) : googleQ.data.connected ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-[13px] text-[var(--app-text-secondary)]">
                  Connected as{" "}
                  <span className="font-medium text-[var(--app-text-primary)]">
                    {googleQ.data.google_account_email ?? "your Google account"}
                  </span>
                </p>
                <AppButton
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disconnectGmail.isPending}
                  onClick={() => disconnectGmail.mutate()}
                >
                  Disconnect Gmail
                </AppButton>
              </div>
            ) : (
              <AppButton
                type="button"
                variant="primary"
                disabled={startGoogleOAuth.isPending}
                onClick={() => startGoogleOAuth.mutate()}
              >
                {startGoogleOAuth.isPending ? "Redirecting…" : "Connect Gmail"}
              </AppButton>
            )}
            {startGoogleOAuth.isError ? (
              <p className="text-[13px] text-[var(--app-badge-red-fg)]">
                {startGoogleOAuth.error instanceof Error ? startGoogleOAuth.error.message : "Could not start Google sign-in."}
              </p>
            ) : null}
          </div>

          <div className="space-y-4 rounded-[var(--app-radius-lg)] border border-[color-mix(in_srgb,var(--app-danger)_35%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-danger)_5%,var(--app-bg-elevated))] p-6">
            <div>
              <h2 className="text-[15px] font-semibold text-[var(--app-text-primary)]">Delete account</h2>
              <p className="mt-2 text-[13px] leading-6 text-[var(--app-text-secondary)]">
                Permanently delete your profile, résumé files, applications, drafts, milestones, check-ins, and Copilot history.
                This also attempts to remove your Clerk sign-in account.
              </p>
            </div>
            <label className="block text-[12px] font-medium text-[var(--app-text-secondary)]">
              Type DELETE to confirm
              <input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                className="mt-1 w-full rounded-md border border-[var(--app-border)] bg-[var(--app-bg-page)] px-3 py-2 text-[13px] text-[var(--app-text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-danger)]"
              />
            </label>
            <AppButton
              type="button"
              variant="danger"
              disabled={deleteConfirm !== "DELETE" || deleteAccount.isPending}
              onClick={() => deleteAccount.mutate()}
            >
              {deleteAccount.isPending ? "Deleting…" : "Delete my account"}
            </AppButton>
            {deleteAccount.isError ? (
              <p className="text-[13px] text-[var(--app-badge-red-fg)]">
                {deleteAccount.error instanceof Error ? deleteAccount.error.message : "Account deletion failed."}
              </p>
            ) : null}
          </div>
        </div>
      )}
    </ProductPageChrome>
  );
}
