// Private APK distribution via GitHub Releases on our own private backend
// repo (not the public office-app/mobile source repo). The app never talks
// to GitHub directly — only this server does, using a token that never
// leaves the backend.

function getGithubConfig() {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_RELEASES_REPO_OWNER;
  const repo = process.env.GITHUB_RELEASES_REPO_NAME;

  if (!token || !owner || !repo) {
    throw new Error(
      "Missing GitHub Releases config. Please set GITHUB_TOKEN, GITHUB_RELEASES_REPO_OWNER and GITHUB_RELEASES_REPO_NAME in your environment.",
    );
  }

  return { token, owner, repo };
}

const API_VERSION_HEADERS = {
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "fcp-timesheet-app",
};

/**
 * Fetches a release asset's raw content from GitHub as a streaming
 * `Response` — the caller pipes `.body` straight through to its own
 * response rather than buffering it. GitHub either streams the asset
 * directly or 302-redirects to its content; `fetch` follows that
 * redirect itself, so by the time this resolves it's always the final
 * binary response.
 */
export async function fetchGithubReleaseAsset(assetId: number): Promise<Response> {
  const { token, owner, repo } = getGithubConfig();

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/releases/assets/${assetId}`,
    {
      headers: {
        ...API_VERSION_HEADERS,
        Authorization: `Bearer ${token}`,
        Accept: "application/octet-stream",
      },
      redirect: "follow",
    },
  );

  return res;
}

export type GithubReleaseAssetOption = {
  id: number;
  name: string;
  sizeBytes: number;
  contentType: string;
};

export type GithubReleaseOption = {
  releaseId: number;
  tagName: string;
  name: string | null;
  publishedAt: string | null;
  assets: GithubReleaseAssetOption[];
};

/**
 * Lists releases + their assets from the configured GitHub repo, for the
 * admin "pick the APK you already uploaded to GitHub" dropdown — avoids
 * the admin having to hand-type a numeric asset id.
 */
export async function listGithubReleases(): Promise<GithubReleaseOption[]> {
  const { token, owner, repo } = getGithubConfig();

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/releases?per_page=30`,
    {
      headers: {
        ...API_VERSION_HEADERS,
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    },
  );

  if (!res.ok) {
    throw new Error(`GitHub API error listing releases (${res.status})`);
  }

  const releases = (await res.json()) as Array<{
    id: number;
    tag_name: string;
    name: string | null;
    published_at: string | null;
    assets: Array<{
      id: number;
      name: string;
      size: number;
      content_type: string;
    }>;
  }>;

  return releases.map((r) => ({
    releaseId: r.id,
    tagName: r.tag_name,
    name: r.name,
    publishedAt: r.published_at,
    assets: r.assets.map((a) => ({
      id: a.id,
      name: a.name,
      sizeBytes: a.size,
      contentType: a.content_type,
    })),
  }));
}
