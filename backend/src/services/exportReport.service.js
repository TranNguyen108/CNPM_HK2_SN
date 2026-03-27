const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

const MARGIN = 48;
const PAGE_WIDTH = 515;

const sanitizeFilePart = (value, fallback) => {
  const normalized = String(value || fallback || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || fallback;
};

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const formatDateTime = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

const buildTaskReportFilename = (groupName, sprintName) => {
  const safeGroup = sanitizeFilePart(groupName, 'group');
  const safeSprint = sanitizeFilePart(sprintName, 'tong-hop');
  return `bao-cao-nhom-${safeGroup}-sprint-${safeSprint}.pdf`;
};

const buildCommitReportFilename = (groupName, from, to) => {
  const safeGroup = sanitizeFilePart(groupName, 'group');
  const safeFrom = sanitizeFilePart(formatDate(from), 'tat-ca');
  const safeTo = sanitizeFilePart(formatDate(to), 'hien-tai');
  return `bao-cao-commit-nhom-${safeGroup}-tu-${safeFrom}-den-${safeTo}.xlsx`;
};

const ensureSpace = (doc, currentY, requiredHeight) => {
  if (currentY + requiredHeight <= doc.page.height - 60) return currentY;
  doc.addPage();
  return 50;
};

const drawTaskTableHeader = (doc, startY) => {
  const columns = [
    { label: 'ID', x: MARGIN, width: 76 },
    { label: 'Ten task', x: 128, width: 198 },
    { label: 'Assignee', x: 326, width: 88 },
    { label: 'Status', x: 414, width: 62 },
    { label: 'SP', x: 476, width: 39 }
  ];

  doc
    .fillColor('#0f172a')
    .rect(MARGIN, startY, PAGE_WIDTH, 24)
    .fill('#e2e8f0');

  doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a');
  columns.forEach((column) => {
    doc.text(column.label, column.x + 4, startY + 7, {
      width: column.width - 8,
      ellipsis: true
    });
  });

  return startY + 24;
};

const drawTaskRow = (doc, task, startY) => {
  const rowHeight = 44;
  const values = [
    { text: task.taskKey || task.id, x: MARGIN, width: 76 },
    { text: task.title || '-', x: 128, width: 198 },
    { text: task.assigneeName || '-', x: 326, width: 88 },
    { text: task.status || '-', x: 414, width: 62 },
    { text: task.storyPointsLabel, x: 476, width: 39 }
  ];

  doc
    .lineWidth(0.5)
    .strokeColor('#cbd5e1')
    .rect(MARGIN, startY, PAGE_WIDTH, rowHeight)
    .stroke();

  doc.font('Helvetica').fontSize(9).fillColor('#0f172a');
  values.forEach((cell) => {
    doc.text(cell.text, cell.x + 4, startY + 8, {
      width: cell.width - 8,
      height: rowHeight - 12,
      ellipsis: true
    });
  });

  return startY + rowHeight;
};

const drawStatusChart = (doc, startY, summary) => {
  const chartItems = [
    { label: 'Todo', value: summary.todo, color: '#94a3b8' },
    { label: 'In Progress', value: summary.in_progress, color: '#f59e0b' },
    { label: 'Done', value: summary.done, color: '#10b981' },
    { label: 'Other', value: summary.other, color: '#6366f1' }
  ];
  const maxValue = Math.max(...chartItems.map((item) => item.value), 1);

  doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a').text('Bieu do tien do task', MARGIN, startY);
  let currentY = startY + 24;

  chartItems.forEach((item) => {
    const barWidth = maxValue ? Math.max((item.value / maxValue) * 260, item.value ? 12 : 0) : 0;
    doc.font('Helvetica').fontSize(10).fillColor('#334155').text(item.label, MARGIN, currentY + 3, { width: 90 });
    doc.rect(MARGIN + 96, currentY, 280, 16).fill('#e2e8f0');
    if (barWidth) {
      doc.rect(MARGIN + 96, currentY, barWidth, 16).fill(item.color);
    }
    doc.fillColor('#0f172a').text(String(item.value), MARGIN + 388, currentY + 3, { width: 40, align: 'right' });
    currentY += 28;
  });

  return currentY;
};

const addWorksheetTitle = (worksheet, title, subtitle, lastColumnLetter) => {
  worksheet.mergeCells(`A1:${lastColumnLetter}1`);
  worksheet.getCell('A1').value = title;
  worksheet.getCell('A1').font = { bold: true, size: 16 };
  worksheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' };

  worksheet.mergeCells(`A2:${lastColumnLetter}2`);
  worksheet.getCell('A2').value = subtitle;
  worksheet.getCell('A2').font = { color: { argb: '475569' }, size: 10 };
};

const styleHeaderRow = (row) => {
  row.font = { bold: true, color: { argb: '0F172A' } };
  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'E2E8F0' }
  };
  row.alignment = { vertical: 'middle', horizontal: 'center' };
};

const autoFitColumns = (worksheet) => {
  worksheet.columns.forEach((column) => {
    let maxLength = 12;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const cellValue = cell.value == null ? '' : String(cell.value);
      maxLength = Math.max(maxLength, Math.min(cellValue.length + 2, 40));
    });
    column.width = maxLength;
  });
};

const setDownloadHeaders = (res, contentType, filename) => {
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
};

