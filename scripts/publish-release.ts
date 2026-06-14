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

interface GitHubRelease {
  id: number;
  tag_name: string;
  html_url: string;
  upload_url: string;
  assets_url: string;
}

interface GitHubReleaseAsset {
  id: number;
  name: string;
}

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

function resolveTag(): string {
  const manualTag = process.env.RELEASE_TAG?.trim();
  if (manualTag) return manualTag;

  const ref = process.env.GITHUB_REF;
  if (ref?.startsWith("refs/tags/")) {
    return ref.slice("refs/tags/".length);
  }
  const refName = process.env.GITHUB_REF_NAME;
  if (refName?.startsWith("v")) return refName;
  die("could not resolve release tag from RELEASE_TAG, GITHUB_REF, or GITHUB_REF_NAME");
}

function releaseUploadUrl(uploadUrlTemplate: string, fileName: string): string {
  const base = uploadUrlTemplate.replace(/\{[^}]*\}$/, "");
  return `${base}?name=${encodeURIComponent(fileName)}`;
}

async function getReleaseByTag(
  token: string,
  owner: string,
  repo: string,
  tag: string,
): Promise<GitHubRelease | null> {
  const response = await githubRequest(
    token,
    "GET",
    `/repos/${owner}/${repo}/releases/tags/${encodeURIComponent(tag)}`,
  );
  if (response.status === 404) return null;
  if (!response.ok) {
    const detail = await response.text();
    die(`failed to fetch release for tag ${tag} (${response.status}): ${detail}`);
  }
  return (await response.json()) as GitHubRelease;
}

async function listReleases(
  token: string,
  owner: string,
  repo: string,
): Promise<GitHubRelease[]> {
  const releases: GitHubRelease[] = [];
  for (let page = 1; page <= 10; page++) {
    const response = await githubRequest(
      token,
      "GET",
      `/repos/${owner}/${repo}/releases?per_page=100&page=${page}`,
    );
    if (!response.ok) {
      const detail = await response.text();
      die(`failed to list releases (${response.status}): ${detail}`);
    }
    const batch = (await response.json()) as GitHubRelease[];
    releases.push(...batch);
    if (batch.length < 100) break;
  }
  return releases;
}

async function findReleaseByTag(
  token: string,
  owner: string,
  repo: string,
  tag: string,
): Promise<GitHubRelease | null> {
  const direct = await getReleaseByTag(token, owner, repo, tag);
  if (direct) return direct;

  const releases = await listReleases(token, owner, repo);
  return releases.find((release) => release.tag_name === tag) ?? null;
}

async function ensureRelease(
  token: string,
  owner: string,
  repo: string,
  tag: string,
  version: string,
  body: string,
): Promise<GitHubRelease> {
  const existing = await findReleaseByTag(token, owner, repo, tag);
  if (existing) {
    console.log(`Using existing release: ${existing.html_url}`);
    return existing;
  }

  const response = await githubRequest(token, "POST", `/repos/${owner}/${repo}/releases`, {
    tag_name: tag,
    name: `v${version}`,
    body,
    draft: false,
    prerelease: false,
  });

  if (response.status === 422) {
    const retry = await findReleaseByTag(token, owner, repo, tag);
    if (retry) {
      console.log(`Release already exists: ${retry.html_url}`);
      return retry;
    }
  }

  if (!response.ok) {
    const detail = await response.text();
    die(`failed to create release (${response.status}): ${detail}`);
  }

  const release = (await response.json()) as GitHubRelease;
  console.log(`Created release: ${release.html_url}`);
  return release;
}

async function deleteReleaseAsset(
  token: string,
  owner: string,
  repo: string,
  assetId: number,
): Promise<void> {
  const response = await githubRequest(
    token,
    "DELETE",
    `/repos/${owner}/${repo}/releases/assets/${assetId}`,
  );
  if (!response.ok && response.status !== 404) {
    const detail = await response.text();
    die(`failed to delete existing asset (${response.status}): ${detail}`);
  }
}

async function deleteAssetByName(
  token: string,
  owner: string,
  repo: string,
  assetsUrl: string,
  fileName: string,
): Promise<void> {
  const response = await fetch(assetsUrl, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    die(`failed to list release assets (${response.status}): ${detail}`);
  }

  const assets = (await response.json()) as GitHubReleaseAsset[];
  const existing = assets.find((asset) => asset.name === fileName);
  if (existing) {
    console.log(`Removing existing asset ${fileName} before re-upload…`);
    await deleteReleaseAsset(token, owner, repo, existing.id);
  }
}

async function uploadAsset(
  token: string,
  owner: string,
  repo: string,
  release: GitHubRelease,
  filePath: string,
  fileName: string,
): Promise<void> {
  const data = await readFile(filePath);
  const uploadUrl = releaseUploadUrl(release.upload_url, fileName);
  console.log(`Uploading ${fileName} (${data.length} bytes)…`);

  const uploadOnce = async (): Promise<Response> =>
    fetch(uploadUrl, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/octet-stream",
        "Content-Length": String(data.length),
      },
      body: data,
    });

  let uploadResponse = await uploadOnce();

  if (uploadResponse.status === 422) {
    await deleteAssetByName(token, owner, repo, release.assets_url, fileName);
    uploadResponse = await uploadOnce();
  }

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
  const tag = resolveTag();

  if (!token) die("GITHUB_TOKEN is required");
  if (!repository) die("GITHUB_REPOSITORY is required");

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

  const release = await ensureRelease(token, owner, repo, tag, tagVersion, releaseBody);
  await uploadAsset(token, owner, repo, release, artifactPath, artifactName);

  console.log("Publish complete.");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
