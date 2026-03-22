import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Modal, Form, Input, Space, Popconfirm, Tag, message, Select } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, SearchOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../api/adminApi';
import dayjs from 'dayjs';

export default function GroupList() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [filterSemester, setFilterSemester] = useState(null);
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: () => adminApi.getGroups().then((res) => res.data),
  });

  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      const matchSearch = !searchText ||
        g.name?.toLowerCase().includes(searchText.toLowerCase()) ||
        g.description?.toLowerCase().includes(searchText.toLowerCase());
      const matchSemester = !filterSemester || g.semester === filterSemester;
      return matchSearch && matchSemester;
    });
  }, [groups, searchText, filterSemester]);

  const semesters = useMemo(() => {
    const set = new Set(groups.map((g) => g.semester).filter(Boolean));
    return [...set].map((s) => ({ value: s, label: s }));
  }, [groups]);

  const createMutation = useMutation({
    mutationFn: (data) => adminApi.createGroup(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['groups'] }); message.success('Tạo nhóm thành công'); closeModal(); },
    onError: (err) => message.error(err.response?.data?.message || 'Lỗi'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => adminApi.updateGroup(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['groups'] }); message.success('Cập nhật thành công'); closeModal(); },
    onError: (err) => message.error(err.response?.data?.message || 'Lỗi'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => adminApi.deleteGroup(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['groups'] }); message.success('Xóa thành công'); },
    onError: (err) => message.error(err.response?.data?.message || 'Lỗi'),
  });

  const openCreate = () => { setEditingGroup(null); form.resetFields(); setModalOpen(true); };
  const openEdit = (group) => { setEditingGroup(group); form.setFieldsValue(group); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditingGroup(null); form.resetFields(); };

  const onFinish = (values) => {
    if (editingGroup) {
      updateMutation.mutate({ id: editingGroup.id, data: values });
    } else {
      createMutation.mutate(values);
    }
  };

  const columns = [
    { title: 'Tên nhóm', dataIndex: 'name', key: 'name', sorter: (a, b) => a.name.localeCompare(b.name) },
    { title: 'Mô tả', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: 'Học kỳ', dataIndex: 'semester', key: 'semester' },
    {
      title: 'Trạng thái', dataIndex: 'is_active', key: 'is_active',
      render: (val) => <Tag color={val ? 'green' : 'red'}>{val ? 'Active' : 'Inactive'}</Tag>,
    },
    {
      title: 'Ngày tạo', dataIndex: 'created_at', key: 'created_at',
      render: (val) => val ? dayjs(val).format('DD/MM/YYYY') : '-',
      sorter: (a, b) => new Date(a.created_at) - new Date(b.created_at),
    },
    {
      title: 'Thao tác', key: 'actions',
      render: (_, record) => (
        <Space>
          <Button icon={<EyeOutlined />} size="small" onClick={() => navigate(`/admin/groups/${record.id}`)}>Chi tiết</Button>
          <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(record)} />
          <Popconfirm title="Xóa nhóm này?" onConfirm={() => deleteMutation.mutate(record.id)}>
            <Button icon={<DeleteOutlined />} size="small" danger />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Quản lý nhóm</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Tạo nhóm</Button>
      </div>

      <Space style={{ marginBottom: 16 }} wrap>
        <Input
          placeholder="Tìm kiếm nhóm..."
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: 260 }}
          allowClear
        />
        <Select
          placeholder="Lọc theo học kỳ"
          options={semesters}
          value={filterSemester}
          onChange={setFilterSemester}
          allowClear
          style={{ width: 180 }}
        />
      </Space>

      <Table dataSource={filteredGroups} columns={columns} rowKey="id" loading={isLoading} />

      <Modal
        title={editingGroup ? 'Chỉnh sửa nhóm' : 'Tạo nhóm mới'}
        open={modalOpen}
        onCancel={closeModal}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="name" label="Tên nhóm" rules={[{ required: true, message: 'Nhập tên nhóm' }]}>
            <Input placeholder="VD: Nhóm 1" />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={3} placeholder="Mô tả nhóm" />
          </Form.Item>
          <Form.Item name="semester" label="Học kỳ">
            <Input placeholder="VD: SP25" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
