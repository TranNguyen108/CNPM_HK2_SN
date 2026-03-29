import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tabs, Table, Button, Modal, Form, Input, Select, Space, Popconfirm, Tag, message, Alert, Spin, Descriptions, Card, Typography, List, Empty } from 'antd';
import { PlusOutlined, DeleteOutlined, ArrowLeftOutlined, LinkOutlined, GithubOutlined, AppstoreOutlined, FileWordOutlined, EyeOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../api/adminApi';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;

// ===== MEMBERS TAB =====
function MembersTab({ groupId }) {
  const [addOpen, setAddOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [form] = Form.useForm();
  const [assignForm] = Form.useForm();
  const queryClient = useQueryClient();

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['members', groupId],
    queryFn: () => adminApi.getMembers(groupId).then((r) => r.data),
  });

  const { data: lecturers = [] } = useQuery({
    queryKey: ['lecturers'],
    queryFn: () => adminApi.getLecturers().then((r) => r.data),
  });

  const { data: searchedUsers = [] } = useQuery({
    queryKey: ['searchUsers', userSearch],
    queryFn: () => adminApi.searchUsers(userSearch).then((r) => r.data),
    enabled: userSearch.length >= 2,
  });

  const addMutation = useMutation({
    mutationFn: (data) => adminApi.addMember(groupId, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['members', groupId] }); message.success('Thêm thành viên thành công'); setAddOpen(false); form.resetFields(); setUserSearch(''); },
    onError: (err) => message.error(err.response?.data?.message || 'Lỗi'),
  });

  const removeMutation = useMutation({
    mutationFn: (userId) => adminApi.removeMember(groupId, userId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['members', groupId] }); message.success('Xóa thành viên thành công'); },
    onError: (err) => message.error(err.response?.data?.message || 'Lỗi'),
  });

  const assignMutation = useMutation({
    mutationFn: (data) => adminApi.assignLecturer(groupId, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['members', groupId] }); message.success('Gán giảng viên thành công'); setAssignOpen(false); assignForm.resetFields(); },
    onError: (err) => message.error(err.response?.data?.message || 'Lỗi'),
  });

  const columns = [
    { title: 'User ID', dataIndex: 'user_id', key: 'user_id', ellipsis: true },
    {
      title: 'Vai trò', dataIndex: 'role_in_group', key: 'role_in_group',
      render: (role) => {
        const colors = { LEADER: 'blue', MEMBER: 'green', VIEWER: 'orange' };
        return <Tag color={colors[role]}>{role}</Tag>;
      },
    },
    {
      title: 'Ngày tham gia', dataIndex: 'joined_at', key: 'joined_at',
      render: (val) => val ? dayjs(val).format('DD/MM/YYYY HH:mm') : '-',
    },
    {
      title: 'Thao tác', key: 'actions',
      render: (_, record) => (
        <Popconfirm title="Xóa thành viên này?" onConfirm={() => removeMutation.mutate(record.user_id)}>
          <Button icon={<DeleteOutlined />} size="small" danger />
        </Popconfirm>
      ),
    },
  ];

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>Thêm thành viên</Button>
        <Button icon={<PlusOutlined />} onClick={() => setAssignOpen(true)}>Gán giảng viên</Button>
      </Space>

      <Table dataSource={members} columns={columns} rowKey="id" loading={isLoading} />

      <Modal title="Thêm thành viên" open={addOpen} onCancel={() => { setAddOpen(false); setUserSearch(''); }} onOk={() => form.submit()} confirmLoading={addMutation.isPending}>
        <Form form={form} layout="vertical" onFinish={(v) => addMutation.mutate(v)}>
          <Form.Item name="user_id" label="Tìm người dùng" rules={[{ required: true, message: 'Chọn người dùng' }]}>
            <Select
              showSearch
              placeholder="Tìm theo email hoặc tên..."
              filterOption={false}
              onSearch={(v) => setUserSearch(v)}
              options={searchedUsers.map((u) => ({ value: u.id, label: `${u.full_name} (${u.email}) - ${u.role}` }))}
              notFoundContent={userSearch.length < 2 ? 'Nhập ít nhất 2 ký tự' : 'Không tìm thấy'}
            />
          </Form.Item>
          <Form.Item name="role_in_group" label="Vai trò" initialValue="MEMBER">
            <Select options={[{ value: 'LEADER', label: 'Leader' }, { value: 'MEMBER', label: 'Member' }, { value: 'VIEWER', label: 'Viewer' }]} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="Gán giảng viên" open={assignOpen} onCancel={() => setAssignOpen(false)} onOk={() => assignForm.submit()} confirmLoading={assignMutation.isPending}>
        <Form form={assignForm} layout="vertical" onFinish={(v) => assignMutation.mutate(v)}>
          <Form.Item name="lecturer_id" label="Chọn giảng viên" rules={[{ required: true, message: 'Chọn giảng viên' }]}>
            <Select
              placeholder="Chọn giảng viên"
              showSearch
              optionFilterProp="label"
              options={lecturers.map((l) => ({ value: l.id, label: `${l.full_name} (${l.email})` }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

// ===== JIRA CONFIG TAB =====
function JiraConfigTab({ groupId }) {
  const [form] = Form.useForm();
  const [testResult, setTestResult] = useState(null);

  const { data: existingConfig, isLoading: configLoading } = useQuery({
    queryKey: ['jiraConfig', groupId],
    queryFn: () => adminApi.getJiraConfig(groupId).then((r) => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => adminApi.saveJiraConfig(groupId, data),
    onSuccess: () => message.success('Lưu cấu hình Jira thành công'),
    onError: (err) => message.error(err.response?.data?.message || 'Lỗi'),
  });

  const testMutation = useMutation({
    mutationFn: () => adminApi.testJira(groupId),
    onSuccess: (res) => setTestResult(res.data),
    onError: (err) => setTestResult({ success: false, message: err.response?.data?.message || 'Lỗi kết nối' }),
  });

  if (configLoading) return <Spin />;

  return (
    <>
      {existingConfig && (
        <Descriptions size="small" bordered style={{ marginBottom: 16 }} column={1}>
          <Descriptions.Item label="Domain">{existingConfig.jira_domain}</Descriptions.Item>
          <Descriptions.Item label="Project Key">{existingConfig.project_key}</Descriptions.Item>
          <Descriptions.Item label="Trạng thái">
            <Tag color={existingConfig.is_active ? 'green' : 'red'}>{existingConfig.is_active ? 'Active' : 'Inactive'}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Đồng bộ lần cuối">
            {existingConfig.last_synced_at ? dayjs(existingConfig.last_synced_at).format('DD/MM/YYYY HH:mm') : 'Chưa đồng bộ'}
          </Descriptions.Item>
        </Descriptions>
      )}
      <Form
        form={form}
        layout="vertical"
        onFinish={(v) => saveMutation.mutate(v)}
        style={{ maxWidth: 500 }}
        initialValues={existingConfig ? { jira_domain: existingConfig.jira_domain, project_key: existingConfig.project_key } : {}}
      >
        <Form.Item name="jira_domain" label="Jira Domain" rules={[{ required: true, message: 'Nhập Jira domain' }]}>
          <Input placeholder="your-domain.atlassian.net" />
        </Form.Item>
        <Form.Item name="project_key" label="Project Key" rules={[{ required: true, message: 'Nhập project key' }]}>
          <Input placeholder="VD: SWP391" />
        </Form.Item>
        <Form.Item name="access_token" label="Access Token" rules={[{ required: true, message: 'Nhập access token' }]}>
          <Input.Password placeholder="Jira API token" />
        </Form.Item>
        <Space>
          <Button type="primary" htmlType="submit" loading={saveMutation.isPending} icon={<LinkOutlined />}>Lưu cấu hình</Button>
          <Button onClick={() => testMutation.mutate()} loading={testMutation.isPending}>Test kết nối</Button>
        </Space>
        {testResult && (
          <Alert
            style={{ marginTop: 16 }}
            type={testResult.success ? 'success' : 'error'}
            message={testResult.message}
            showIcon
          />
        )}
      </Form>
    </>
  );
}

// ===== GITHUB CONFIG TAB =====
function GithubConfigTab({ groupId }) {
  const [form] = Form.useForm();
  const [testResult, setTestResult] = useState(null);

  const { data: existingConfig, isLoading: configLoading } = useQuery({
    queryKey: ['githubConfig', groupId],
    queryFn: () => adminApi.getGithubConfig(groupId).then((r) => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => adminApi.saveGithubConfig(groupId, data),
    onSuccess: () => message.success('Lưu cấu hình GitHub thành công'),
    onError: (err) => message.error(err.response?.data?.message || 'Lỗi'),
  });

  const testMutation = useMutation({
    mutationFn: () => adminApi.testGithub(groupId),
    onSuccess: (res) => setTestResult(res.data),
    onError: (err) => setTestResult({ success: false, message: err.response?.data?.message || 'Lỗi kết nối' }),
  });

  if (configLoading) return <Spin />;

  return (
    <>
      {existingConfig && (
        <Descriptions size="small" bordered style={{ marginBottom: 16 }} column={1}>
          <Descriptions.Item label="Owner">{existingConfig.repo_owner}</Descriptions.Item>
          <Descriptions.Item label="Repository">{existingConfig.repo_name}</Descriptions.Item>
          <Descriptions.Item label="Trạng thái">
            <Tag color={existingConfig.is_active ? 'green' : 'red'}>{existingConfig.is_active ? 'Active' : 'Inactive'}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Đồng bộ lần cuối">
            {existingConfig.last_synced_at ? dayjs(existingConfig.last_synced_at).format('DD/MM/YYYY HH:mm') : 'Chưa đồng bộ'}
          </Descriptions.Item>
        </Descriptions>
      )}
      <Form
        form={form}
        layout="vertical"
        onFinish={(v) => saveMutation.mutate(v)}
        style={{ maxWidth: 500 }}
        initialValues={existingConfig ? { repo_owner: existingConfig.repo_owner, repo_name: existingConfig.repo_name } : {}}
      >
        <Form.Item name="repo_owner" label="Repository Owner" rules={[{ required: true, message: 'Nhập repo owner' }]}>
          <Input placeholder="VD: TranNguyen108" />
        </Form.Item>
        <Form.Item name="repo_name" label="Repository Name" rules={[{ required: true, message: 'Nhập repo name' }]}>
          <Input placeholder="VD: CNPM_HK2_SN" />
        </Form.Item>
        <Form.Item name="access_token" label="Access Token" rules={[{ required: true, message: 'Nhập access token' }]}>
          <Input.Password placeholder="GitHub personal access token" />
        </Form.Item>
        <Space>
          <Button type="primary" htmlType="submit" loading={saveMutation.isPending} icon={<GithubOutlined />}>Lưu cấu hình</Button>
          <Button onClick={() => testMutation.mutate()} loading={testMutation.isPending}>Test kết nối</Button>
        </Space>
        {testResult && (
          <Alert
            style={{ marginTop: 16 }}
            type={testResult.success ? 'success' : 'error'}
            message={testResult.message}
            showIcon
          />
        )}
      </Form>
    </>
  );
}

function SRSTab({ groupId, group }) {
  const [projectName, setProjectName] = useState(group?.name || '');
  const [version, setVersion] = useState('1.0');
  const [selectedEpicIds, setSelectedEpicIds] = useState([]);

  useEffect(() => {
    setProjectName(group?.name || '');
  }, [group?.name]);

  const previewParams = useMemo(() => ({
    projectName: projectName || group?.name || '',
    version: version || '1.0',
    epicIds: selectedEpicIds.length ? selectedEpicIds.join(',') : undefined,
  }), [group?.name, projectName, selectedEpicIds, version]);

  const { data: previewData, isLoading, isFetching } = useQuery({
    queryKey: ['srsPreview', groupId, previewParams],
    queryFn: () => adminApi.previewSrs(groupId, previewParams).then((r) => r.data),
    enabled: Boolean(groupId),
  });

  useEffect(() => {
    if (!previewData?.epicOptions?.length) return;
    if (selectedEpicIds.length) return;
    setSelectedEpicIds(previewData.epicOptions.map((epic) => epic.id));
  }, [previewData, selectedEpicIds.length]);

  const generateMutation = useMutation({
    mutationFn: () => adminApi.generateSrs({
      groupId,
      epicIds: selectedEpicIds,
      projectName: projectName || group?.name || '',
      version: version || '1.0',
    }),
    onSuccess: (response) => {
      const contentDisposition = response.headers['content-disposition'] || '';
      const matchedName = contentDisposition.match(/filename="([^"]+)"/i);
      const filename = matchedName?.[1] || `srs-${groupId}.docx`;
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(blobUrl);
      message.success('Đã tạo file SRS thành công');
    },
    onError: (err) => {
      const reader = new FileReader();
      const blob = err.response?.data;

      if (blob instanceof Blob) {
        reader.onload = () => {
          try {
            const parsed = JSON.parse(reader.result);
            message.error(parsed.message || 'Không thể tạo file SRS');
          } catch {
            message.error('Không thể tạo file SRS');
          }
        };
        reader.readAsText(blob);
        return;
      }

      message.error(err.response?.data?.message || 'Không thể tạo file SRS');
    },
  });

  const epicOptions = previewData?.epicOptions || [];
  const document = previewData?.document;

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Title level={4} style={{ margin: 0 }}>SRS Generator</Title>
          <Text type="secondary">Chọn các epic muốn đưa vào tài liệu SRS, xem preview và xuất file Word theo mẫu chuẩn.</Text>
          <Space wrap style={{ width: '100%' }}>
            <Input
              style={{ width: 260 }}
              placeholder="Tên dự án"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
            />
            <Input
              style={{ width: 120 }}
              placeholder="Version"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
            />
            <Select
              mode="multiple"
              allowClear
              style={{ minWidth: 420 }}
              placeholder="Chọn epic để đưa vào SRS"
              value={selectedEpicIds}
              onChange={setSelectedEpicIds}
              options={epicOptions.map((epic) => ({
                value: epic.id,
                label: `${epic.jiraKey} - ${epic.title}`,
              }))}
              optionFilterProp="label"
            />
            <Button
              icon={<FileWordOutlined />}
              type="primary"
              onClick={() => generateMutation.mutate()}
              loading={generateMutation.isPending}
              disabled={!epicOptions.length}
            >
              Xuất .docx
            </Button>
          </Space>
          {!epicOptions.length && !isLoading && (
            <Alert
              type="warning"
              showIcon
              message="Chưa có epic trong dữ liệu đồng bộ Jira"
              description="Hãy đồng bộ Jira lại để hệ thống lưu thêm issue type và epic trước khi tạo SRS."
            />
          )}
        </Space>
      </Card>

      <Card
        title={<Space><EyeOutlined /><span>Preview</span></Space>}
        extra={isFetching ? <Text type="secondary">Đang cập nhật...</Text> : null}
      >
        {isLoading ? (
          <Spin />
        ) : !document ? (
          <Empty description="Không có dữ liệu preview" />
        ) : (
          <Space direction="vertical" size={20} style={{ width: '100%' }}>
            <Card size="small" title="1. Giới thiệu">
              <Paragraph><Text strong>Mục đích:</Text> {document.introduction.purpose}</Paragraph>
              <Paragraph><Text strong>Phạm vi:</Text> {document.introduction.scope}</Paragraph>
              <Paragraph><Text strong>Tài liệu tham chiếu:</Text> {(document.introduction.references || []).join(', ')}</Paragraph>
            </Card>

            <Card size="small" title="2. Mô tả tổng quan">
              <Paragraph><Text strong>Góc nhìn sản phẩm:</Text> {document.overallDescription.productPerspective}</Paragraph>
              <Paragraph><Text strong>Nhóm người dùng:</Text> {(document.overallDescription.userClasses || []).join(', ')}</Paragraph>
              <List
                size="small"
                header="Giả định"
                dataSource={document.overallDescription.assumptions || []}
                renderItem={(item) => <List.Item>{item}</List.Item>}
              />
            </Card>

            <Card size="small" title="3. Yêu cầu chức năng">
              <Space direction="vertical" style={{ width: '100%' }} size={16}>
                {(document.sections || []).map((section) => (
                  <Card
                    key={section.epicKey}
                    type="inner"
                    title={`${section.epicKey} - ${section.title}`}
                  >
                    <Paragraph>{section.summary}</Paragraph>
                    <Table
                      size="small"
                      pagination={false}
                      rowKey="jiraKey"
                      dataSource={section.stories || []}
                      columns={[
                        { title: 'Story', dataIndex: 'jiraKey', key: 'jiraKey', width: 120 },
                        { title: 'Tiêu đề', dataIndex: 'title', key: 'title' },
                        { title: 'Issue type', dataIndex: 'issueType', key: 'issueType', width: 120 },
                        {
                          title: 'Story points',
                          dataIndex: 'storyPoints',
                          key: 'storyPoints',
                          width: 120,
                          render: (value) => value ?? 'N/A',
                        },
                        {
                          title: 'Priority',
                          dataIndex: 'priority',
                          key: 'priority',
                          width: 110,
                          render: (value) => {
                            const colors = { Critical: 'red', High: 'volcano', Medium: 'gold', Low: 'green' };
                            return <Tag color={colors[value] || 'blue'}>{value}</Tag>;
                          }
                        }
                      ]}
                    />
                  </Card>
                ))}
              </Space>
            </Card>

            <Card size="small" title="4. Yêu cầu phi chức năng">
              <List
                size="small"
                dataSource={document.nonFunctionalRequirements || []}
                renderItem={(item) => <List.Item>{item}</List.Item>}
              />
            </Card>

            <Card size="small" title="5. Use case summary">
              <Space direction="vertical" style={{ width: '100%' }} size={12}>
                {(document.useCaseSummary || []).map((item) => (
                  <Card key={item.epicKey} type="inner" title={`${item.epicKey} - ${item.epicTitle}`}>
                    <Paragraph><Text strong>Actors:</Text> {(item.actors || []).join(', ')}</Paragraph>
                    <List
                      size="small"
                      dataSource={item.useCases || []}
                      renderItem={(useCase) => <List.Item>{useCase}</List.Item>}
                    />
                  </Card>
                ))}
              </Space>
            </Card>
          </Space>
        )}
      </Card>
    </Space>
  );
}

// ===== MAIN PAGE =====
export default function GroupDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: group, isLoading } = useQuery({
    queryKey: ['group', id],
    queryFn: () => adminApi.getGroup(id).then((r) => r.data),
  });

  if (isLoading) return <Spin />;

  const tabItems = [
    { key: 'members', label: 'Thành viên', children: <MembersTab groupId={id} /> },
    { key: 'jira', label: 'Jira', children: <JiraConfigTab groupId={id} /> },
    { key: 'github', label: 'GitHub', children: <GithubConfigTab groupId={id} /> },
    { key: 'srs', label: 'SRS', children: <SRSTab groupId={id} group={group} /> },
  ];

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/groups')}>Quay lại</Button>
        <h2 style={{ margin: 0 }}>{group?.name || 'Chi tiết nhóm'}</h2>
        {group?.semester && <Tag>{group.semester}</Tag>}
        <Button
          type="primary"
          ghost
          icon={<AppstoreOutlined />}
          onClick={() => navigate(`/board/${id}`)}
        >
          Mở Kanban Board
        </Button>
      </Space>
      {group?.description && (
        <p style={{ color: '#666', marginBottom: 16 }}>{group.description}</p>
      )}
      <Tabs items={tabItems} />
    </>
  );
}
