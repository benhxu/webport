export type ProofMetric = {
  value: string;
  label: string;
};

export type CaseStudy = {
  company: string;
  role: string;
  period: string;
  theme: string;
  problem: string;
  built: string;
  impact: string;
  artifacts: string[];
  logoSrc: string;
  logoAlt: string;
  website: string;
};

export type Fact = {
  label: string;
  value: string;
};

export type SocialLink = {
  label: string;
  href: string;
  kind: "linkedin" | "github" | "email";
};

export type SiteContent = {
  hero: {
    name: string;
    roleLabel: string;
    headline: string;
    subheadline: string;
    primaryCta: string;
    secondaryCta: string;
    signalWords: string[];
  };
  proofMetrics: ProofMetric[];
  caseStudies: CaseStudy[];
  about: {
    eyebrow: string;
    headline: string;
    headlineAccent: string;
    quote: string;
    paragraphs: string[];
    facts: Fact[];
    originStory: string;
  };
  experience: {
    eyebrow: string;
    title: string;
    foundationTitle: string;
    foundationText: string;
  };
  contact: {
    eyebrow: string;
    title: string;
    body: string;
    fallbackEmail: string;
  };
  socialLinks: SocialLink[];
};

export const siteContent = {
  hero: {
    name: "Ben Xu",
    roleLabel: "Strategy & Operations · GTM Ops · Systems Builder",
    headline: "I turn messy operations into systems teams actually use.",
    subheadline:
      "From supply chain to GTM to startup BizOps, I find where work breaks down — then build the dashboards, workflows, SOPs, and tools that make it run cleaner.",
    primaryCta: "See the systems",
    secondaryCta: "Contact me",
    signalWords: [
      "scattered data",
      "manual reporting",
      "unclear ownership",
      "workflow debt",
      "GTM handoffs",
      "inventory variance",
      "stakeholder updates",
      "source of truth",
      "SOP rhythm",
      "dashboard signal",
      "creator pipeline",
      "clean operating view",
    ],
  },
  proofMetrics: [
    { value: "5,000+", label: "creators sourced" },
    { value: "2,000+", label: "qualified leads sequenced" },
    { value: "30%+", label: "outreach response rate" },
    { value: "30+", label: "hours of manual reporting removed" },
    { value: "$30K", label: "inventory discrepancy identified" },
  ],
  caseStudies: [
    {
      company: "Marlo.Today",
      role: "Business Operations Associate",
      period: "Jan–Jun 2025",
      theme: "GTM reporting system",
      problem:
        "Creator campaign operations were fragmented across spreadsheets, notes, weekly updates, outreach tools, and client-facing reporting needs.",
      built:
        "Built a centralized reporting workflow for creator sourcing, outreach status, active partnerships, live assets, spend tracking, notes, and weekly client updates.",
      impact:
        "Reduced manual reporting workload, created cleaner weekly visibility, and helped the team manage creator partnerships with less operational drag.",
      artifacts: [
        "Dashboard screenshot placeholder",
        "Workflow diagram placeholder",
        "Before/after reporting flow placeholder",
      ],
      logoSrc: "/marlo-logo.svg",
      logoAlt: "Marlo.Today logo",
      website: "https://www.marlo.today/",
    },
    {
      company: "FreeWire Technologies",
      role: "Supply Chain Analyst Intern",
      period: "Jun–Sep 2023",
      theme: "Supply chain visibility",
      problem:
        "Logistics and inventory data were spread across Flexport, internal records, spreadsheets, and NetSuite.",
      built:
        "Built a Power BI logistics dashboard, coordinated freight/RMAs/transfers, supported BOM and item master updates, and escalated inventory discrepancies.",
      impact:
        "Improved logistics visibility and identified approximately $30K in missing inventory through cross-checking physical count against NetSuite records.",
      artifacts: [
        "Power BI dashboard placeholder",
        "Shipment flow placeholder",
        "Inventory discrepancy story placeholder",
      ],
      logoSrc: "/freewire-logo.svg",
      logoAlt: "FreeWire Technologies logo",
      website: "https://www.freewiretech.com/",
    },
  ],
  about: {
    eyebrow: "02 — Profile",
    headline: "Built by uncertainty.",
    headlineAccent: "Driven by clarity.",
    quote: "I learned early how to navigate systems that didn’t come with clear instructions.",
    paragraphs: [
      "I moved to America when I was one and was raised in San Francisco. As a first-generation college student, I became comfortable figuring things out without a perfect map.",
      "That shows up in how I work now: I look for unclear handoffs, repeated manual work, and scattered information — then turn it into infrastructure teams can actually use.",
    ],
    facts: [
      { label: "Education", value: "UC San Diego · Rady School of Management" },
      { label: "Degree", value: "B.S. Business Economics · Jun 2023" },
      { label: "Based in", value: "San Francisco, CA" },
      { label: "Focus", value: "Strategy & Ops · BizOps · GTM Ops" },
    ],
    originStory:
      "I started in operations before I knew what to call it. Service work and my family’s blue-collar business taught me how quickly work breaks when ownership, sequencing, and visibility are unclear. Supply chain showed me the cost of bad data. Startup BizOps showed me how fast teams need lightweight systems before process debt takes over. I work in the gap between the spreadsheet and the system.",
  },
  experience: {
    eyebrow: "Systems I’ve Built",
    title: "Proof-first operating systems, not a traditional timeline.",
    foundationTitle: "Operational foundation",
    foundationText:
      "Before dashboards and GTM systems, I learned operations through service work and my family’s blue-collar business — where missed handoffs, unclear ownership, scheduling pressure, vendor coordination, and customer expectations show up immediately.",
  },
  contact: {
    eyebrow: "Contact",
    title: "Let’s talk.",
    body:
      "I’m open to BizOps, Strategy & Operations, GTM Ops, and systems-building roles where the work is ambiguous and the operating system still needs to be built.",
    fallbackEmail: "benwebportfolio@gmail.com",
  },
  socialLinks: [
    {
      label: "Open LinkedIn profile",
      href: "https://www.linkedin.com/in/benhxu2/",
      kind: "linkedin",
    },
    {
      label: "Open GitHub profile",
      href: "https://github.com/benhxu",
      kind: "github",
    },
    {
      label: "Email Ben Xu",
      href: "mailto:benwebportfolio@gmail.com?subject=Opportunity%20for%20Ben%20Xu",
      kind: "email",
    },
  ],
} as const satisfies SiteContent;
