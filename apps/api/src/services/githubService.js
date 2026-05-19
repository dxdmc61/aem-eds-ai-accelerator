import { Octokit } from '@octokit/rest';

export function createGithubService({ token }) {
  const octokit = new Octokit({ auth: token });

  return {
    async createPullRequestPlaceholder() {
      // TODO:
      // 1. Create branch
      // 2. Write generated files using Git Data API
      // 3. Create commit
      // 4. Open pull request
      // 5. Return PR URL
      return { status: 'not_implemented' };
    },
    octokit
  };
}
