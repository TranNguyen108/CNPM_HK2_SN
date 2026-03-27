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
  }

  _headers() {
    const headers = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'CNPM-App/1.0',
    };
    if (this.token) headers.Authorization = `token ${this.token}`;
    return headers;
  }

  /**
   * Fetch a single page of commits
   * @param {object} opts
   * @param {string} [opts.since]    ISO date string
   * @param {string} [opts.until]    ISO date string
   * @param {number} [opts.per_page] default 100
   * @param {number} [opts.page]     default 1
   */
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

  /**
   * Fetch all commits since N days ago (auto-paginate, max 1000)
   * @param {number} days
   */
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
      if (page > 10) break; // safety: cap at 1 000 commits
    }

    return all;
  }
}

module.exports = GitHubApiService;
