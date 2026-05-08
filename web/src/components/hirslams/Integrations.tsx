"use client";

import { motion, useReducedMotion } from "framer-motion";

import styles from "./Integrations.module.css";

import { FacebookIcon } from "@/components/icons/FacebookIcon";
import { GoogleIcon } from "@/components/icons/GoogleIcon";
import { LinkedInIcon } from "@/components/icons/LinkedInIcon";
import { BrandMicrosoft, BrandNotion, BrandSlack, BrandZoom } from "@/components/icons/BrandIcons";

const tools = [
  { name: "LinkedIn", brandColor: "#0A66C2", Icon: LinkedInIcon },
  { name: "Google", brandColor: "#4285F4", Icon: GoogleIcon },
  { name: "Facebook", brandColor: "#1877F2", Icon: FacebookIcon },
  { name: "Microsoft", brandColor: "#5E5E5E", Icon: BrandMicrosoft },
  { name: "Slack", brandColor: "#4A154B", Icon: BrandSlack },
  { name: "Notion", brandColor: "#111111", Icon: BrandNotion },
  { name: "Zoom", brandColor: "#0B5CFF", Icon: BrandZoom },
];

export default function Integrations() {
  const reduceMotion = useReducedMotion();
  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <div className={styles.orbitArea}>
          {tools.map((t, i) => {
            const angle = (i / tools.length) * 360;
            const rad = (angle * Math.PI) / 180;
            const r = 160;
            const x = 50 + (r / 3.6) * Math.cos(rad);
            const y = 50 + (r / 3.6) * Math.sin(rad);
            const Icon = t.Icon;
            const driftY = i % 2 === 0 ? -3 : 3;
            const drift =
              reduceMotion
                ? undefined
                : {
                    y: [0, driftY],
                  };

            return (
              <motion.div
                key={i}
                className={styles.orbitIcon}
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                }}
                title={t.name}
                initial={false}
                animate={drift}
                transition={
                  reduceMotion
                    ? undefined
                    : {
                        type: "spring",
                        duration: 3.6 + i * 0.15,
                        bounce: 0,
                        repeat: Infinity,
                        repeatType: "mirror",
                      }
                }
                whileHover={
                  reduceMotion
                    ? undefined
                    : {
                        scale: 1.12,
                        y: -2,
                        boxShadow: "0 24px 70px rgba(15, 17, 23, 0.18)",
                      }
                }
                whileTap={reduceMotion ? undefined : { scale: 0.96 }}
              >
                <Icon
                  width={22}
                  height={22}
                  style={{ color: t.brandColor }}
                  aria-hidden="true"
                />
              </motion.div>
            );
          })}
          <div className={styles.orbitCenter}>
            <span>⬡</span>
          </div>
        </div>

        <div className={styles.content}>
          <h2 className={styles.heading}>
            A tool suite that’s
            <br />
            <span className={styles.accent}>grounded</span> in your résumé
          </h2>
          <p className={styles.sub}>
            Copilot, ATS optimizer, LinkedIn analysis, cover letters, and prep—built on one system,
            <br />
            with every outbound action gated by approval.
          </p>
          <a href="#pricing" className={styles.btn}>
            Explore Pricing
          </a>
        </div>
      </div>
    </section>
  );
}

