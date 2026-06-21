export const siteContent = {
  hero: {
    eyebrow: "Strategy & Operations · GTM Ops · Systems Builder",
    name: "Ben Xu",
    headline: "I turn messy operations into systems teams actually use.",
    subheadline:
      "From supply chain to GTM to startup BizOps, I find where work breaks down — then build the dashboards, workflows, and reporting systems that make it run cleaner.",
  },
  proof: [
    { value: "30+ hrs", label: "manual reporting removed" },
    { value: "5,000+", label: "creators sourced" },
    { value: "$30K", label: "inventory discrepancy identified" },
  ],
  work: [
    {
      company: "Marlo.Today",
      role: "Business Operations Associate",
      date: "Jan-Jun 2025",
      problem:
        "Campaign reporting, outreach status, customer feedback, and weekly updates lived across scattered docs and sheets.",
      built:
        "Consolidated 16+ docs/sheets into one reporting surface while supporting GTM execution across two product campaigns.",
      result:
        "Created clearer campaign visibility, a repeatable reporting cadence, and founder-facing product insights from 70+ customer calls.",
    },
    {
      company: "FreeWire Technologies",
      role: "Supply Chain Analyst Intern",
      date: "Jun-Sep 2023",
      problem:
        "Freight activity, ERP records, BOM readiness, and material shortages were hard to see across systems and vendors.",
      built:
        "Built a Power BI logistics dashboard using Flexport data, plus reconciliation workflows across freight, transfers, hazmat docs, and 3PL communication.",
      result:
        "Supported $70K NPI readiness and surfaced a $25K material shortage through inventory reconciliation.",
    },
  ],
  sections: [
    { id: "home", name: "Hero" },
    { id: "proof", name: "Proof" },
    { id: "work", name: "Selected Work" },
    { id: "about", name: "About" },
    { id: "contact", name: "Contact" },
  ],
} as const;
