"use client";

import styles from "./Features.module.css";
import { motion, useReducedMotion } from "framer-motion";
import { ChatIcon, CompassIcon, UsersIcon } from "@/components/icons/FeatureIcons";
import Image from "next/image";

const features = [
  {
    title: "Job Discovery",
    desc: "Create and publish curated listings with fit scoring grounded in your résumé.",
    color: "#2d5e35",
    light: false,
    Icon: CompassIcon,
  },
  {
    title: "Manage Candidates",
    desc: "Track, review, and organize candidates—full visibility across the pipeline.",
    color: "#f0f8f1",
    light: true,
    Icon: UsersIcon,
  },
  {
    title: "Chat With Applicants",
    desc: "Communicate quickly, keep context, and move candidates forward with confidence.",
    color: "#f6f6f4",
    light: true,
    Icon: ChatIcon,
  },
] as const;

export default function Features() {
  const reduceMotion = useReducedMotion();
  const people = [
    "/images/Job%20Seecker%20Photo.jpg",
    "/images/Job%20Seecker%20Photo%20(1).jpg",
    "/images/Job%20Seecker%20Photo%20(2).jpg",
    "/images/pexels%20rdne%207821494.jpg",
    "/images/Job%20Seecker%20Photo.jpg",
  ];

  return (
    <section id="features" className={styles.section}>
      <div className={styles.container}>
        <motion.div
          className={styles.tag}
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ type: "spring", duration: 0.55, bounce: 0 }}
        >
          {"// Our Features //"}
        </motion.div>
        <motion.h2
          className={styles.heading}
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ type: "spring", duration: 0.55, bounce: 0, delay: 0.05 }}
        >
          Streamline Your Workflow
          <br />
          From Start To Finish
        </motion.h2>

        <div className={styles.grid}>
          {features.map((f, i) => (
            <motion.div
              key={i}
              className={`${styles.card} ${!f.light ? styles.dark : ""}`}
              style={{ background: f.color }}
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{ type: "spring", duration: 0.55, bounce: 0, delay: i * 0.06 }}
            >
              <div className={styles.cardIcon} aria-hidden="true">
                <f.Icon width={22} height={22} />
              </div>
              <h3 className={styles.cardTitle}>{f.title}</h3>
              <p className={styles.cardDesc}>{f.desc}</p>

              {i === 0 ? (
                <div className={styles.mockShell} aria-hidden="true">
                  <div className={styles.jobCard}>
                    <div className={styles.jobBrand}>DouBow</div>
                    <div className={styles.jobRole}>Senior Product Manager</div>
                    <div className={styles.jobLines}>
                      <div />
                      <div />
                      <div />
                    </div>
                    <div className={styles.jobPills}>
                      <span>● Full-time</span>
                      <span>Senior</span>
                    </div>
                    <div className={styles.jobFooter}>
                      <span className={styles.jobSalary}>£25/month</span>
                      <span className={styles.jobCity}>Remote · UK</span>
                    </div>
                  </div>
                </div>
              ) : i === 1 ? (
                <div className={styles.mockShell} aria-hidden="true">
                  <div className={styles.candidateStack}>
                    <div className={styles.candidateCard}>
                        <Image
                          src={people[0]}
                          alt=""
                          width={34}
                          height={34}
                          className="rounded-full object-cover ring-1 ring-black/10"
                        />
                      <div className={styles.candidateMeta}>
                        <div className={styles.candidateName}>Maria Angelica M</div>
                        <div className={styles.candidateRole}>Product Designer</div>
                      </div>
                      <div className={styles.candidateScore}>78%</div>
                    </div>
                    <div className={`${styles.candidateCard} ${styles.candidateCardMuted}`}>
                        <Image
                          src={people[1]}
                          alt=""
                          width={34}
                          height={34}
                          className="rounded-full object-cover ring-1 ring-black/10"
                        />
                      <div className={styles.candidateMeta}>
                        <div className={styles.candidateName}>Marcus Alexandru</div>
                        <div className={styles.candidateRole}>Product Manager</div>
                      </div>
                      <div className={styles.candidateScore}>92%</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className={styles.mockShell} aria-hidden="true">
                  <div className={styles.chatArea}>
                    <div className={styles.chatBubble}>
                      Congrats! you have been accepted to the next stage
                      <span className={styles.chatTime}>13:00</span>
                    </div>
                    <div className={styles.faceGrid}>
                      <Image
                        src={people[2]}
                        alt=""
                        width={54}
                        height={54}
                        className={`${styles.faceThumb} rounded-full object-cover ring-1 ring-black/10`}
                      />
                      <Image
                        src={people[1]}
                        alt=""
                        width={54}
                        height={54}
                        className={`${styles.faceThumb} rounded-full object-cover ring-1 ring-black/10`}
                      />
                      <Image
                        src={people[4]}
                        alt=""
                        width={54}
                        height={54}
                        className={`${styles.faceThumb} rounded-full object-cover ring-1 ring-black/10`}
                      />
                      <Image
                        src={people[0]}
                        alt=""
                        width={54}
                        height={54}
                        className={`${styles.faceThumb} rounded-full object-cover ring-1 ring-black/10`}
                      />
                      <Image
                        src={people[3]}
                        alt=""
                        width={54}
                        height={54}
                        className={`${styles.faceThumb} rounded-full object-cover ring-1 ring-black/10`}
                      />
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

