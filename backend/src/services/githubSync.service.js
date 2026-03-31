const { GithubConfig } = require('../models/githubConfig.model');
const { CommitStat } = require('../models/commitStat.model');
const { SyncLog } = require('../models/syncLog.model');
const { Task } = require('../models/task.model');
const { User } = require('../models/user.model');
const GitHubApiService = require('./githubApi.service');

const PAGE_SIZE = 100;
const DETAIL_CONCURRENCY = 2;
const DETAIL_DELAY_MS = 150;
const TASK_KEY_PATTERN = /\[([A-Z]+-\d+)\]/;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const getPLimit = async () => (await import('p-limit')).default;

const normalizeEmail = (email) => String(email || '').trim().toLowerCase() || null;
const normalizeLogin = (login) => String(login || '').trim().toLowerCase() || null;

const extractTaskKey = (message) => {
  const matched = String(message || '').match(TASK_KEY_PATTERN);
  return matched ? matched[1].toUpperCase() : null;
};

const buildUserMaps = (users) => {
  const emailMap = new Map();
  const loginMap = new Map();

  users.forEach((user) => {
    const normalizedEmail = normalizeEmail(user.email);
    const normalizedLogin = normalizeLogin(user.github_username);

    if (normalizedEmail) emailMap.set(normalizedEmail, user);
    if (normalizedLogin) loginMap.set(normalizedLogin, user);
  });

  return { emailMap, loginMap };
};

const resolveGithubUser = ({ detail, emailMap, loginMap, contributorLogins }) => {
  const authorEmailCandidates = [
    detail.commit?.author?.email,
    detail.commit?.committer?.email,
    detail.author?.email,
    detail.committer?.email
  ]
    .map(normalizeEmail)
    .filter(Boolean);

  const githubLoginCandidates = [
    detail.author?.login,
    detail.committer?.login
  ]
    .map(normalizeLogin)
    .filter(Boolean);

  const matchedByEmail = authorEmailCandidates.find((email) => emailMap.has(email));
  if (matchedByEmail) {
    const user = emailMap.get(matchedByEmail);
    return {
      user,
      authorEmail: matchedByEmail,
      githubUsername: githubLoginCandidates.find((login) => contributorLogins.has(login))
        || normalizeLogin(detail.author?.login || detail.committer?.login)
    };
  }

  const matchedByLogin = githubLoginCandidates.find((login) => loginMap.has(login));
  if (matchedByLogin) {
    const user = loginMap.get(matchedByLogin);
    return {
      user,
      authorEmail: authorEmailCandidates[0] || null,
      githubUsername: matchedByLogin
    };
  }

  return {
    user: null,
    authorEmail: authorEmailCandidates[0] || null,
    githubUsername: githubLoginCandidates[0] || null
  };
};

const fetchAllCommits = async (github, owner, repo, since) => {
  const commits = [];
  let page = 1;

  while (true) {
    const batch = await github.listCommits(owner, repo, {
      since,
      page,
      per_page: PAGE_SIZE
    });

    if (!batch.length) break;
    commits.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    page += 1;
  }

  return commits;
};

const syncGroupGithub = async (groupId, options = {}) => {
  const config = await GithubConfig.findOne({
    where: { group_id: groupId, is_active: 1 }
  });
  if (!config) throw new Error('GitHub chưa được cấu hình cho nhóm này');

  const github = new GitHubApiService(config);
  const owner = config.repo_owner;
  const repo = config.repo_name;
  const since = options.since || config.last_synced_at?.toISOString();

  await github.getRepo(owner, repo);

  const [contributors, tasks, users, commits, pLimit] = await Promise.all([
    github.getContributors(owner, repo),
    Task.findAll({
      where: { group_id: groupId },
      attributes: ['id', 'jira_key']
    }),
    User.findAll({
      attributes: ['id', 'email', 'github_username']
    }),
    fetchAllCommits(github, owner, repo, since),
    getPLimit()
  ]);

  const contributorLogins = new Set(
    contributors
      .map((contributor) => normalizeLogin(contributor.login))
      .filter(Boolean)
  );

  const taskMap = new Map(
    tasks
      .filter((task) => String(task.jira_key || '').trim())
      .map((task) => [String(task.jira_key).trim().toUpperCase(), task])
  );
  const { emailMap, loginMap } = buildUserMaps(users);
  const limit = pLimit(DETAIL_CONCURRENCY);

  let newCount = 0;
  let updatedCount = 0;

  const detailJobs = commits.map((commit) => limit(async () => {
    await sleep(DETAIL_DELAY_MS);

    const detail = await github.getCommitDetail(owner, repo, commit.sha);
    const parsedTaskKey = extractTaskKey(detail.commit?.message);
    const matchedTask = parsedTaskKey ? taskMap.get(parsedTaskKey) || null : null;
    const resolvedGithubUser = resolveGithubUser({
      detail,
      emailMap,
      loginMap,
      contributorLogins
    });

    const payload = {
      group_id: groupId,
      user_id: resolvedGithubUser.user?.id || null,
      task_id: matchedTask?.id || null,
      task_key: parsedTaskKey,
      sha: detail.sha,
      message: detail.commit?.message || '',
      github_username: resolvedGithubUser.githubUsername,
      author_email: resolvedGithubUser.authorEmail,
      additions: Number(detail.stats?.additions) || 0,
      deletions: Number(detail.stats?.deletions) || 0,
      committed_at: detail.commit?.author?.date || detail.commit?.committer?.date || new Date()
    };

    const [record, created] = await CommitStat.findOrCreate({
      where: { group_id: groupId, sha: detail.sha },
      defaults: payload
    });

    if (created) {
      newCount += 1;
      return;
    }

    await record.update(payload);
    updatedCount += 1;
  }));

  await Promise.all(detailJobs);

  await config.update({ last_synced_at: new Date() });

  await SyncLog.create({
    group_id: groupId,
    sync_type: 'github',
    status: 'success',
    new_count: newCount,
    updated_count: updatedCount
  });

  return { newCount, updatedCount, total: commits.length };
};

module.exports = { syncGroupGithub };
