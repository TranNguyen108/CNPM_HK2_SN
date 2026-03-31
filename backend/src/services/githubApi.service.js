const CryptoJS = require('crypto-js');

const getAesKey = () => {
  if (!process.env.AES_KEY) {
    throw new Error('AES_KEY is required');
  }

  return process.env.AES_KEY;
};

class GitHubApiService {
  constructor(config) {
    const token = CryptoJS.AES.decrypt(config.access_token_encrypted, getAesKey()).toString(CryptoJS.enc.Utf8);

    this.octokitPromise = GitHubApiService.createOctokit(token);
  }

  static async createOctokit(token) {
    const { Octokit } = await import('@octokit/rest');
    return new Octokit({
      auth: token,
      userAgent: 'SWP391-App'
    });
  }

  async getClient() {
    return this.octokitPromise;
  }

  async getRepo(owner, repo) {
    const octokit = await this.getClient();
    const response = await octokit.repos.get({ owner, repo });
    return response.data;
  }

  async getContributors(owner, repo) {
    const octokit = await this.getClient();
    const response = await octokit.repos.listContributors({
      owner,
      repo,
      per_page: 100
    });

    return response.data || [];
  }

  async listCommits(owner, repo, options = {}) {
    const octokit = await this.getClient();
    const response = await octokit.repos.listCommits({
      owner,
      repo,
      per_page: options.per_page || 100,
      page: options.page || 1,
      since: options.since,
      until: options.until
    });

    return response.data || [];
  }

  async getCommitDetail(owner, repo, sha) {
    const octokit = await this.getClient();
    const response = await octokit.repos.getCommit({ owner, repo, ref: sha });
    return response.data;
  }
}

module.exports = GitHubApiService;
