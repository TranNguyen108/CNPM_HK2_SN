import { useState } from 'react';
import { Table, Button, Modal, Form, Input, Space, Popconfirm, Tag, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../api/adminApi';
import dayjs from 'dayjs';

export default function LecturerList() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data: lecturers = [], isLoading } = useQuery({
    queryKey: ['lecturers'],
    queryFn: () => adminApi.getLecturers().then((res) => res.data),
  });

  const createMutation = useMutation({
    mutationFn: (data) => adminApi.createLecturer(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['lecturers'] }); message.success('Tạo giảng viên thành công'); closeModal(); },
    onError: (err) => message.error(err.response?.data?.message || 'Lỗi'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => adminApi.updateLecturer(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['lecturers'] }); message.success('Cập nhật thành công'); closeModal(); },
    onError: (err) => message.error(err.response?.data?.message || 'Lỗi'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => adminApi.deleteLecturer(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['lecturers'] }); message.success('Xóa thành công'); },
    onError: (err) => message.error(err.response?.data?.message || 'Lỗi'),
  });

  const openCreate = () => { setEditing(null); form.resetFields(); setModalOpen(true); };
  const openEdit = (lecturer) => {
    setEditing(lecturer);
    form.setFieldsValue({ email: lecturer.email, fullName: lecturer.full_name });
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setEditing(null); form.resetFields(); };

  const onFinish = (values) => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: { email: values.email, fullName: values.fullName } });
    } else {
      createMutation.mutate(values);
    }
  };

  const columns = [
    { title: 'Họ tên', dataIndex: 'full_name', key: 'full_name' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    {
      title: 'Trạng thái', dataIndex: 'is_active', key: 'is_active',
      render: (val) => <Tag color={val ? 'green' : 'red'}>{val ? 'Active' : 'Inactive'}</Tag>,
    },
    {
      title: 'Ngày tạo', dataIndex: 'created_at', key: 'created_at',
      render: (val) => val ? dayjs(val).format('DD/MM/YYYY') : '-',
    },
    {
      title: 'Thao tác', key: 'actions',
      render: (_, record) => (
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(record)} />
          <Popconfirm title="Xóa giảng viên này?" onConfirm={() => deleteMutation.mutate(record.id)}>
            <Button icon={<DeleteOutlined />} size="small" danger />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Quản lý giảng viên</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Tạo giảng viên</Button>
      </div>

      <Table dataSource={lecturers} columns={columns} rowKey="id" loading={isLoading} />

      <Modal
        title={editing ? 'Chỉnh sửa giảng viên' : 'Tạo giảng viên mới'}
        open={modalOpen}
        onCancel={closeModal}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="fullName" label="Họ tên" rules={[{ required: true, message: 'Nhập họ tên' }]}>
            <Input placeholder="Họ và tên giảng viên" />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: 'Nhập email hợp lệ' }]}>
            <Input placeholder="Email" />
          </Form.Item>
          {!editing && (
            <Form.Item name="password" label="Mật khẩu" extra="Mặc định: 123456">
              <Input.Password placeholder="Mật khẩu (tùy chọn)" />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </>
  );
}
