import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { verifyInstall } from "./verify-install.mjs";
import { listTools } from "../../biaws-mcp/dist/src/mcp/tools/tools.js";
import { toolPolicies } from "../../biaws-mcp/dist/src/mcp/tools/toolPolicies.js";
export function catalogReadiness(manifest, evidence = {}, artifact = null) {
  const openai = manifest.extensions?.["com.openai"],
    listing = openai?.interface || {},
    errors = [],
    pending = [];
  const oneLine = (field, max) => {
    const value = listing[field];
    if (typeof value !== "string" || !value.trim() || value.length > max || /[\r\n\t]/u.test(value)) errors.push(field);
  };
  oneLine("displayName", 30);
  oneLine("shortDescription", 30);
  oneLine("developerName", 80);
  if (!listing.longDescription?.trim() || listing.longDescription.length > 4000) errors.push("longDescription");
  if (listing.category !== "Productivity") errors.push("category");
  const prompts = listing.defaultPrompt || [];
  if (
    !Array.isArray(prompts) ||
    prompts.length > 3 ||
    prompts.some((p) => typeof p !== "string" || !p.trim() || p.length > 128 || /[\r\n@]/u.test(p)) ||
    new Set(prompts.map((p) => p.normalize("NFKC").trim().replace(/\s+/gu, " "))).size !== prompts.length
  )
    errors.push("defaultPrompt");
  const cases = openai?.review?.test_cases || {};
  if (cases.positive?.length !== 5 || cases.negative?.length !== 3) errors.push("five positive / three negative cases");
  const remoteNames = new Set(
    listTools()
      .filter((t) => !t.name.endsWith("_eml_file"))
      .map((t) => t.name),
  );
  for (const item of cases.positive || []) {
    if (
      !item.description?.trim() ||
      item.description.length > 4000 ||
      !item.prompt?.trim() ||
      !item.tools_triggered?.trim() ||
      !item.expected_behavior?.trim()
    )
      errors.push("positive case fields");
    for (const name of (item.tools_triggered || "").split(",").map((s) => s.trim()))
      if (!remoteNames.has(name)) errors.push("unknown tool " + name);
  }
  for (const item of cases.negative || [])
    if (!item.description?.trim() || !item.prompt?.trim() || !item.expected_behavior?.trim())
      errors.push("negative case fields");
  for (const field of ["websiteURL", "supportURL", "privacyPolicyURL", "termsOfServiceURL"]) {
    if (!listing[field]) {
      pending.push(field);
      continue;
    }
    try {
      const url = new URL(listing[field]);
      if (url.protocol !== "https:" || url.username || url.password || url.href.length > 1024) errors.push(field);
    } catch {
      errors.push(field);
    }
  }
  for (const field of [
    "publisherIdentityVerified",
    "domainVerified",
    "templateEligibilityConfirmed",
    "realChatgptValidationPassed",
    "skillsScanPassed",
    "toolsScanPassed",
    "legalUrlsReviewed",
    "reviewCasesExecuted",
  ])
    if (evidence[field] !== true) pending.push(field);
  for (const field of ["reviewEndpoint", "demoRecordingUrl"]) {
    try {
      const url = new URL(evidence[field]);
      if (url.protocol !== "https:" || url.username || url.password || url.hostname.endsWith(".invalid")) throw Error();
      if (
        field === "reviewEndpoint" &&
        (url.pathname !== "/mcp" ||
          url.search ||
          url.hash ||
          isIP(url.hostname.replace(/^\[|\]$/gu, "")) ||
          !url.hostname.includes(".") ||
          /\.(?:test|example|localhost)$/u.test(url.hostname))
      )
        throw Error();
    } catch {
      pending.push(field);
    }
  }
  if (evidence.pluginVersion !== manifest.version) pending.push("pluginVersion");
  const manifestSha256 = createHash("sha256").update(JSON.stringify(manifest)).digest("hex");
  if (
    !artifact ||
    artifact.version !== manifest.version ||
    artifact.manifestSha256 !== manifestSha256 ||
    !/^[a-f0-9]{64}$/u.test(evidence.artifactSha256 || "") ||
    artifact.sha256 !== evidence.artifactSha256 ||
    artifact.endpoint !== evidence.reviewEndpoint
  )
    pending.push("verifiedArtifact");
  return {
    metadataValid: errors.length === 0,
    submissionReady: errors.length === 0 && pending.length === 0,
    errors,
    pending,
    positiveCases: cases.positive?.length || 0,
    negativeCases: cases.negative?.length || 0,
  };
}
export function toolJustifications() {
  return Object.fromEntries(
    listTools()
      .filter((tool) => !tool.name.endsWith("_eml_file"))
      .map((tool) => {
        const policy = toolPolicies[tool.name],
          a = policy.annotations;
        return [
          tool.name,
          {
            readOnlyHint: {
              value: a.readOnlyHint,
              justification: a.readOnlyHint
                ? "Only reads or evaluates existing data; no domain mutation."
                : policy.reason,
            },
            destructiveHint: {
              value: a.destructiveHint,
              justification: a.destructiveHint
                ? "May replace, remove or change existing state or active configuration."
                : "Preserves existing state, or adds records/evidence without replacing them.",
            },
            openWorldHint: {
              value: a.openWorldHint,
              justification: a.openWorldHint
                ? "Changes monitor configuration that can cause the executor to contact external targets."
                : "Operates inside BIAWS's bounded workspace data; does not execute deployment or send external messages.",
            },
          },
        ];
      }),
  );
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const manifest = JSON.parse(await readFile(new URL("../biaws/plugin.json", import.meta.url), "utf8"));
  const evidence = JSON.parse(await readFile(new URL("../catalog/readiness.json", import.meta.url), "utf8"));
  const archiveIndex = process.argv.indexOf("--archive");
  let artifact = null;
  if (archiveIndex !== -1) {
    const archive = process.argv[archiveIndex + 1];
    if (!archive || archive.startsWith("--")) throw new Error("--archive requires the reviewed ZIP path");
    const checksum = (await readFile(archive + ".sha256", "utf8")).trim().split(/\s+/u)[0];
    artifact = await verifyInstall(archive, checksum);
  }
  if (process.argv.includes("--write-justifications"))
    await writeFile(
      new URL("../catalog/tool-justifications.json", import.meta.url),
      JSON.stringify(toolJustifications(), null, 2) + "\n",
    );
  const result = catalogReadiness(manifest, evidence, artifact);
  console.log(JSON.stringify(result, null, 2));
  if (!result.metadataValid || (process.argv.includes("--require-ready") && !result.submissionReady))
    process.exitCode = 2;
}
