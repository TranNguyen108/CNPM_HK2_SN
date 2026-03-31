const { ensureGroupAccess } = require('../utils/groupAccess');
const { buildSrsData, buildSrsDoc, buildSrsFilename } = require('../services/srs.service');

const parseEpicIds = (input) => {
  if (!input) return [];
  if (Array.isArray(input)) return input.map((item) => String(item).trim()).filter(Boolean);
  return String(input)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

exports.previewSrs = async (req, res) => {
  try {
    const { groupId } = req.params;
    await ensureGroupAccess(req.user, groupId);

    const data = await buildSrsData({
      groupId,
      epicIds: parseEpicIds(req.query.epicIds),
      projectName: req.query.projectName,
      version: req.query.version
    });

    res.json(data);
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
};

exports.generateSrs = async (req, res) => {
  try {
    const { groupId, epicIds, projectName, version } = req.body;
    if (!groupId) {
      return res.status(400).json({ message: 'groupId là bắt buộc' });
    }

    await ensureGroupAccess(req.user, groupId);

    const data = await buildSrsData({
      groupId,
      epicIds: parseEpicIds(epicIds),
      projectName,
      version
    });

    const buffer = await buildSrsDoc(data);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${buildSrsFilename(data.meta.projectName, data.meta.version)}"`);
    res.send(buffer);
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
};
