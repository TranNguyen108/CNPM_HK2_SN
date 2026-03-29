const axios = require('axios');
const CryptoJS = require('crypto-js');

const AES_KEY = process.env.AES_KEY || 'project_management_aes_secret_key!!';

class JiraApiService {
  constructor(config) {
    const token = CryptoJS.AES.decrypt(config.access_token_encrypted, AES_KEY).toString(CryptoJS.enc.Utf8);
    this.baseUrl = `https://${config.jira_domain}`;
    this.headers = {
      Authorization: `Basic ${Buffer.from(`admin:${token}`).toString('base64')}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    };
  }

  /**
   * Lấy danh sách projects: GET /rest/api/3/project
   */
  async fetchProjects() {
    const res = await axios.get(`${this.baseUrl}/rest/api/3/project`, {
      headers: this.headers
    });
    return res.data;
  }

  /**
   * Lấy issues theo project + JQL với pagination
   * GET /rest/api/3/search?jql=project=X
   */
  async fetchIssues(projectKey) {
    const allIssues = [];
    let startAt = 0;
    const maxResults = 50;

    while (true) {
      const res = await axios.get(`${this.baseUrl}/rest/api/3/search`, {
        headers: this.headers,
        params: {
          jql: `project=${projectKey} ORDER BY created ASC`,
          startAt,
          maxResults,
          fields: [
            'summary', 'description', 'issuetype', 'status', 'priority', 'assignee', 'parent',
            'customfield_10020', // Sprint
            'customfield_10016', // Story Points
            'customfield_10014', // Epic Link (common Jira Cloud)
            'customfield_10011', // Epic Name (common Jira Cloud)
            'story_points', 'duedate'
          ].join(',')
        }
      });

      const { issues, total } = res.data;
      allIssues.push(...issues);
      startAt += issues.length;

      if (startAt >= total || issues.length === 0) break;
    }

    return allIssues;
  }

  /**
   * Lấy danh sách boards của project
   */
  async fetchBoards(projectKey) {
    const res = await axios.get(`${this.baseUrl}/rest/agile/1.0/board`, {
      headers: this.headers,
      params: { projectKeyOrId: projectKey }
    });
    return res.data.values || [];
  }

  /**
   * Lấy sprints: GET /rest/agile/1.0/board/{boardId}/sprint
   */
  async fetchSprints(boardId) {
    const res = await axios.get(`${this.baseUrl}/rest/agile/1.0/board/${boardId}/sprint`, {
      headers: this.headers
    });
    return res.data.values || [];
  }

  /**
   * Lấy transitions khả dụng của issue
   */
  async fetchTransitions(issueKey) {
    const res = await axios.get(`${this.baseUrl}/rest/api/3/issue/${issueKey}/transitions`, {
      headers: this.headers
    });
    return res.data.transitions || [];
  }

  /**
   * Chuyển trạng thái issue sang targetStatus theo tên transition gần khớp nhất
   */
  async transitionIssueToStatus(issueKey, targetStatus) {
    const transitions = await this.fetchTransitions(issueKey);
    const normalize = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const wanted = normalize(targetStatus);

    const matched = transitions.find((transition) => normalize(transition.name) === wanted)
      || transitions.find((transition) => normalize(transition.to?.name) === wanted);

    if (!matched) {
      throw new Error(`Không tìm thấy Jira transition phù hợp cho trạng thái "${targetStatus}"`);
    }

    await axios.post(
      `${this.baseUrl}/rest/api/3/issue/${issueKey}/transitions`,
      { transition: { id: matched.id } },
      { headers: this.headers }
    );

    return matched;
  }
}

module.exports = JiraApiService;
