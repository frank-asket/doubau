import styles from "./Logos.module.css";

import { GoogleIcon } from "@/components/icons/GoogleIcon";
import {
  BrandAdobe,
  BrandMiro,
  BrandSpotify,
  BrandStripe,
} from "@/components/icons/BrandIcons";

const logos = [
  { name: "Miro", Icon: BrandMiro, color: "#050038" },
  { name: "Stripe", Icon: BrandStripe, color: "#635BFF" },
  { name: "Google", Icon: GoogleIcon, color: "#4285F4" },
  { name: "Adobe", Icon: BrandAdobe, color: "#FF0000" },
  { name: "Spotify", Icon: BrandSpotify, color: "#1DB954" },
];

export default function Logos() {
  return (
    <section className={styles.section}>
      <div className={styles.track}>
        {[...logos, ...logos].map((logo, i) => {
          const Icon = logo.Icon;
          return (
            <div key={`${logo.name}-${i}`} className={styles.logo} title={logo.name}>
              <Icon
                width={22}
                height={22}
                aria-hidden="true"
                style={{ color: logo.color, display: "block" }}
              />
              <span className={styles.logoText}>{logo.name}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

