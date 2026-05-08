import styles from "./About.module.css";

export default function About() {
  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <div className={styles.left}>
          <div className={styles.tag}>{"// The Problem //"}</div>
          <h2 className={styles.heading}>
            Job search is{" "}
            <span className={styles.accent}>
              fragmented across
              <br />
              6–10 tools
            </span>
          </h2>
          <p className={styles.body}>
            Candidates repeat data entry, lose track of applications, and waste time on generic
            outreach. “AI apply” products that auto-submit erode trust and can harm reputations.
            Doubow treats job search as a project: structured, measurable, and AI-assisted—without
            removing human judgment from any consequential action.
          </p>
          <a href="#features" className={styles.btn}>
            See the Workflow
          </a>
        </div>

        <div className={styles.right}>
          <div className={styles.statCard}>
            <div className={styles.statNum}>
              6–10 <span>Tools</span>
            </div>
            <p>
              Most candidates juggle job boards, résumé docs, email, LinkedIn, and spreadsheets.
            </p>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statNum}>
              403 <span>Guardrail</span>
            </div>
            <p>
              The submit endpoint returns 403 unless the application is APPROVED in the database.
            </p>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statNum}>
              1 <span>Workspace</span>
            </div>
            <p>
              Discovery, scoring, drafting, approvals, tracking, and prep share the same system state.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

