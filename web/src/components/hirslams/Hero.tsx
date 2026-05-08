"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

import styles from "./Hero.module.css";

const floatingCards = [
  {
    name: "Maria Angelica M",
    role: "Product Designer",
    flag: "🇧🇷",
    style: { top: "8%", left: "2%" },
  },
  {
    name: "Marcus Alexandru",
    role: "Product Manager",
    flag: "🇷🇴",
    style: { top: "8%", right: "2%" },
  },
  {
    name: "Vince Marcoran",
    role: "Talent Recruiter",
    flag: "🇮🇹",
    style: { bottom: "28%", left: "0%" },
  },
  {
    name: "Robert Williamson",
    role: "Head of HR",
    flag: "🇬🇧",
    style: { bottom: "28%", right: "0%" },
  },
];

type Offer = {
  label: string;
  title: string;
  subtitle: string;
  tags: [string, string];
  status: string;
  metric: string;
};

export default function Hero() {
  const reduceMotion = useReducedMotion();
  const offers: Offer[] = useMemo(
    () => [
      {
        label: "DouBow (Live)",
        title: "Senior Product Manager",
        subtitle: "Career Tools",
        tags: ["Job Discovery", "Approval Gate"],
        status: "● APPROVED required",
        metric: "p95 < 300ms",
      },
      {
        label: "DouBow (Live)",
        title: "Product Designer",
        subtitle: "Portfolio + ATS",
        tags: ["ATS Optimizer", "Cover Letters"],
        status: "● APPROVED required",
        metric: "Draft < 20s",
      },
      {
        label: "DouBow (Live)",
        title: "Data Analyst",
        subtitle: "Interview Prep",
        tags: ["Tracker", "Copilot"],
        status: "● APPROVED required",
        metric: "Edits logged",
      },
    ],
    [],
  );

  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (reduceMotion) return;
    const t = window.setInterval(() => setIdx((v) => (v + 1) % offers.length), 3200);
    return () => window.clearInterval(t);
  }, [offers.length, reduceMotion]);

  const offer = offers[idx] ?? offers[0]!;
  return (
    <section className={styles.hero}>
      <div className={styles.bgBlob1} />
      <div className={styles.bgBlob2} />

      <div className={styles.container}>
        <div className={styles.floating}>
          {floatingCards.map((c, i) => (
            <div
              key={i}
              className={styles.floatCard}
              style={c.style}
            >
              <div className={styles.avatar}>{c.name.charAt(0)}</div>
              <div>
                <div className={styles.cardName}>{c.name}</div>
                <div className={styles.cardRole}>{c.role}</div>
              </div>
              <span className={styles.flag}>{c.flag}</span>
            </div>
          ))}
        </div>

        <motion.div
          className={styles.content}
          initial={reduceMotion ? false : { opacity: 0, y: 10, filter: "blur(6px)" }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ type: "spring", duration: 0.55, bounce: 0 }}
        >
          <motion.h1
            className={styles.headline}
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ type: "spring", duration: 0.55, bounce: 0, delay: 0.05 }}
          >
            AI drafts.
            <br />
            You decide.
            <br />
            <span className={styles.highlight}>Nothing moves</span>
            <br />
            without you.
          </motion.h1>

          <motion.div
            className={styles.jobCardFloat}
            initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0.98 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", duration: 0.55, bounce: 0, delay: 0.12 }}
          >
            <div className={styles.jobCardLabel}>{offer.label}</div>

            <motion.div
              key={idx}
              initial={reduceMotion ? false : { opacity: 0, y: 6, filter: "blur(4px)" }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -6, filter: "blur(4px)" }}
              transition={{ type: "spring", duration: 0.4, bounce: 0 }}
            >
              <div className={styles.jobCardTitle}>
                {offer.title} — {offer.subtitle}
              </div>
              <div className={styles.jobTags}>
                <span>{offer.tags[0]}</span>
                <span>{offer.tags[1]}</span>
              </div>
              <div className={styles.jobMeta}>
                <span className={styles.jobStatus}>{offer.status}</span>
                <span className={styles.jobSalary}>{offer.metric}</span>
              </div>
            </motion.div>
          </motion.div>

          <motion.p
            className={styles.sub}
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ type: "spring", duration: 0.55, bounce: 0, delay: 0.18 }}
          >
            DouBow is a multi-agent job search workspace where AI does the preparation work,
            <br />
            and humans approve every outbound action—enforced at the API, not just the UI.
          </motion.p>

          <motion.div
            className={styles.ctas}
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ type: "spring", duration: 0.55, bounce: 0, delay: 0.24 }}
          >
            <Link href="/signup" className={styles.ctaPrimary}>
              Get Started
            </Link>
            <Link href="/features" className={styles.ctaSecondary}>
              <span className={styles.playIcon}>▶</span>
              See How It Works
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

