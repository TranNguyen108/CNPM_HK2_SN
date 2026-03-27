const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

const PAGE_MARGIN = 48;
const CONTENT_WIDTH = 515;

const slugify = (value, fallback) => {
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
  const safeGroup = slugify(groupName, 'group');
  const safeSprint = slugify(sprintName, 'tong-hop');
  return `bao-cao-nhom-${safeGroup}-sprint-${safeSprint}.pdf`;
};

const buildCommitReportFilename = (groupName, fromDate, toDate) => {
  const safeGroup = slugify(groupName, 'group');
  const safeFrom = slugify(formatDate(fromDate), 'tat-ca');
  const safeTo = slugify(formatDate(toDate), 'hien-tai');
  return `bao-cao-commit-nhom-${safeGroup}-tu-${safeFrom}-den-${safeTo}.xlsx`;
};

const ensureSpace = (doc, cursorY, requiredHeight) => {
  if (cursorY + requiredHeight <= doc.page.height - 60) return cursorY;
  doc.addPage();
  return 50;
};

const drawTaskTableHeader = (doc, cursorY) => {
  const columns = [
    { label: 'ID', x: PAGE_MARGIN, width: 76 },
    { label: 'Task', x: 128, width: 198 },
    { label: 'Assignee', x: 326, width: 88 },
    { label: 'Status', x: 414, width: 62 },
    { label: 'SP', x: 476, width: 39 }
  ];

  doc.rect(PAGE_MARGIN, cursorY, CONTENT_WIDTH, 24).fill('#e2e8f0');
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a');

  columns.forEach((column) => {
    doc.text(column.label, column.x + 4, cursorY + 7, {
      width: column.width - 8,
      ellipsis: true
    });
  });

  return cursorY + 24;
};

const drawTaskRow = (doc, task, cursorY) => {
  const rowHeight = 44;
  const values = [
    { text: task.taskKey || task.id, x: PAGE_MARGIN, width: 76 },
    { text: task.title || '-', x: 128, width: 198 },
    { text: task.assigneeName || '-', x: 326, width: 88 },
    { text: task.status || '-', x: 414, width: 62 },
    { text: task.storyPointsLabel || '-', x: 476, width: 39 }
  ];

  doc.lineWidth(0.5).strokeColor('#cbd5e1').rect(PAGE_MARGIN, cursorY, CONTENT_WIDTH, rowHeight).stroke();
  doc.font('Helvetica').fontSize(9).fillColor('#0f172a');

  values.forEach((cell) => {
    doc.text(cell.text, cell.x + 4, cursorY + 8, {
      width: cell.width - 8,
      height: rowHeight - 12,
      ellipsis: true
    });
  });

  return cursorY + rowHeight;
};

const drawStatusChart = (doc, cursorY, summary) => {
  const items = [
    { label: 'Todo', value: summary.todo, color: '#94a3b8' },
    { label: 'In Progress', value: summary.in_progress, color: '#f59e0b' },
    { label: 'Done', value: summary.done, color: '#10b981' },
    { label: 'Other', value: summary.other, color: '#6366f1' }
  ];
  const maxValue = Math.max(...items.map((item) => item.value), 1);

  doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a').text('Task progress chart', PAGE_MARGIN, cursorY);
  let nextY = cursorY + 24;

  items.forEach((item) => {
    const barWidth = item.value ? Math.max((item.value / maxValue) * 260, 12) : 0;
    doc.font('Helvetica').fontSize(10).fillColor('#334155').text(item.label, PAGE_MARGIN, nextY + 3, { width: 90 });
    doc.rect(PAGE_MARGIN + 96, nextY, 280, 16).fill('#e2e8f0');
    if (barWidth) doc.rect(PAGE_MARGIN + 96, nextY, barWidth, 16).fill(item.color);
    doc.fillColor('#0f172a').text(String(item.value), PAGE_MARGIN + 388, nextY + 3, { width: 40, align: 'right' });
    nextY += 28;
  });

  return nextY;
};

const setAttachmentHeaders = (res, contentType, filename) => {
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
};

const writeSheetHeading = (worksheet, title, subtitle, lastColumn) => {
  worksheet.mergeCells(`A1:${lastColumn}1`);
  worksheet.getCell('A1').value = title;
  worksheet.getCell('A1').font = { bold: true, size: 16 };

  worksheet.mergeCells(`A2:${lastColumn}2`);
  worksheet.getCell('A2').value = subtitle;
  worksheet.getCell('A2').font = { size: 10, color: { argb: '475569' } };
};

const styleHeaderRow = (row) => {
  row.font = { bold: true, color: { argb: '0F172A' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
  row.alignment = { vertical: 'middle', horizontal: 'center' };
  row.height = 20;
};

const autoFitColumns = (worksheet) => {
  worksheet.columns.forEach((column) => {
    let maxLength = 12;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const text = cell.value == null ? '' : String(cell.value);
      maxLength = Math.max(maxLength, Math.min(text.length + 2, 40));
    });
    column.width = maxLength;
  });
};

