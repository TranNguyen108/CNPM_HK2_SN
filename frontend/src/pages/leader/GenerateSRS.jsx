import { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Steps,
  Card,
  Select,
  Typography,
  Button,
  Form,
  Input,
  Row,
  Col,
  Collapse,
  Tag,
  Progress,
  Space,
  Divider,
  Badge,
  Statistic,
  Checkbox,
  Alert,
  Spin,
  Empty,
  message,
} from 'antd';
import {
  FileWordOutlined,
  TeamOutlined,
  FormOutlined,
  EyeOutlined,
  DownloadOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CheckSquareOutlined,
} from '@ant-design/icons';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from 'docx';
import { tasksApi, syncApi } from '../../api/tasksApi';

const { Title, Text } = Typography;

// ─── Status Tag ──────────────────────────────────────────────────────────────
function StatusTag({ status }) {
  const s = (status || '').toLowerCase();
  if (['done', 'closed', 'resolved', 'complete', 'completed'].some((x) => s.includes(x)))
    return <Tag color="success" style={{ fontSize: 11 }}>{status}</Tag>;
  if (['in progress', 'in-progress', 'doing', 'review', 'testing'].some((x) => s.includes(x)))
    return <Tag color="processing" style={{ fontSize: 11 }}>{status}</Tag>;
  if (['to do', 'todo', 'open', 'new', 'backlog'].some((x) => s.includes(x)))
    return <Tag style={{ fontSize: 11 }}>{status || 'To Do'}</Tag>;
  return <Tag color="warning" style={{ fontSize: 11 }}>{status || 'N/A'}</Tag>;
}

// ─── Priority Tag ─────────────────────────────────────────────────────────────
function PriorityTag({ priority }) {
  const p = (priority || '').toLowerCase();
  const colorMap = {
    highest: 'red',
    high: 'volcano',
    medium: 'orange',
    low: 'blue',
    lowest: 'geekblue',
  };
  return (
    <Tag color={colorMap[p] || 'default'} style={{ fontSize: 11 }}>
      {priority || 'N/A'}
    </Tag>
  );
}

