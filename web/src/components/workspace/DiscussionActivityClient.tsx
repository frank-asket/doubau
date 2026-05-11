"use client";

import { Tag } from "./CareerHeroMockSections";
import { ProductPageChrome } from "./ProductPageChrome";

const posts = [
  ["Annette Black", "Switching careers after 30 — is it worth it?", "Hey everyone. I'm curious how many of you have completely changed careers after turning 30 and how that worked out for you.", "12", "7 replies"],
  ["Guy Hawkins", "I've been thinking about this too", "I've got kids, mortgage, and it just feels irresponsible to start over.", "17", "2 replies"],
  ["Dianne Russell", "Totally get you", "I had two kids when I made the switch at 35. It took longer, but it's doable if you plan carefully.", "12", "0 replies"],
];

export function DiscussionActivityClient() {
  return (
    <ProductPageChrome title="Discussion Board">
      <div className="grid gap-4 xl:grid-cols-[2fr_1.25fr]">
        <main className="ch-panel overflow-hidden">
          {posts.map(([author, title, body, likes, replies], idx) => (
            <article key={`${author}-${title}`} className="border-b border-dashed border-[var(--app-border)] p-6 last:border-0">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="grid size-12 place-items-center rounded-full bg-[var(--app-blue-50)] text-[var(--app-accent)]">{author.slice(0, 1)}</span>
                  <h2 className="text-[18px] font-bold">{author}</h2>
                </div>
                <span className="text-[13px] text-[var(--app-text-secondary)]">1 day ago ⋮</span>
              </div>
              <h3 className="mt-6 font-bold">{title}</h3>
              <p className="mt-3 text-[16px] leading-6 text-[var(--app-text-primary)]">{body}</p>
              {idx === 0 ? (
                <div className="mt-6 grid gap-3 md:grid-cols-2">
                  <div className="h-56 rounded-xl bg-[linear-gradient(135deg,#f7dcc8,#ffffff_55%,#cbdcf4)]" />
                  <div className="h-56 rounded-xl bg-[linear-gradient(135deg,#f8f5ed,#dfe9f4_55%,#ffffff)]" />
                </div>
              ) : null}
              <div className="mt-6 flex flex-wrap gap-2"><Tag>#career-change</Tag><Tag>#life-decision</Tag></div>
              <div className="mt-5 flex items-center gap-5 border-t border-dashed border-[var(--app-border)] pt-5 text-[13px] font-semibold text-[var(--app-text-secondary)]">
                <span>👍 {likes}</span><span>◌ {replies}</span><button className="text-[var(--app-accent)]" type="button">Reply</button>
              </div>
            </article>
          ))}
        </main>
        <aside className="ch-panel p-6">
          <h2 className="text-[20px] font-bold">Similar Topics for Discussion</h2>
          <div className="mt-6 space-y-5">
            {posts.concat(posts).slice(0, 4).map(([author, title, body], idx) => (
              <article key={`${author}-${idx}`} className="ch-soft-card p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold">{author}</h3><span className="text-[13px] text-[var(--app-text-secondary)]">{idx + 10}h ⋮</span>
                </div>
                <p className="mt-4 text-[15px] leading-5">{title}<br />{body.slice(0, 86)}...</p>
                <div className="mt-4 flex gap-2"><Tag>#career-advice</Tag><Tag>#job-search</Tag></div>
              </article>
            ))}
          </div>
        </aside>
      </div>
    </ProductPageChrome>
  );
}
