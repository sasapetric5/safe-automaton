import test from "node:test";
import assert from "node:assert/strict";
import { getSkillProfile, listSkillProfiles } from "../functions/_lib/agent-skill-registry.mjs";

test("maps every supported task type to a task-specific safe skill", () => {
  for (const taskType of ["seo", "research", "qa", "scope"]) {
    const skill = getSkillProfile(taskType);
    assert.ok(skill, taskType);
    assert.ok(skill.id);
    assert.ok(skill.instructions.length >= 3);
  }
});

test("SEO skill explicitly prohibits unsupported verification claims", () => {
  const skill = getSkillProfile("seo");
  assert.match(skill.instructions.join(" "), /unless evidence was supplied/i);
  assert.match(skill.instructions.join(" "), /Do not publish/i);
});

test("unknown task types do not silently fall back to a different skill", () => {
  assert.equal(getSkillProfile("unknown"), null);
});

test("skill registry returns metadata only and no secrets", () => {
  const skills = listSkillProfiles();
  assert.equal(skills.length, 4);
  assert.doesNotMatch(JSON.stringify(skills), /api[_-]?key|token|secret/i);
});