const renderTaskReportPdf = async (res, report) => {
  setAttachmentHeaders(res, 'application/pdf', buildTaskReportFilename(report.group.name, report.sprintName));

  const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN });

  await new Promise((resolve, reject) => {
    doc.on('error', reject);
    res.on('finish', resolve);
    doc.pipe(res);

    doc.font('Helvetica-Bold').fontSize(18).fillColor('#0f172a').text('Task assignment report', PAGE_MARGIN, 42);
    doc.font('Helvetica').fontSize(10).fillColor('#334155');
    doc.text(`Project: ${report.group.description || report.group.name || 'N/A'}`, PAGE_MARGIN, 72);
    doc.text(`Group: ${report.group.name || report.group.id}`, PAGE_MARGIN, 88);
    doc.text(`Sprint: ${report.sprintName || 'Tong hop'}`, PAGE_MARGIN, 104);
    doc.text(`Exported at: ${formatDateTime(report.exportedAt)}`, PAGE_MARGIN, 120);

    let cursorY = 154;
    cursorY = drawTaskTableHeader(doc, cursorY);

    if (!report.tasks.length) {
      doc.font('Helvetica').fontSize(10).fillColor('#475569');
      doc.text('Khong co task phu hop voi dieu kien loc.', PAGE_MARGIN, cursorY + 12);
      cursorY += 44;
    } else {
      report.tasks.forEach((task) => {
        cursorY = ensureSpace(doc, cursorY, 48);
        if (cursorY === 50) cursorY = drawTaskTableHeader(doc, cursorY);
        cursorY = drawTaskRow(doc, task, cursorY);
      });
    }

    cursorY = ensureSpace(doc, cursorY + 16, 170);
    cursorY = drawStatusChart(doc, cursorY, report.summary);

    const footerY = doc.page.height - 42;
    doc.moveTo(PAGE_MARGIN, footerY - 8).lineTo(doc.page.width - PAGE_MARGIN, footerY - 8).strokeColor('#cbd5e1').stroke();
    doc.font('Helvetica').fontSize(9).fillColor('#64748b')
      .text(`Total task: ${report.summary.total} | Todo: ${report.summary.todo} | In Progress: ${report.summary.in_progress} | Done: ${report.summary.done}`, PAGE_MARGIN, footerY);

    doc.end();
  });
};

const renderCommitReportExcel = async (res, report) => {
  setAttachmentHeaders(
    res,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buildCommitReportFilename(report.group.name, report.from, report.to)
  );

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Codex';
  workbook.created = new Date();

  const taskSheet = workbook.addWorksheet('Task list');
  writeSheetHeading(taskSheet, 'Task list', `Group: ${report.group.name || report.group.id} | Exported at: ${formatDateTime(report.exportedAt)}`, 'G');
  taskSheet.columns = [
    { key: 'taskKey' },
    { key: 'title' },
    { key: 'assigneeName' },
    { key: 'status' },
    { key: 'storyPointsLabel' },
    { key: 'sprint' },
    { key: 'dueDate' }
  ];
  taskSheet.getRow(4).values = ['Task ID', 'Title', 'Assignee', 'Status', 'Story Points', 'Sprint', 'Due Date'];
  styleHeaderRow(taskSheet.getRow(4));
  report.tasks.forEach((task) => taskSheet.addRow(task));
  taskSheet.views = [{ state: 'frozen', ySplit: 4 }];
  autoFitColumns(taskSheet);

  const memberSheet = workbook.addWorksheet('Member stats');
  writeSheetHeading(memberSheet, 'Member stats', `Commit range: ${formatDate(report.from) || 'tat ca'} -> ${formatDate(report.to) || 'hien tai'}`, 'G');
  memberSheet.columns = [
    { key: 'member' },
    { key: 'email' },
    { key: 'githubUsername' },
    { key: 'commits' },
    { key: 'additions' },
    { key: 'deletions' },
    { key: 'lastCommitDate' }
  ];
  memberSheet.getRow(4).values = ['Member', 'Email', 'GitHub', 'Commits', 'Additions', 'Deletions', 'Last Commit Date'];
  styleHeaderRow(memberSheet.getRow(4));
  report.memberStats.forEach((member) => memberSheet.addRow({
    ...member,
    lastCommitDate: formatDateTime(member.lastCommitDate)
  }));
  memberSheet.views = [{ state: 'frozen', ySplit: 4 }];
  autoFitColumns(memberSheet);

  const commitSheet = workbook.addWorksheet('Commit log');
  writeSheetHeading(commitSheet, 'Commit log', `Total commits: ${report.commitLog.length}`, 'H');
  commitSheet.columns = [
    { key: 'committedAt' },
    { key: 'sha' },
    { key: 'member' },
    { key: 'githubUsername' },
    { key: 'taskKey' },
    { key: 'message' },
    { key: 'additions' },
    { key: 'deletions' }
  ];
  commitSheet.getRow(4).values = ['Committed At', 'SHA', 'Member', 'GitHub', 'Task Key', 'Message', 'Additions', 'Deletions'];
  styleHeaderRow(commitSheet.getRow(4));
  report.commitLog.forEach((commit) => commitSheet.addRow({
    ...commit,
    committedAt: formatDateTime(commit.committedAt)
  }));
  commitSheet.views = [{ state: 'frozen', ySplit: 4 }];
  autoFitColumns(commitSheet);

  await workbook.xlsx.write(res);
  res.end();
};

module.exports = {
  renderTaskReportPdf,
  renderCommitReportExcel
};
