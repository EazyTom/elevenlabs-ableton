/**
 * Create a GitHub Release with the packaged .ablx artifact.
 *
 * Intended for CI on tag push. Requires:
 *   GITHUB_TOKEN       — repo token with contents:write
 *   GITHUB_REPOSITORY  — owner/repo (set automatically in GHA)
 *   GITHUB_REF_NAME    — tag name, e.g. v0.6.0 (set automatically in GHA)
 *
 * Usage: npm run publish
 */
import { execSync } from "child_process";
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import { EXTENSION_VERSION } from "../src/version.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const GITHUB_API = "https://api.github.com";

function die(message: string): never {
  console.error(`publish-release: ${message}`);
  process.exit(1);
}

function parseTagVersion(tag: string): string {
  const version = tag.startsWith("v") ? tag.slice(1) : tag;
  if (!/^\d+\.\d+\.\d+/.test(version)) {
    die(`invalid tag "${tag}" — expected semver like v0.6.0`);
  }
  return version;
}

function versionAnchor(version: string): string {
  const [major, minor, patch] = version.split(".");
  return `v${major}${minor}${patch}`;
}

async function readPackageVersion(): Promise<string> {
  const pkg = JSON.parse(await readFile(path.join(ROOT, "package.json"), "utf8")) as {
    version: string;
  };
  return pkg.version;
}

function extractChangelogSection(changelog: string, version: string): string | null {
  const header = `## [${version}]`;
  const start = changelog.indexOf(header);
  if (start === -1) return null;

  const afterHeader = changelog.indexOf("\n", start);
  const bodyStart = afterHeader === -1 ? start + header.length : afterHeader + 1;
  const nextSection = changelog.indexOf("\n## [", bodyStart);
  const section = changelog.slice(bodyStart, nextSection === -1 ? undefined : nextSection).trim();
  return section || null;
}

async function githubRequest(
  token: string,
  method: string,
  urlPath: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  const response = await fetch(`${GITHUB_API}${urlPath}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return response;
}

async function createRelease(
  token: string,
  owner: string,
  repo: string,
  tag: string,
  version: string,
  body: string,
): Promise<number> {
  const response = await githubRequest(token, "POST", `/repos/${owner}/${repo}/releases`, {
    tag_name: tag,
    name: `v${version}`,
    body,
    draft: false,
    prerelease: false,
  });

  if (!response.ok) {
    const detail = await response.text();
    die(`failed to create release (${response.status}): ${detail}`);
  }

  const release = (await response.json()) as { id: number; html_url: string };
  console.log(`Created release: ${release.html_url}`);
  return release.id;
}

async function uploadAsset(
  token: string,
  owner: string,
  repo: string,
  releaseId: number,
  filePath: string,
  fileName: string,
): Promise<void> {
  const data = await readFile(filePath);
  const uploadResponse = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/releases/${releaseId}/assets?name=${encodeURIComponent(fileName)}`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/octet-stream",
        "Content-Length": String(data.length),
      },
      body: data,
    },
  );

  if (!uploadResponse.ok) {
    const detail = await uploadResponse.text();
    die(`failed to upload asset (${uploadResponse.status}): ${detail}`);
  }

  const asset = (await uploadResponse.json()) as { browser_download_url: string };
  console.log(`Uploaded asset: ${asset.browser_download_url}`);
}

async function main(): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  const tag = process.env.GITHUB_REF_NAME;

  if (!token) die("GITHUB_TOKEN is required");
  if (!repository) die("GITHUB_REPOSITORY is required");
  if (!tag) die("GITHUB_REF_NAME is required (run from a tag push in CI)");

  const [owner, repo] = repository.split("/");
  if (!owner || !repo) die(`invalid GITHUB_REPOSITORY "${repository}"`);

  const tagVersion = parseTagVersion(tag);
  const packageVersion = await readPackageVersion();

  if (tagVersion !== EXTENSION_VERSION) {
    die(
      `tag v${tagVersion} does not match EXTENSION_VERSION (${EXTENSION_VERSION}) in src/version.ts`,
    );
  }
  if (tagVersion !== packageVersion) {
    die(`tag v${tagVersion} does not match package.json version (${packageVersion})`);
  }

  console.log(`Publishing elevenlabs-ableton v${tagVersion} (${tag})…`);
  execSync("npm run package", { cwd: ROOT, stdio: "inherit" });

  const artifactName = `elevenlabs-ableton-${tagVersion}.ablx`;
  const artifactPath = path.join(ROOT, artifactName);

  const changelog = await readFile(path.join(ROOT, "CHANGELOG.md"), "utf8");
  const section = extractChangelogSection(changelog, tagVersion);
  const releaseBody =
    section ??
    `Release v${tagVersion}. See [CHANGELOG.md#${versionAnchor(tagVersion)}](CHANGELOG.md#${versionAnchor(tagVersion)}).`;

  const releaseId = await createRelease(token, owner, repo, tag, tagVersion, releaseBody);
  await uploadAsset(token, owner, repo, releaseId, artifactPath, artifactName);

  console.log("Publish complete.");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