const renderTaskReportPdf = async (res, report) => {
  const filename = buildTaskReportFilename(report.group.name, report.sprintName);
  setDownloadHeaders(res, 'application/pdf', filename);

  const doc = new PDFDocument({
    size: 'A4',
    margin: MARGIN
  });

  await new Promise((resolve, reject) => {
    doc.on('error', reject);
    res.on('finish', resolve);
    doc.pipe(res);

    doc.font('Helvetica-Bold').fontSize(18).fillColor('#0f172a').text('Bao cao phan cong task', MARGIN, 42);
    doc.font('Helvetica').fontSize(10).fillColor('#334155');
    doc.text(`Project: ${report.group.description || report.group.name || 'N/A'}`, MARGIN, 72);
    doc.text(`Nhom: ${report.group.name || report.group.id}`, MARGIN, 88);
    doc.text(`Sprint: ${report.sprintName || 'Tong hop'}`, MARGIN, 104);
    doc.text(`Ngay xuat: ${formatDateTime(report.exportedAt)}`, MARGIN, 120);

    let currentY = 154;
    currentY = drawTaskTableHeader(doc, currentY);

    if (!report.tasks.length) {
      doc.font('Helvetica').fontSize(10).fillColor('#475569');
      doc.text('Khong co task phu hop voi dieu kien loc.', MARGIN, currentY + 12);
      currentY += 44;
    } else {
      report.tasks.forEach((task) => {
        currentY = ensureSpace(doc, currentY, 48);
        if (currentY === 50) {
          currentY = drawTaskTableHeader(doc, currentY);
        }
        currentY = drawTaskRow(doc, task, currentY);
      });
    }

    currentY = ensureSpace(doc, currentY + 16, 170);
    currentY = drawStatusChart(doc, currentY, report.summary);

    const footerY = doc.page.height - 42;
    doc
      .moveTo(MARGIN, footerY - 8)
      .lineTo(doc.page.width - MARGIN, footerY - 8)
      .strokeColor('#cbd5e1')
      .stroke();
    doc.font('Helvetica').fontSize(9).fillColor('#64748b')
      .text(`Tong task: ${report.summary.total} | Todo: ${report.summary.todo} | In Progress: ${report.summary.in_progress} | Done: ${report.summary.done}`, MARGIN, footerY);

    doc.end();
  });
};

const renderCommitReportExcel = async (res, report) => {
  const filename = buildCommitReportFilename(report.group.name, report.from, report.to);
  setDownloadHeaders(
    res,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename
  );

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Codex';
  workbook.created = new Date();

  const sheetTasks = workbook.addWorksheet('Task list');
  addWorksheetTitle(
    sheetTasks,
    'Task list',
    `Nhom: ${report.group.name || report.group.id} | Ngay xuat: ${formatDateTime(report.exportedAt)}`,
    'G'
  );
  sheetTasks.columns = [
    { key: 'taskKey' },
    { key: 'title' },
    { key: 'assigneeName' },
    { key: 'status' },
    { key: 'storyPointsLabel' },
    { key: 'sprint' },
    { key: 'dueDate' }
  ];
  sheetTasks.getRow(4).values = ['Task ID', 'Title', 'Assignee', 'Status', 'Story Points', 'Sprint', 'Due Date'];
  styleHeaderRow(sheetTasks.getRow(4));
  sheetTasks.getRow(4).height = 20;
  report.tasks.forEach((task) => sheetTasks.addRow(task));
  autoFitColumns(sheetTasks);
  sheetTasks.views = [{ state: 'frozen', ySplit: 4 }];

  const sheetMembers = workbook.addWorksheet('Member stats');
  addWorksheetTitle(
    sheetMembers,
    'Member stats',
    `Khoang thoi gian commit: ${formatDate(report.from) || 'tat ca'} -> ${formatDate(report.to) || 'hien tai'}`,
    'G'
  );
  sheetMembers.columns = [
    { key: 'member' },
    { key: 'email' },
    { key: 'githubUsername' },
    { key: 'commits' },
    { key: 'additions' },
    { key: 'deletions' },
    { key: 'lastCommitDate' }
  ];
  sheetMembers.getRow(4).values = ['Member', 'Email', 'GitHub', 'Commits', 'Additions', 'Deletions', 'Last Commit Date'];
  styleHeaderRow(sheetMembers.getRow(4));
  sheetMembers.getRow(4).height = 20;
  report.memberStats.forEach((member) => sheetMembers.addRow({
    ...member,
    lastCommitDate: formatDateTime(member.lastCommitDate)
  }));
  autoFitColumns(sheetMembers);
  sheetMembers.views = [{ state: 'frozen', ySplit: 4 }];

  const sheetCommits = workbook.addWorksheet('Commit log');
  addWorksheetTitle(
    sheetCommits,
    'Commit log',
    `Tong commits: ${report.commitLog.length}`,
    'H'
  );
  sheetCommits.columns = [
    { key: 'committedAt' },
    { key: 'sha' },
    { key: 'member' },
    { key: 'githubUsername' },
    { key: 'taskKey' },
    { key: 'message' },
    { key: 'additions' },
    { key: 'deletions' }
  ];
  sheetCommits.getRow(4).values = ['Committed At', 'SHA', 'Member', 'GitHub', 'Task Key', 'Message', 'Additions', 'Deletions'];
  styleHeaderRow(sheetCommits.getRow(4));
  sheetCommits.getRow(4).height = 20;
  report.commitLog.forEach((commit) => sheetCommits.addRow({
    ...commit,
    committedAt: formatDateTime(commit.committedAt)
  }));
  autoFitColumns(sheetCommits);
  sheetCommits.views = [{ state: 'frozen', ySplit: 4 }];

  await workbook.xlsx.write(res);
  res.end();
};

module.exports = {
  renderTaskReportPdf,
  renderCommitReportExcel
};
