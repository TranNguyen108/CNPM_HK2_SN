const axios = require('axios');
const CryptoJS = require('crypto-js');

const getAesKey = () => {
  if (!process.env.AES_KEY) {
    throw new Error('AES_KEY is required');
  }

  return process.env.AES_KEY;
};

class JiraApiService {
  constructor(config) {
    const token = CryptoJS.AES.decrypt(config.access_token_encrypted, getAesKey()).toString(CryptoJS.enc.Utf8);
    const jiraEmail = String(config.jira_email || '').trim();

    if (!jiraEmail) {
      throw new Error('Jira email is required');
    }

    this.baseUrl = `https://${config.jira_domain}`;
    this.headers = {
      Authorization: `Basic ${Buffer.from(`${jiraEmail}:${token}`).toString('base64')}`,
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
   * Jira Cloud mới dùng /rest/api/3/search/jql thay cho endpoint cũ /search
   */
  async fetchIssues(projectKey) {
    const allIssues = [];
    const maxResults = 50;
    let nextPageToken = null;
    let isLast = false;
    const fields = [
      'summary', 'description', 'issuetype', 'status', 'priority', 'assignee', 'parent',
      'customfield_10020', // Sprint
      'customfield_10016', // Story Points
      'customfield_10014', // Epic Link (common Jira Cloud)
      'customfield_10011', // Epic Name (common Jira Cloud)
      'story_points', 'duedate'
    ];

    while (!isLast) {
      const res = await axios.post(`${this.baseUrl}/rest/api/3/search/jql`, {
        jql: `project=${projectKey} ORDER BY created ASC`,
        maxResults,
        fields,
        fieldsByKeys: false,
        nextPageToken: nextPageToken || undefined
      }, {
        headers: this.headers,
      });

      const issues = Array.isArray(res.data?.issues) ? res.data.issues : [];
      allIssues.push(...issues);
      nextPageToken = res.data?.nextPageToken || null;
      isLast = Boolean(res.data?.isLast) || !nextPageToken;

      if (!issues.length && !nextPageToken) {
        break;
      }
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
