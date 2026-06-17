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
  proofDetails: string[];
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
      "From supply chain to GTM to startup BizOps, I find where work breaks down — then build the dashboards, workflows, and reporting systems that make it run cleaner.",
    primaryCta: "View work",
    secondaryCta: "Contact",
    signalWords: [
      "scattered data",
      "manual reporting",
      "unclear ownership",
      "GTM handoffs",
      "reporting gaps",
      "clear system",
    ],
  },
  proofMetrics: [
    { value: "30+", label: "hours manual reporting removed" },
    { value: "5,000+", label: "creators sourced" },
    { value: "$30K", label: "inventory discrepancy identified" },
  ],
  caseStudies: [
    {
      company: "Marlo.Today",
      role: "Business Operations Associate",
      period: "Jan–Jun 2025",
      theme: "GTM reporting system",
      problem:
        "Creator campaign operations were fragmented across spreadsheets, notes, outreach tools, and weekly reporting.",
      built:
        "Built a centralized reporting workflow for sourcing, outreach status, partnerships, assets, spend, notes, and client updates.",
      impact:
        "Reduced manual reporting drag and gave the team a cleaner weekly operating view.",
      proofDetails: [
        "5,000+ creators sourced",
        "2,000+ leads sequenced",
        "30+ hours removed",
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
        "Logistics and inventory data lived across Flexport, internal records, spreadsheets, and NetSuite.",
      built:
        "Built a Power BI logistics dashboard, supported freight/RMAs/transfers, and escalated inventory discrepancies.",
      impact:
        "Improved logistics visibility and identified approximately $30K in missing inventory.",
      proofDetails: [
        "$30K discrepancy identified",
        "Power BI logistics visibility",
        "Multi-vendor operations",
      ],
      logoSrc: "/freewire-logo.svg",
      logoAlt: "FreeWire Technologies logo",
      website: "https://www.freewiretech.com/",
    },
  ],
  about: {
    eyebrow: "Profile",
    headline: "Operations from the floor.",
    headlineAccent: "Systems for the team.",
    quote: "I have seen operations from the floor, the warehouse, the spreadsheet, and the startup dashboard.",
    paragraphs: [
      "I look for repeated manual work, unclear ownership, scattered information, and reporting gaps — then turn them into systems people can actually maintain.",
    ],
    facts: [
      { label: "Education", value: "UC San Diego · Rady School of Management" },
      { label: "Degree", value: "B.S. Business Economics · Jun 2023" },
      { label: "Based in", value: "San Francisco, CA" },
      { label: "Focus", value: "Strategy & Ops · BizOps · GTM Ops" },
    ],
    originStory:
      "I started in operations before I knew what to call it. Service work and my family’s blue-collar business taught me how quickly work breaks when ownership, sequencing, and visibility are unclear.",
  },
  experience: {
    eyebrow: "Selected Work",
    title: "Two operating systems for messy work.",
    foundationTitle: "Operational foundation",
    foundationText:
      "Before dashboards and GTM systems, I learned operations on the floor — through service work and my family’s blue-collar business. Missed handoffs, unclear ownership, vendor coordination, scheduling pressure, and customer expectations were not abstract problems. They showed up immediately. That is the foundation behind how I think about systems now.",
  },
  contact: {
    eyebrow: "Contact",
    title: "Let’s talk.",
    body:
      "I’m open to Strategy & Operations, GTM Ops, BizOps, and systems-building roles where the operating system still needs to be built.",
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
