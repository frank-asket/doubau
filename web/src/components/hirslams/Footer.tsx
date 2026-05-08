import styles from "./Footer.module.css";
import { DouBowLogo } from "@/components/brand/DouBowLogo";

const nav = ["Home", "Features", "Pricing", "Security", "FAQ"];
const features = [
  "Career Copilot",
  "ATS Optimizer",
  "LinkedIn Analysis",
  "Cover Letter",
  "CV Builder",
];
const support = ["Security", "FAQ", "Privacy", "Terms"];

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.brand}>
          <div className={styles.logo}>
            <DouBowLogo variant="white" text="DouBow" size={26} />
          </div>
          <address className={styles.address}>
            AI drafts. You decide.
            <br />
            Nothing moves without you.
          </address>
          <div className={styles.newsletter}>
            <label className={styles.srOnly} htmlFor="hirslams-newsletter-email">
              Email
            </label>
            <input
              id="hirslams-newsletter-email"
              name="email"
              type="email"
              autoComplete="email"
              spellCheck={false}
              placeholder="Enter your email…"
              className={styles.input}
            />
            <button type="button" className={styles.subscribe}>
              Subscribe
            </button>
          </div>
        </div>

        <div className={styles.cols}>
          <div className={styles.col}>
            <h4>Navigation</h4>
            <ul>
              {nav.map((item) => (
                <li key={item}>
                  {item === "Home" ? (
                    <a href="#top">{item}</a>
                  ) : item === "Features" ? (
                    <a href="#features">{item}</a>
                  ) : item === "Pricing" ? (
                    <a href="#pricing">{item}</a>
                  ) : item === "Security" ? (
                    <a href="/security">{item}</a>
                  ) : (
                    <a href="/faq">{item}</a>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div className={styles.col}>
            <h4>Features</h4>
            <ul>
              {features.map((item) => (
                <li key={item}>
                  <a href="#features">{item}</a>
                </li>
              ))}
            </ul>
          </div>
          <div className={styles.col}>
            <h4>Support</h4>
            <ul>
              {support.map((item) => (
                <li key={item}>
                  {item === "Security" ? (
                    <a href="/security">{item}</a>
                  ) : item === "FAQ" ? (
                    <a href="/faq">{item}</a>
                  ) : (
                    <a href="#pricing">{item}</a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className={styles.bottom}>
        <p>© {new Date().getFullYear()} DouBow. No outbound action without approval.</p>
      </div>
    </footer>
  );
}

