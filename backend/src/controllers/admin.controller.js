const { Group } = require('../models/group.model');
const { GroupMember } = require('../models/groupMember.model');
const { User } = require('../models/user.model');
const { JiraConfig } = require('../models/jiraConfig.model');
const { GithubConfig } = require('../models/githubConfig.model');
const CryptoJS = require('crypto-js');
const axios = require('axios');
const { Op } = require('sequelize');

const getAesKey = () => {
  if (!process.env.AES_KEY) {
    throw new Error('AES_KEY is required');
  }

  return process.env.AES_KEY;
};
const encrypt = (text) => CryptoJS.AES.encrypt(text, getAesKey()).toString();
const decrypt = (cipher) => CryptoJS.AES.decrypt(cipher, getAesKey()).toString(CryptoJS.enc.Utf8);

// ===== DASHBOARD STATS =====
exports.getStats = async (req, res) => {
  try {
    const totalGroups = await Group.count();
    const totalLecturers = await User.count({ where: { role: 'LECTURER' } });
    const totalMembers = await GroupMember.count();
    const totalUsers = await User.count();
    res.json({ totalGroups, totalLecturers, totalMembers, totalUsers });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ===== SEARCH USERS =====
exports.searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    const where = {};
    if (q) {
      where[Op.or] = [
        { email: { [Op.like]: `%${q}%` } },
        { full_name: { [Op.like]: `%${q}%` } },
      ];
    }
    const users = await User.findAll({
      where,
      attributes: ['id', 'email', 'full_name', 'role', 'is_active'],
      limit: 50,
    });
    res.json(users);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ===== GROUPS =====
exports.getGroups = async (req, res) => {
  try {
    const groups = await Group.findAll();
    res.json(groups);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.createGroup = async (req, res) => {
  try {
    const { name, description, semester } = req.body;
    const group = await Group.create({ name, description, semester, created_by: req.user.id });
    res.status(201).json(group);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.updateGroup = async (req, res) => {
  try {
    const group = await Group.findByPk(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    await group.update(req.body);
    res.json(group);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.deleteGroup = async (req, res) => {
  try {
    const group = await Group.findByPk(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    await group.destroy();
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ===== MEMBERS =====
exports.getMembers = async (req, res) => {
  try {
    const members = await GroupMember.findAll({ where: { group_id: req.params.id } });
    res.json(members);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.addMember = async (req, res) => {
  try {
    const { user_id, role_in_group } = req.body;
    const existing = await GroupMember.findOne({ where: { group_id: req.params.id, user_id } });
    if (existing) return res.status(400).json({ message: 'User already in group' });
    const member = await GroupMember.create({ group_id: req.params.id, user_id, role_in_group });
    res.status(201).json(member);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.removeMember = async (req, res) => {
  try {
    await GroupMember.destroy({ where: { group_id: req.params.id, user_id: req.params.userId } });
    res.json({ message: 'Member removed' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ===== LECTURERS =====
exports.getLecturers = async (req, res) => {
  try {
    const lecturers = await User.findAll({
      where: { role: 'LECTURER' },
      attributes: { exclude: ['password_hash', 'refresh_token'] }
    });
    res.json(lecturers);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.createLecturer = async (req, res) => {
  try {
    const bcrypt = require('bcrypt');
    const { email, fullName, password, githubUsername } = req.body;
    const existing = await User.findOne({ where: { email } });
    if (existing) return res.status(400).json({ message: 'Email already exists' });
    const password_hash = await bcrypt.hash(password || '123456', 10);
    const lecturer = await User.create({
      email,
      full_name: fullName,
      password_hash,
      role: 'LECTURER',
      github_username: githubUsername || null
    });
    res.status(201).json({ message: 'Lecturer created', id: lecturer.id });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.updateLecturer = async (req, res) => {
  try {
    const user = await User.findOne({ where: { id: req.params.id, role: 'LECTURER' } });
    if (!user) return res.status(404).json({ message: 'Lecturer not found' });
    await user.update({
      full_name: req.body.fullName,
      email: req.body.email,
      github_username: req.body.githubUsername || null
    });
    res.json({ message: 'Updated successfully' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.updateUserGithubUsername = async (req, res) => {
  try {
    const { githubUsername } = req.body;
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    await user.update({ github_username: githubUsername || null });
    res.json({
      message: 'GitHub username updated',
      user: {
        id: user.id,
        email: user.email,
        github_username: user.github_username
      }
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.deleteLecturer = async (req, res) => {
  try {
    const user = await User.findOne({ where: { id: req.params.id, role: 'LECTURER' } });
    if (!user) return res.status(404).json({ message: 'Lecturer not found' });
    await user.destroy();
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.assignLecturer = async (req, res) => {
  try {
    const { lecturer_id } = req.body;
    const existing = await GroupMember.findOne({ where: { group_id: req.params.id, user_id: lecturer_id } });
    if (existing) return res.status(400).json({ message: 'Lecturer already assigned' });
    const member = await GroupMember.create({ group_id: req.params.id, user_id: lecturer_id, role_in_group: 'VIEWER' });
    res.status(201).json({ message: 'Lecturer assigned', member });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ===== JIRA CONFIG =====
exports.saveJiraConfig = async (req, res) => {
  try {
    const { jira_domain, jira_email, project_key, access_token } = req.body;
    if (!jira_domain || !jira_email || !project_key || !access_token)
      return res.status(400).json({ message: 'Missing required fields' });
    const encrypted = encrypt(access_token);
    await JiraConfig.upsert({
      group_id: req.params.id,
      jira_domain: String(jira_domain).trim(),
      jira_email: String(jira_email).trim(),
      project_key: String(project_key).trim(),
      access_token_encrypted: encrypted
    });
    res.json({ message: 'Jira config saved', status: 'configured' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.testJira = async (req, res) => {
  try {
    const config = await JiraConfig.findOne({ where: { group_id: req.params.id } });
    if (!config) return res.status(404).json({ success: false, message: 'Jira not configured' });
    const token = decrypt(config.access_token_encrypted);
    if (!config.jira_email) {
      return res.json({ success: false, message: 'Jira email is required' });
    }
    await axios.get(`https://${config.jira_domain}/rest/api/3/project/${config.project_key}`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.jira_email}:${token}`).toString('base64')}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      }
    });
    await config.update({ last_synced_at: new Date() });
    res.json({ success: true, message: 'Jira connection successful' });
  } catch (err) {
    res.json({ success: false, message: 'Jira connection failed: ' + (err.response?.data?.message || err.message) });
  }
};

// ===== GITHUB CONFIG =====
exports.saveGithubConfig = async (req, res) => {
  try {
    const { repo_owner, repo_name, access_token } = req.body;
    if (!repo_owner || !repo_name || !access_token)
      return res.status(400).json({ message: 'Missing required fields' });
    const encrypted = encrypt(access_token);
    await GithubConfig.upsert({ group_id: req.params.id, repo_owner, repo_name, access_token_encrypted: encrypted });
    res.json({ message: 'GitHub config saved', status: 'configured' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.testGithub = async (req, res) => {
  try {
    const config = await GithubConfig.findOne({ where: { group_id: req.params.id } });
    if (!config) return res.status(404).json({ success: false, message: 'GitHub not configured' });
    const token = decrypt(config.access_token_encrypted);
    await axios.get(`https://api.github.com/repos/${config.repo_owner}/${config.repo_name}`, {
      headers: { Authorization: `token ${token}`, 'User-Agent': 'SWP391-App' }
    });
    await config.update({ last_synced_at: new Date() });
    res.json({ success: true, message: 'GitHub connection successful' });
  } catch (err) {
    res.json({ success: false, message: 'GitHub connection failed: ' + (err.response?.data?.message || err.message) });
  }
};
// ===== GET SINGLE GROUP =====
exports.getGroup = async (req, res) => {
  try {
    const group = await Group.findByPk(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    res.json(group);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ===== GET JIRA CONFIG =====
exports.getJiraConfig = async (req, res) => {
  try {
    const config = await JiraConfig.findOne({ where: { group_id: req.params.id } });
    if (!config) return res.json(null);
    res.json({
      jira_domain: config.jira_domain,
      jira_email: config.jira_email,
      project_key: config.project_key,
      is_active: config.is_active,
      last_synced_at: config.last_synced_at,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ===== GET GITHUB CONFIG =====
exports.getGithubConfig = async (req, res) => {
  try {
    const config = await GithubConfig.findOne({ where: { group_id: req.params.id } });
    if (!config) return res.json(null);
    res.json({
      repo_owner: config.repo_owner,
      repo_name: config.repo_name,
      is_active: config.is_active,
      last_synced_at: config.last_synced_at,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};
