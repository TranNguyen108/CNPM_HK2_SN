const axios = require('axios');
const CryptoJS = require('crypto-js');

const AES_KEY = process.env.AES_KEY || 'project_management_aes_secret_key!!';

class GitHubApiService {
  constructor(config) {
    this.owner = config.repo_owner;
    this.repo = config.repo_name;
    const raw = config.access_token_encrypted
      ? CryptoJS.AES.decrypt(config.access_token_encrypted, AES_KEY).toString(CryptoJS.enc.Utf8)
      : null;
    this.token = raw && raw.length ? raw : null;
    this.baseUrl = 'https://api.github.com';

    // Octokit support
    this.octokitPromise = this.token ? GitHubApiService._createOctokit(this.token) : null;
  }

  static async _createOctokit(token) {
    const { Octokit } = await import('@octokit/rest');
    return new Octokit({ auth: token, userAgent: 'CNPM-App/1.0' });
  }

  async getClient() {
    return this.octokitPromise;
  }

  _headers() {
    const headers = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'CNPM-App/1.0',
    };
    if (this.token) headers.Authorization = `token ${this.token}`;
    return headers;
  }

  async fetchCommits({ since, until, per_page = 100, page = 1 } = {}) {
    const params = { per_page, page };
    if (since) params.since = since;
    if (until) params.until = until;

    const { data } = await axios.get(
      `${this.baseUrl}/repos/${this.owner}/${this.repo}/commits`,
      { headers: this._headers(), params, timeout: 15000 }
    );
    return data;
  }

  async fetchAllCommitsSince(days = 90) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    let all = [];
    let page = 1;

    while (true) {
      const batch = await this.fetchCommits({
        since: since.toISOString(),
        per_page: 100,
        page,
      });
      if (!batch || batch.length === 0) break;
      all = all.concat(batch);
      if (batch.length < 100) break;
      page++;
      if (page > 10) break;
    }

    return all;
  }

  async getRepo(owner, repo) {
    const octokit = await this.getClient();
    const response = await octokit.repos.get({ owner, repo });
    return response.data;
  }

  async getContributors(owner, repo) {
    const octokit = await this.getClient();
    const response = await octokit.repos.listContributors({ owner, repo, per_page: 100 });
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
