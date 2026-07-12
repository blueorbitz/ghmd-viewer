/**
 * Parsed components from a GitHub folder URL.
 * Format: https://github.com/{owner}/{repo}/tree/{branch}/{path}
 */
export interface ParsedGitHubUrl {
  owner: string;
  repo: string;
  branch: string;
  path: string;
}

/**
 * A single item from the GitHub Contents API response.
 */
export interface GitHubContentItem {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size?: number;
  download_url?: string | null;
}

/**
 * Result of checking repository accessibility.
 */
export type RepoAccessResult =
  | { accessible: true; isPrivate: false }
  | { accessible: true; isPrivate: true }
  | { accessible: false; reason: 'not_found' | 'rate_limited' | 'network_error'; message: string };

/**
 * Full GitHub Contents API response model.
 * GET /repos/{owner}/{repo}/contents/{path}?ref={branch}
 */
export interface GitHubContentsResponse {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string | null;
  type: 'file' | 'dir' | 'symlink' | 'submodule';
  content?: string;
  encoding?: 'base64';
}
