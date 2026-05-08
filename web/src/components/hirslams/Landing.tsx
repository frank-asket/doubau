import About from "./About";
import Features from "./Features";
import Footer from "./Footer";
import Hero from "./Hero";
import Integrations from "./Integrations";
import Logos from "./Logos";
import Navbar from "./Navbar";
import Pricing from "./Pricing";

export default function DouBowLanding() {
  return (
    <>
      <a href="#main" className="hirslamsSkip">
        Skip to content
      </a>
      <Navbar />
      <div id="top" />
      <main id="main">
        <Hero />
        <Logos />
        <About />
        <Features />
        <Integrations />
        <Pricing />
      </main>
      <Footer />
    </>
  );
}

