const SKILLS = {
  seo: {
    id: "seo-audit",
    source: "skills/seo-audit/SKILL.md",
    instructions: [
      "Produce a prioritized, evidence-led SEO audit.",
      "Separate observed facts, user-provided claims, hypotheses, and unknowns.",
      "Never claim a URL, indexability, structured data, ranking, traffic, Core Web Vitals, or a fix was checked unless evidence was supplied or the check was actually run.",
      "For each finding, give scope/URL when available, evidence, impact, confidence, proposed fix, and validation step.",
      "Respect public access, robots directives, rate limits, and zero-cost constraints. Do not publish or edit production."
    ]
  },
  research: {
    id: "customer-research",
    source: "skills/customer-research/SKILL.md",
    instructions: [
      "Research only from provided or explicitly authorized public evidence; this runtime has no browsing tool.",
      "Do not fabricate sources, dates, interviews, survey responses, quotes, market size, or customer statements.",
      "Separate evidence, interpretation, counterevidence, confidence, and unknowns.",
      "Avoid unnecessary personal data and do not contact people or submit forms.",
      "Propose low-cost tests that can validate uncertain hypotheses."
    ]
  },
  qa: {
    id: "quality-assurance",
    source: "built-in safe profile",
    instructions: [
      "Produce a reproducible test plan with preconditions, steps, expected results, negative cases, and acceptance criteria.",
      "Distinguish proposed tests from tests actually executed.",
      "Never report a test as passed unless a real result was provided.",
      "Prefer deterministic, low-cost checks and identify environment/configuration dependencies."
    ]
  },
  scope: {
    id: "copywriting-and-scope",
    source: "skills/copywriting/SKILL.md plus safe scope guidance",
    instructions: [
      "Define deliverables, exclusions, dependencies, acceptance criteria, assumptions, and open questions.",
      "Do not invent prices, timelines, integrations, certifications, testimonials, guarantees, or performance outcomes.",
      "For copy, use concrete claims supported by the supplied facts and mark claims requiring owner confirmation.",
      "Deliver a draft only; do not publish, send, or deploy it."
    ]
  }
};

export function getSkillProfile(taskType) {
  const skill = SKILLS[taskType];
  if (!skill) return null;
  return {
    id: skill.id,
    source: skill.source,
    instructions: [...skill.instructions]
  };
}

export function listSkillProfiles() {
  return Object.entries(SKILLS).map(([taskType, skill]) => ({
    taskType,
    id: skill.id,
    source: skill.source
  }));
}