// ─── Docx Generator ───────────────────────────────────────────────────────────
async function buildDocxBlob(info, tasksBySprint) {
  const children = [];

  // ── Cover page ────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'SOFTWARE REQUIREMENTS SPECIFICATION',
          bold: true,
          size: 44,
          color: '1565C0',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 1440, after: 480 },
    }),
    new Paragraph({
      children: [new TextRun({ text: info.name, bold: true, size: 36 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Phiên bản: ${info.version}`, size: 26, color: '333333' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Tác giả: ${info.author}`, size: 26, color: '333333' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Ngày tạo: ${new Date().toLocaleDateString('vi-VN')}`,
          size: 22,
          color: '888888',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 1440 },
    }),
  );

  // ── Section 1: Giới thiệu ─────────────────────────────────────────────────
  children.push(
    new Paragraph({
      text: '1. Giới thiệu',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    }),
    new Paragraph({
      text: '1.1 Mục đích',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun(
          `Tài liệu này mô tả các yêu cầu phần mềm cho dự án "${info.name}". ` +
            `Tài liệu SRS cung cấp cơ sở tham chiếu thống nhất cho nhóm phát triển và giảng viên hướng dẫn.`,
        ),
      ],
      spacing: { after: 160 },
    }),
    new Paragraph({
      text: '1.2 Phạm vi',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun(
          `Tài liệu bao gồm ${info.totalRequirements} yêu cầu chức năng từ ${tasksBySprint.size} sprint, ` +
            `được trích xuất từ hệ thống quản lý dự án Jira.`,
        ),
      ],
      spacing: { after: 160 },
    }),
    new Paragraph({
      text: '1.3 Ký hiệu và quy ước',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 100 },
    }),
    new Paragraph({
      children: [new TextRun('• [JIRA-KEY]: Mã định danh yêu cầu trong Jira')],
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [new TextRun('• Trạng thái: To Do / In Progress / Done')],
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [new TextRun('• Độ ưu tiên: Highest / High / Medium / Low / Lowest')],
      spacing: { after: 160 },
    }),
  );

  // ── Section 2: Tổng quan dự án ────────────────────────────────────────────
  const overviewRows = [
    ['Tên dự án', info.name],
    ['Phiên bản', info.version],
    ['Tác giả / Nhóm', info.author],
    ['Ngày lập', new Date().toLocaleDateString('vi-VN')],
    ...(info.description ? [['Mô tả', info.description]] : []),
  ];

  children.push(
    new Paragraph({
      text: '2. Tổng quan dự án',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: overviewRows.map(
        ([label, value]) =>
          new TableRow({
            children: [
              new TableCell({
                width: { size: 30, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: label, bold: true })],
                    spacing: { before: 80, after: 80 },
                  }),
                ],
              }),
              new TableCell({
                width: { size: 70, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    children: [new TextRun(String(value))],
                    spacing: { before: 80, after: 80 },
                  }),
                ],
              }),
            ],
          }),
      ),
    }),
  );

  // ── Section 3: Yêu cầu chức năng ─────────────────────────────────────────
  children.push(
    new Paragraph({
      text: '3. Yêu cầu chức năng',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    }),
  );

  let secIdx = 1;
  for (const [sprintName, tasks] of tasksBySprint) {
    children.push(
      new Paragraph({
        text: `3.${secIdx} ${sprintName} (${tasks.length} yêu cầu)`,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 320, after: 160 },
      }),
    );

    for (const task of tasks) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `[${task.jira_key}] `, bold: true, color: '1565C0' }),
            new TextRun(task.title || '(Không có tiêu đề)'),
          ],
          spacing: { before: 80, after: 60 },
          indent: { left: 360 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Trạng thái: ', bold: true, size: 18, color: '333333' }),
            new TextRun({ text: (task.status || 'N/A') + '   ', size: 18 }),
            new TextRun({ text: 'Độ ưu tiên: ', bold: true, size: 18, color: '333333' }),
            new TextRun({ text: (task.priority || 'N/A') + '   ', size: 18 }),
            ...(task.assignee_email
              ? [
                  new TextRun({ text: 'Người thực hiện: ', bold: true, size: 18, color: '333333' }),
                  new TextRun({ text: task.assignee_email + '   ', size: 18 }),
                ]
              : []),
            ...(task.story_points
              ? [
                  new TextRun({ text: 'Story Points: ', bold: true, size: 18, color: '333333' }),
                  new TextRun({ text: String(task.story_points), size: 18 }),
                ]
              : []),
          ],
          spacing: { after: 160 },
          indent: { left: 360 },
        }),
      );
    }
    secIdx++;
  }

  // ── Section 4: Yêu cầu phi chức năng ─────────────────────────────────────
  children.push(
    new Paragraph({
      text: '4. Yêu cầu phi chức năng',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    }),
    new Paragraph({
      text: '4.1 Hiệu năng (Performance)',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun(
          'Hệ thống phải xử lý yêu cầu người dùng trong vòng 2 giây trong điều kiện tải thông thường.',
        ),
      ],
      spacing: { after: 160 },
    }),
    new Paragraph({
      text: '4.2 Bảo mật (Security)',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun(
          'Toàn bộ API yêu cầu xác thực JWT. Token tích hợp Jira/GitHub được mã hoá AES-256. ' +
            'Mật khẩu người dùng được băm bằng bcrypt trước khi lưu trữ.',
        ),
      ],
      spacing: { after: 160 },
    }),
    new Paragraph({
      text: '4.3 Khả năng sử dụng (Usability)',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun(
          'Giao diện phải responsive, tương thích với Chrome, Firefox, Edge phiên bản hiện đại.',
        ),
      ],
      spacing: { after: 160 },
    }),
    new Paragraph({
      text: '4.4 Độ tin cậy (Reliability)',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun(
          'Hệ thống đảm bảo uptime ≥ 99% trong giờ làm việc. ' +
            'Tự động retry khi tích hợp Jira/GitHub không phản hồi.',
        ),
      ],
      spacing: { after: 160 },
    }),
  );

  const doc = new Document({
    creator: info.author,
    title: `SRS - ${info.name} v${info.version}`,
    description: `Software Requirements Specification for ${info.name}`,
    sections: [{ properties: {}, children }],
  });

  return Packer.toBlob(doc);
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function GenerateSRS() {
  const [step, setStep] = useState(0);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [selectedSprints, setSelectedSprints] = useState([]);
  const [projectInfo, setProjectInfo] = useState({
    name: '',
    version: '1.0',
    author: '',
    description: '',
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();
  const timerRef = useRef(null);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: groups = [], isLoading: loadingGroups } = useQuery({
    queryKey: ['my-groups'],
    queryFn: () => tasksApi.getMyGroups().then((r) => r.data),
    staleTime: 300_000,
  });

  const { data: rawSprints, isLoading: loadingSprints } = useQuery({
    queryKey: ['sprints', selectedGroupId],
    queryFn: () => tasksApi.getSprints(selectedGroupId).then((r) => r.data),
    enabled: !!selectedGroupId,
  });

  const sprints = useMemo(() => {
    const arr = Array.isArray(rawSprints) ? rawSprints : [];
    return arr.filter(Boolean).sort();
  }, [rawSprints]);

  const { data: rawTasks, isLoading: loadingTasks } = useQuery({
    queryKey: ['sync-tasks', selectedGroupId],
    queryFn: () => syncApi.getGroupTasks(selectedGroupId).then((r) => r.data),
    enabled: !!selectedGroupId,
  });

  const allTasks = useMemo(() => {
    if (!rawTasks) return [];
    return Array.isArray(rawTasks) ? rawTasks : rawTasks.items || rawTasks.tasks || [];
  }, [rawTasks]);

  // ── Computed ───────────────────────────────────────────────────────────────
  const sprintTaskCount = useMemo(() => {
    const map = {};
    for (const t of allTasks) {
      const s = t.sprint || 'Backlog';
      map[s] = (map[s] || 0) + 1;
    }
    return map;
  }, [allTasks]);

  const filteredTasks = useMemo(() => {
    if (!selectedSprints.length) return [];
    return allTasks.filter((t) => selectedSprints.includes(t.sprint || 'Backlog'));
  }, [allTasks, selectedSprints]);

  const tasksBySprint = useMemo(() => {
    const map = new Map();
    for (const s of selectedSprints) {
      const tasks = allTasks.filter((t) => (t.sprint || 'Backlog') === s);
      if (tasks.length > 0) map.set(s, tasks);
    }
    return map;
  }, [allTasks, selectedSprints]);

  const totalRequirements = filteredTasks.length;
  const selectedGroup = groups.find((g) => g.id === selectedGroupId);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSelectAll = (checked) => {
    setSelectedSprints(checked ? [...sprints] : []);
  };

  const toggleSprint = (sprint) => {
    setSelectedSprints((prev) =>
      prev.includes(sprint) ? prev.filter((s) => s !== sprint) : [...prev, sprint],
    );
  };

  const handleGenerate = async () => {
    try {
      await form.validateFields();
    } catch {
      return;
    }
    if (totalRequirements === 0) {
      messageApi.warning('Không có yêu cầu nào được chọn');
      return;
    }

    setIsGenerating(true);
    setProgress(5);

    let p = 5;
    timerRef.current = setInterval(() => {
      p += Math.random() * 14 + 4;
      if (p >= 88) {
        clearInterval(timerRef.current);
        setProgress(88);
      } else {
        setProgress(Math.round(p));
      }
    }, 280);

    try {
      const blob = await buildDocxBlob(
        { ...projectInfo, totalRequirements },
        tasksBySprint,
      );
      clearInterval(timerRef.current);
      setProgress(100);

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SRS_${projectInfo.name.replace(/\s+/g, '_')}_v${projectInfo.version}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      messageApi.success('Tải xuống file SRS thành công!');
    } catch (err) {
      clearInterval(timerRef.current);
      messageApi.error('Tạo tài liệu thất bại: ' + err.message);
    } finally {
      setTimeout(() => {
        setIsGenerating(false);
        setProgress(0);
      }, 1400);
    }
  };

  // ── Preview accordion items ────────────────────────────────────────────────
  const previewItems = useMemo(
    () =>
      [...tasksBySprint.entries()].map(([sprint, tasks]) => ({
        key: sprint,
        label: (
          <Space>
            <Text strong>{sprint}</Text>
            <Badge count={tasks.length} style={{ backgroundColor: '#1677ff' }} />
          </Space>
        ),
        children: (
          <div style={{ maxHeight: 340, overflowY: 'auto' }}>
            {tasks.map((task) => (
              <div
                key={task.id || task.jira_key}
                style={{
                  padding: '8px 12px',
                  borderBottom: '1px solid #f5f5f5',
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                }}
              >
                <Tag color="blue" style={{ fontSize: 11, flexShrink: 0, marginTop: 2 }}>
                  {task.jira_key}
                </Tag>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      display: 'block',
                      marginBottom: 4,
                      wordBreak: 'break-word',
                    }}
                  >
                    {task.title || '(Không có tiêu đề)'}
                  </Text>
                  <Space size={4} wrap>
                    <StatusTag status={task.status} />
                    <PriorityTag priority={task.priority} />
                    {task.story_points && (
                      <Tag color="purple" style={{ fontSize: 11 }}>
                        SP: {task.story_points}
                      </Tag>
                    )}
                  </Space>
                </div>
              </div>
            ))}
          </div>
        ),
      })),
    [tasksBySprint],
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      {contextHolder}

      <Title level={3} style={{ marginBottom: 20 }}>
        <FileWordOutlined style={{ marginRight: 8, color: '#1565C0' }} />
        Generate SRS
      </Title>

      {/* Steps indicator */}
      <Card style={{ marginBottom: 20 }}>
        <Steps
          current={step}
          items={[
            { title: 'Chọn nhóm', description: 'Nhóm dự án', icon: <TeamOutlined /> },
            {
              title: 'Chọn Sprint',
              description: 'Epics / Sprints',
              icon: <CheckSquareOutlined />,
            },
            {
              title: 'Thông tin & Preview',
              description: 'Điền & xuất file',
              icon: <FormOutlined />,
            },
          ]}
        />
      </Card>

      {/* ── Step 0: Chọn nhóm ─────────────────────────────────────────────── */}
      {step === 0 && (
        <Card>
          <Title level={4} style={{ marginBottom: 6 }}>
            Bước 1: Chọn nhóm dự án
          </Title>
          <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
            Chọn nhóm muốn tạo tài liệu SRS
          </Text>

          <Spin spinning={loadingGroups}>
            <div style={{ maxWidth: 520 }}>
              <Select
                placeholder="-- Chọn nhóm --"
                value={selectedGroupId}
                onChange={(v) => {
                  setSelectedGroupId(v);
                  setSelectedSprints([]);
                }}
                options={groups.map((g) => ({
                  value: g.id,
                  label: g.name + (g.semester ? ` (${g.semester})` : ''),
                }))}
                style={{ width: '100%', marginBottom: 20 }}
                size="large"
                showSearch
                filterOption={(input, option) =>
                  option.label.toLowerCase().includes(input.toLowerCase())
                }
              />

              {selectedGroupId && loadingTasks && (
                <Spin tip="Đang tải dữ liệu nhóm..." style={{ display: 'block', marginBottom: 20 }} />
              )}

              {selectedGroupId && !loadingTasks && (
                <Alert
                  type="info"
                  showIcon
                  message={`Nhóm "${selectedGroup?.name}" — ${allTasks.length} tasks đã được sync`}
                  style={{ marginBottom: 20 }}
                />
              )}

              <Button
                type="primary"
                size="large"
                icon={<ArrowRightOutlined />}
                onClick={() => setStep(1)}
                disabled={!selectedGroupId || loadingTasks || loadingSprints}
                loading={loadingTasks || loadingSprints}
              >
                Tiếp theo
              </Button>
            </div>
          </Spin>
        </Card>
      )}

      {/* ── Step 1: Chọn Sprint ───────────────────────────────────────────── */}
      {step === 1 && (
        <Card>
          <Title level={4} style={{ marginBottom: 6 }}>
            Bước 2: Chọn Sprint / Epic
          </Title>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            Chọn các sprint muốn đưa vào tài liệu SRS
          </Text>
          <Divider style={{ marginTop: 12, marginBottom: 20 }} />

          {loadingSprints ? (
            <Spin tip="Đang tải danh sách sprint..." />
          ) : sprints.length === 0 ? (
            <Empty
              description="Nhóm này chưa có sprint nào. Vui lòng sync Jira trước."
              style={{ marginBottom: 24 }}
            />
          ) : (
            <>
              {/* Select all */}
              <div
                style={{
                  marginBottom: 16,
                  padding: '8px 12px',
                  background: '#fafafa',
                  borderRadius: 6,
                  display: 'inline-block',
                }}
              >
                <Checkbox
                  checked={selectedSprints.length === sprints.length && sprints.length > 0}
                  indeterminate={
                    selectedSprints.length > 0 && selectedSprints.length < sprints.length
                  }
                  onChange={(e) => handleSelectAll(e.target.checked)}
                >
                  <Text strong>Chọn tất cả ({sprints.length} sprints)</Text>
                </Checkbox>
              </div>

              {/* Sprint cards grid */}
              <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
                {sprints.map((sprint) => {
                  const count = sprintTaskCount[sprint] || 0;
                  const isSelected = selectedSprints.includes(sprint);
                  return (
                    <Col key={sprint} xs={24} sm={12} md={8} lg={6}>
                      <Card
                        size="small"
                        style={{
                          cursor: 'pointer',
                          border: isSelected ? '2px solid #1677ff' : '1px solid #e8e8e8',
                          background: isSelected ? '#e6f4ff' : '#fff',
                          transition: 'border 0.2s, background 0.2s',
                          borderRadius: 8,
                        }}
                        onClick={() => toggleSprint(sprint)}
                      >
                        <Space align="start">
                          <Checkbox
                            checked={isSelected}
                            onChange={() => toggleSprint(sprint)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ marginTop: 2 }}
                          />
                          <div>
                            <Text
                              strong
                              style={{ fontSize: 13, display: 'block', lineHeight: '1.4' }}
                            >
                              {sprint}
                            </Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {count} tasks
                            </Text>
                          </div>
                        </Space>
                      </Card>
                    </Col>
                  );
                })}
              </Row>

              {/* Selection summary */}
              {selectedSprints.length > 0 && (
                <Alert
                  type="success"
                  showIcon
                  message={
                    <Space>
                      <Text>
                        Đã chọn <Text strong>{selectedSprints.length}</Text> sprint —
                      </Text>
                      <Text strong style={{ color: '#1677ff', fontSize: 15 }}>
                        {filteredTasks.length} requirements
                      </Text>
                      <Text>sẽ được đưa vào SRS</Text>
                    </Space>
                  }
                  style={{ marginBottom: 24 }}
                />
              )}
            </>
          )}

          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => setStep(0)}>
              Quay lại
            </Button>
            <Button
              type="primary"
              icon={<ArrowRightOutlined />}
              onClick={() => setStep(2)}
              disabled={selectedSprints.length === 0}
            >
              Tiếp theo
            </Button>
          </Space>
        </Card>
      )}

      {/* ── Step 2: Thông tin & Preview ───────────────────────────────────── */}
      {step === 2 && (
        <Row gutter={20} align="top">
          {/* Left: Form + Generate */}
          <Col xs={24} lg={10}>
            <Card style={{ marginBottom: 16 }}>
              <Title level={4} style={{ marginBottom: 20 }}>
                Bước 3: Thông tin dự án
              </Title>

              <Form
                form={form}
                layout="vertical"
                initialValues={projectInfo}
                onValuesChange={(_, all) => setProjectInfo((prev) => ({ ...prev, ...all }))}
              >
                <Form.Item
                  label="Tên dự án"
                  name="name"
                  rules={[{ required: true, message: 'Vui lòng nhập tên dự án' }]}
                >
                  <Input placeholder="VD: Hệ thống quản lý dự án SWP391" size="large" />
                </Form.Item>
                <Form.Item
                  label="Phiên bản"
                  name="version"
                  rules={[{ required: true, message: 'Vui lòng nhập phiên bản' }]}
                >
                  <Input placeholder="VD: 1.0.0" />
                </Form.Item>
                <Form.Item
                  label="Tác giả / Tên nhóm"
                  name="author"
                  rules={[{ required: true, message: 'Vui lòng nhập tác giả' }]}
                >
                  <Input placeholder="VD: Nhóm 5 - SE1234" />
                </Form.Item>
                <Form.Item label="Mô tả ngắn (tuỳ chọn)" name="description">
                  <Input.TextArea placeholder="Mô tả tổng quan về dự án..." rows={3} />
                </Form.Item>
              </Form>

              {/* Summary stats */}
              <div
                style={{
                  background: '#f5f8ff',
                  borderRadius: 8,
                  padding: '16px 20px',
                  marginBottom: 20,
                }}
              >
                <Row gutter={16}>
                  <Col span={8}>
                    <Statistic
                      title="Sprints"
                      value={selectedSprints.length}
                      valueStyle={{ color: '#1677ff', fontSize: 22 }}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="Requirements"
                      value={totalRequirements}
                      valueStyle={{ color: '#52c41a', fontSize: 22 }}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="Sections"
                      value={tasksBySprint.size}
                      valueStyle={{ color: '#722ed1', fontSize: 22 }}
                    />
                  </Col>
                </Row>
              </div>

              {/* Progress bar */}
              {isGenerating && (
                <div style={{ marginBottom: 20 }}>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>
                    {progress < 100 ? 'Đang tạo tài liệu SRS...' : 'Hoàn tất! Đang tải xuống...'}
                  </Text>
                  <Progress
                    percent={progress}
                    status={progress === 100 ? 'success' : 'active'}
                    strokeColor={{ from: '#1677ff', to: '#52c41a' }}
                    strokeWidth={8}
                  />
                </div>
              )}

              <Space>
                <Button
                  icon={<ArrowLeftOutlined />}
                  onClick={() => setStep(1)}
                  disabled={isGenerating}
                >
                  Quay lại
                </Button>
                <Button
                  type="primary"
                  size="large"
                  icon={<DownloadOutlined />}
                  onClick={handleGenerate}
                  loading={isGenerating}
                  disabled={totalRequirements === 0}
                  style={{ background: '#1565C0', borderColor: '#1565C0' }}
                >
                  Generate Word
                </Button>
              </Space>
            </Card>
          </Col>

          {/* Right: Preview panel */}
          <Col xs={24} lg={14}>
            <Card
              title={
                <Space>
                  <EyeOutlined />
                  <Text strong>Preview cấu trúc SRS</Text>
                  <Badge
                    count={totalRequirements}
                    style={{ backgroundColor: '#1677ff' }}
                    overflowCount={999}
                  />
                </Space>
              }
              style={{ position: 'sticky', top: 80 }}
            >
              {previewItems.length === 0 ? (
                <Empty description="Chọn sprint ở bước 2 để xem preview" />
              ) : (
                <>
                  {/* SRS structure outline */}
                  <div
                    style={{
                      background: '#fafafa',
                      border: '1px solid #e8e8e8',
                      borderRadius: 6,
                      padding: '10px 14px',
                      marginBottom: 16,
                      fontSize: 12,
                      color: '#888',
                    }}
                  >
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Cấu trúc tài liệu: &nbsp;
                      <Text code style={{ fontSize: 11 }}>Trang bìa</Text>
                      {' → '}
                      <Text code style={{ fontSize: 11 }}>1. Giới thiệu</Text>
                      {' → '}
                      <Text code style={{ fontSize: 11 }}>2. Tổng quan</Text>
                      {' → '}
                      <Text code style={{ fontSize: 11 }}>3. Yêu cầu chức năng</Text>
                      {' → '}
                      <Text code style={{ fontSize: 11 }}>4. Yêu cầu phi chức năng</Text>
                    </Text>
                  </div>

                  {/* Accordion by sprint */}
                  <Collapse
                    items={previewItems}
                    defaultActiveKey={previewItems[0]?.key ? [previewItems[0].key] : []}
                  />
                </>
              )}
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
}
