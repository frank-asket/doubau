import styles from "./Pricing.module.css";
import Image from "next/image";

const plans = [
  {
    name: "Standard",
    price: "£15",
    period: "/Month",
    desc: "AI Career Copilot, smart profile optimization, and interview intelligence.",
    cta: "Start Standard",
    dark: false,
    features: [
      "AI Career Copilot (Quick Actions)",
      "Smart Profile Optimization",
      "Interview Intelligence",
      "Approval gate (HITL) enforced",
      "Job discovery + tracker",
    ],
  },
  {
    name: "Pro",
    price: "£25",
    period: "/Month",
    desc: "All Standard + expanded limits and usage for high-intent searchers.",
    cta: "Go Pro",
    dark: true,
    features: [
      "Everything in Standard",
      "Expanded limits and usage",
      "More drafts, scoring, and prep",
      "Faster throughput for workflows",
      "Priority support (as available)",
    ],
  },
  {
    name: "Ultimate",
    price: "£50",
    period: "/Month",
    desc: "All Pro + priority processing and advanced analytics.",
    cta: "Choose Ultimate",
    dark: false,
    features: [
      "Everything in Pro",
      "Priority processing",
      "Advanced analytics",
      "Best-effort queue priority",
      "Highest tier limits",
    ],
  },
];

export default function Pricing() {
  const miniPeople = [
    "/images/Job%20Seecker%20Photo.jpg",
    "/images/pexels%20rdne%207821494.jpg",
    "/images/Job%20Seecker%20Photo%20(1).jpg",
  ];

  return (
    <section id="pricing" className={styles.section}>
      <div className={styles.container}>
        <div className={styles.tag}>{"// Our Pricing //"}</div>
        <h2 className={styles.heading}>
          Pricing that matches
          <br />
          <span className={styles.accent}>throughput</span>
        </h2>

        <div className={styles.grid}>
          {plans.map((plan, i) => (
            <div key={i} className={`${styles.card} ${plan.dark ? styles.dark : ""}`}>
              <div className={styles.planBadge}>{plan.name}</div>
              <div className={styles.price}>
                {plan.price} <span>{plan.period}</span>
              </div>
              <p className={styles.desc}>{plan.desc}</p>
              <a
                href="#pricing"
                className={`${styles.btn} ${plan.dark ? styles.btnLight : styles.btnDark}`}
              >
                {plan.cta}
              </a>
              <ul className={styles.features}>
                {plan.features.map((f, j) => (
                  <li key={j}>
                    <span className={styles.check}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className={styles.cta}>
          <div className={styles.ctaLeft}>
            <h3>
              Ready to try it?
              <br />
              See the approval gate <span>in action</span>
            </h3>
            <p>
              Start onboarding in minutes, generate a draft, and verify that nothing can be submitted
              unless it’s explicitly approved.
            </p>
            <a href="#pricing" className={styles.ctaBtn}>
              Start Onboarding
            </a>
          </div>
          <div className={styles.ctaCards}>
            {["Maria Angelica M", "Robert Williamson", "Marcus Alexandru"].map((name, i) => (
              <div
                key={i}
                className={styles.miniCard}
                style={{ top: `${i * 24}px`, zIndex: 3 - i }}
              >
                <Image
                  src={miniPeople[i] ?? miniPeople[0]!}
                  alt=""
                  width={32}
                  height={32}
                  className={`${styles.miniAvatar} rounded-full object-cover`}
                />
                <div>
                  <div className={styles.miniName}>{name}</div>
                  <div className={styles.miniRole}>
                    {["Product Designer", "HR Manager", "Recruiter"][i]}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

