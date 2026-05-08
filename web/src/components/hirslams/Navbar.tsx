"use client";

import Link from "next/link";
import { useState } from "react";

import { DouBowLogo } from "@/components/brand/DouBowLogo";
import styles from "./Navbar.module.css";

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className={styles.nav}>
      <div className={styles.inner}>
        <Link href="/" className={styles.logo}>
          <DouBowLogo variant="black" text="DouBow" size={26} />
        </Link>

        <ul className={`${styles.links} ${mobileOpen ? styles.open : ""}`}>
          <li>
            <Link href="/">Home</Link>
          </li>
          <li>
            <a href="#features">Features</a>
          </li>
          <li>
            <a href="#pricing">Pricing</a>
          </li>
          <li>
            <Link href="/">Blog</Link>
          </li>
          <li>
            <Link href="/">Testimonials</Link>
          </li>
        </ul>

        <Link href="/login" className={styles.loginBtn}>
          Log In
        </Link>

        <button
          className={styles.burger}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Menu"
        >
          <span />
          <span />
          <span />
        </button>
      </div>
    </nav>
  );
}

