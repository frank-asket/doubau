"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";

import styles from "./Testimonials.module.css";

const testimonials = [
  {
    name: "Maria Angelica M",
    title: "Product Designer",
    img: "/images/Job%20Seecker%20Photo.jpg",
    quote:
      "It feels like having a structured process again. Drafts are fast, but I’m still in control of every decision.",
  },
  {
    name: "Marcus Alexandru",
    title: "Product Manager",
    img: "/images/Job%20Seecker%20Photo%20(1).jpg",
    quote:
      "The workflow is clear: discover, draft, approve. Nothing gets sent accidentally, and that peace of mind matters.",
  },
  {
    name: "Robert Williamson",
    title: "Head of HR",
    img: "/images/pexels%20rdne%207821494.jpg",
    quote:
      "The UI is premium and calm. It’s the first tool that keeps context without turning the process into noise.",
  },
] as const;

export default function Testimonials() {
  const reduceMotion = useReducedMotion();
  return (
    <section className={styles.section} aria-label="Testimonials">
      <div className={styles.container}>
        <motion.div
          className={styles.tag}
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ type: "spring", duration: 0.55, bounce: 0 }}
        >
          {"// Testimonials //"}
        </motion.div>
        <motion.h2
          className={styles.heading}
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ type: "spring", duration: 0.55, bounce: 0, delay: 0.05 }}
        >
          Proof from people
          <br />
          who care about <span className={styles.accent}>trust</span>
        </motion.h2>

        <div className={styles.grid}>
          {testimonials.map((t, i) => (
            <motion.figure
              key={t.name}
              className={styles.card}
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{ type: "spring", duration: 0.55, bounce: 0, delay: i * 0.06 }}
            >
              <blockquote className={styles.quote}>“{t.quote}”</blockquote>
              <figcaption className={styles.person}>
                <span className={styles.avatar} aria-hidden="true">
                  <Image
                    src={t.img}
                    alt=""
                    width={44}
                    height={44}
                    className={styles.avatarImg}
                  />
                </span>
                <span className={styles.meta}>
                  <span className={styles.name}>{t.name}</span>
                  <span className={styles.title}>{t.title}</span>
                </span>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}

