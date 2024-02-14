/* global fetch */
import { currentUserToken } from 'lively.user';
export class GitHubAPIWrapper {
  static async remoteRepoInfos (repoOwner, repoName) {
    const token = currentUserToken();
    const res = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}`, {
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });
    return await res.json();
  }

  static async listGithubBranches (repoOwner, repoName) {
    const token = currentUserToken();
    const res = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/branches`, {
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });
    const branchData = await res.json();
    // TODO: If this is called with a non-existing repository bad things happen!
    return branchData.map(b => b.name);
  }
}
