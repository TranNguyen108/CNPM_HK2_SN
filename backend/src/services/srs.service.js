const {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType
} = require('docx');
const { Op } = require('sequelize');
const { Group } = require('../models/group.model');
const { Task } = require('../models/task.model');

const DEFAULT_NON_FUNCTIONAL_REQUIREMENTS = [
  'Usability: Giao diện cần dễ sử dụng, nhất quán và phù hợp cho thành viên dự án và giảng viên theo dõi tiến độ.',
  'Performance: Các thao tác xem danh sách, tìm kiếm và cập nhật yêu cầu cần phản hồi ổn định trong điều kiện sử dụng thông thường.',
  'Security: Chỉ người dùng đã xác thực và có quyền trong nhóm mới được xem hoặc thao tác với dữ liệu dự án.',
  'Reliability: Dữ liệu đồng bộ từ Jira cần được lưu trữ nhất quán để phục vụ báo cáo và truy xuất lại khi cần.',
  'Maintainability: Cấu trúc hệ thống cần hỗ trợ mở rộng thêm báo cáo, chỉ số theo dõi và tích hợp công cụ quản lý dự án.'
];

const normalizeText = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const slugify = (value, fallback = 'srs') => {
  const normalized = String(value || fallback)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || fallback;
};

const sentenceCase = (value) => {
  const text = normalizeText(value);
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const storyPointsToPriority = (storyPoints) => {
  const points = Number(storyPoints);
  if (!Number.isFinite(points)) return 'Medium';
  if (points >= 8) return 'Critical';
  if (points >= 5) return 'High';
  if (points >= 3) return 'Medium';
  return 'Low';
};

const uniqueBy = (items, keyGetter) => {
  const map = new Map();
  items.forEach((item) => {
    const key = keyGetter(item);
    if (!map.has(key)) map.set(key, item);
  });
  return [...map.values()];
};

const pickGroup = async (groupId) => {
  const group = await Group.findByPk(groupId, { raw: true });
  if (!group) {
    const error = new Error('Không tìm thấy nhóm');
    error.statusCode = 404;
    throw error;
  }
  return group;
};

const pickTasksForGroup = async (groupId) => (
  Task.findAll({
    where: { group_id: groupId },
    raw: true,
    order: [
      ['issue_type', 'ASC'],
      ['epic_key', 'ASC'],
      ['jira_key', 'ASC']
    ]
  })
);

const classifyIssues = (tasks) => {
  const epics = [];
  const stories = [];

  tasks.forEach((task) => {
    const issueType = String(task.issue_type || '').trim().toLowerCase();
    if (issueType === 'epic') {
      epics.push(task);
      return;
    }
    stories.push(task);
  });

  return { epics, stories };
};

const buildEpicCatalog = (tasks) => {
  const { epics, stories } = classifyIssues(tasks);
  const epicMap = new Map();

  epics.forEach((epic) => {
    epicMap.set(epic.jira_key, {
      id: epic.id,
      jiraKey: epic.jira_key,
      title: epic.title || epic.epic_name || epic.jira_key,
      summary: epic.description || epic.title || '',
      source: epic
    });
  });

  stories.forEach((story) => {
    const epicKey = story.epic_key;
    if (!epicKey) return;
    if (!epicMap.has(epicKey)) {
      epicMap.set(epicKey, {
        id: story.id,
        jiraKey: epicKey,
        title: story.epic_name || epicKey,
        summary: '',
        source: null
      });
    }
  });

  return [...epicMap.values()].sort((a, b) => a.jiraKey.localeCompare(b.jiraKey));
};

const buildSrsData = async ({ groupId, epicIds = [], projectName, version }) => {
  const [group, tasks] = await Promise.all([
    pickGroup(groupId),
    pickTasksForGroup(groupId)
  ]);

  const epicCatalog = buildEpicCatalog(tasks);
  const selectedEpicKeySet = new Set(
    epicCatalog
      .filter((epic) => !epicIds.length || epicIds.includes(epic.id) || epicIds.includes(epic.jiraKey))
      .map((epic) => epic.jiraKey)
  );

  const selectedEpicRows = epicCatalog.filter((epic) => selectedEpicKeySet.has(epic.jiraKey));
  if (!selectedEpicRows.length) {
    const error = new Error('Không có epic phù hợp để tạo SRS. Hãy đồng bộ Jira và chọn ít nhất một epic.');
    error.statusCode = 400;
    throw error;
  }

  const stories = tasks
    .filter((task) => String(task.issue_type || '').trim().toLowerCase() !== 'epic')
    .filter((task) => selectedEpicKeySet.has(task.epic_key))
    .map((task) => ({
      id: task.id,
      jiraKey: task.jira_key,
      title: task.title || task.jira_key,
      description: task.description || 'Không có mô tả chi tiết trong Jira.',
      issueType: task.issue_type || 'Story',
      epicKey: task.epic_key,
      epicName: task.epic_name || task.epic_key,
      status: task.status || 'N/A',
      storyPoints: task.story_points,
      priority: storyPointsToPriority(task.story_points)
    }));

  const sections = selectedEpicRows.map((epic) => {
    const sectionStories = stories.filter((story) => story.epicKey === epic.jiraKey);
    return {
      id: epic.id,
      epicKey: epic.jiraKey,
      title: epic.title,
      summary: epic.summary || `Nhóm chức năng được tổng hợp từ epic ${epic.jiraKey}.`,
      stories: sectionStories
    };
  });

  const functionalRequirements = sections.flatMap((section) => (
    section.stories.map((story, index) => ({
      id: `${section.epicKey}-FR-${index + 1}`,
      epicKey: section.epicKey,
      epicTitle: section.title,
      jiraKey: story.jiraKey,
      title: story.title,
      description: story.description,
      issueType: story.issueType,
      storyPoints: story.storyPoints,
      priority: story.priority,
      status: story.status
    }))
  ));

  const useCaseSummary = sections.map((section) => ({
    epicKey: section.epicKey,
    epicTitle: section.title,
    actors: ['Project member', 'Group leader', 'Lecturer'],
    useCases: section.stories.length
      ? section.stories.map((story) => `${story.jiraKey}: ${sentenceCase(story.title)}`)
      : [`Quản lý phạm vi chức năng thuộc ${section.epicKey}`]
  }));

  return {
    meta: {
      groupId,
      projectName: projectName || group.name,
      version: version || '1.0',
      generatedAt: new Date().toISOString(),
      semester: group.semester || null
    },
    epicOptions: epicCatalog.map((epic) => ({
      id: epic.id,
      jiraKey: epic.jiraKey,
      title: epic.title,
      summary: epic.summary
    })),
    document: {
      introduction: {
        purpose: `Tài liệu SRS mô tả phạm vi và yêu cầu của dự án ${projectName || group.name}.`,
        scope: group.description || `Dự án của nhóm ${group.name}.`,
        references: ['Nguồn dữ liệu Jira đã được đồng bộ vào hệ thống quản lý nhóm']
      },
      overallDescription: {
        productPerspective: `Hệ thống hỗ trợ nhóm ${group.name} theo dõi công việc, phân rã yêu cầu và quản lý tiến độ phát triển phần mềm.`,
        userClasses: ['Administrator', 'Group leader', 'Member', 'Lecturer'],
        assumptions: [
          'Dữ liệu issue đã được đồng bộ từ Jira về hệ thống.',
          'Epic được dùng để đại diện cho section, stories/tasks là nguồn chính của functional requirements.'
        ]
      },
      sections,
      functionalRequirements,
      nonFunctionalRequirements: DEFAULT_NON_FUNCTIONAL_REQUIREMENTS,
      useCaseSummary
    }
  };
};

const paragraph = (text, options = {}) => new Paragraph({
  spacing: { after: 120 },
  ...options,
  children: Array.isArray(text)
    ? text
    : [new TextRun(String(text || ''))]
});

const heading = (text, level = HeadingLevel.HEADING_1) => paragraph(text, {
  heading: level,
  spacing: { before: 240, after: 120 }
});

const bullet = (text) => paragraph(text, {
  bullet: { level: 0 }
});

const tableCell = (text, width) => new TableCell({
  width: { size: width, type: WidthType.PERCENTAGE },
  children: [paragraph(text)]
});

const buildSrsDoc = async (data) => {
  const { meta, document } = data;
  const children = [
    paragraph(meta.projectName, {
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.TITLE,
      spacing: { after: 200 }
    }),
    paragraph(`Software Requirements Specification - Version ${meta.version}`, {
      alignment: AlignmentType.CENTER,
      spacing: { after: 320 }
    }),
    heading('1. Gioi thieu'),
    bullet(`Muc dich: ${document.introduction.purpose}`),
    bullet(`Pham vi: ${document.introduction.scope}`),
    ...document.introduction.references.map((item) => bullet(`Tai lieu tham chieu: ${item}`)),
    heading('2. Mo ta tong quan'),
    bullet(`Goc nhin san pham: ${document.overallDescription.productPerspective}`),
    bullet(`Nhom nguoi dung: ${document.overallDescription.userClasses.join(', ')}`),
    ...document.overallDescription.assumptions.map((item) => bullet(`Gia dinh: ${item}`)),
    heading('3. Yeu cau chuc nang')
  ];

  document.sections.forEach((section, sectionIndex) => {
    children.push(heading(`3.${sectionIndex + 1} ${section.epicKey} - ${section.title}`, HeadingLevel.HEADING_2));
    children.push(paragraph(section.summary));

    if (!section.stories.length) {
      children.push(paragraph('Chua co functional requirement nao thuoc epic nay.'));
      return;
    }

    section.stories.forEach((story, storyIndex) => {
      children.push(heading(`FR-${sectionIndex + 1}.${storyIndex + 1} ${story.jiraKey} - ${story.title}`, HeadingLevel.HEADING_3));
      children.push(paragraph(story.description));
      children.push(paragraph([
        new TextRun({ text: 'Issue type: ', bold: true }),
        new TextRun(story.issueType || 'Story'),
        new TextRun({ text: ' | Story points: ', bold: true }),
        new TextRun(story.storyPoints == null ? 'N/A' : String(story.storyPoints)),
        new TextRun({ text: ' | Priority: ', bold: true }),
        new TextRun(story.priority)
      ]));
    });
  });

  children.push(heading('4. Yeu cau phi chuc nang'));
  document.nonFunctionalRequirements.forEach((item) => children.push(bullet(item)));

  children.push(heading('5. Use case summary'));
  document.useCaseSummary.forEach((item, index) => {
    children.push(heading(`5.${index + 1} ${item.epicKey} - ${item.epicTitle}`, HeadingLevel.HEADING_2));
    children.push(paragraph(`Actors: ${item.actors.join(', ')}`));
    item.useCases.forEach((useCase) => children.push(bullet(useCase)));
  });

  children.push(heading('Phu luc: Functional requirements overview', HeadingLevel.HEADING_2));
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          tableCell('Epic', 20),
          tableCell('Jira Key', 15),
          tableCell('Requirement', 35),
          tableCell('Priority', 15),
          tableCell('Status', 15)
        ]
      }),
      ...document.functionalRequirements.map((item) => new TableRow({
        children: [
          tableCell(item.epicKey, 20),
          tableCell(item.jiraKey, 15),
          tableCell(item.title, 35),
          tableCell(item.priority, 15),
          tableCell(item.status, 15)
        ]
      }))
    ]
  }));

  const doc = new Document({
    sections: [{
      properties: {},
      children
    }]
  });

  return Packer.toBuffer(doc);
};

const buildSrsFilename = (projectName, version) => (
  `srs-${slugify(projectName, 'project')}-v${slugify(version, '1-0')}.docx`
);

module.exports = {
  buildSrsData,
  buildSrsDoc,
  buildSrsFilename
};
