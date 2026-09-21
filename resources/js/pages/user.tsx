import React, { useState } from 'react';
import type { PageProps } from '@/types';

export interface UserItem {
  id: number;
  name: string;
  email: string;
  password?: string;
  created_at?: string;
  updated_at?: string;
}

export interface UserPageProps extends PageProps {
  userData?: UserItem[];
}

export default function UserPage({ csrf_token = '', userData = [] }: UserPageProps) {
  const [users, setUsers] = useState<UserItem[]>(userData);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);

  // Form states for Create
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Form states for Edit
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');

  // UI status feedback
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Client-side quick filter
  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || String(u.id).includes(q);
  });

  // Client-side interactive Create
  const handleCreateSubmit = async (e: React.FormEvent) => {
    if (!newName.trim() || !newEmail.trim()) {
      showFeedback('error', 'Name and Email are required.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'x-csrf-token': csrf_token,
        },
        body: JSON.stringify({
          name: newName.trim(),
          email: newEmail.trim(),
          password: newPassword.trim() || 'secret123',
        }),
      });

      if (res.ok) {
        const createdUser: UserItem = await res.json();
        setUsers((prev) => [createdUser, ...prev]);
        setNewName('');
        setNewEmail('');
        setNewPassword('');
        setIsCreating(false);
        showFeedback('success', `User ${createdUser.name} created successfully.`);
      } else {
        const err = await res.json().catch(() => ({}));
        showFeedback('error', err.message || err.error || 'Failed to create user.');
      }
    } catch {
      // Fallback: submit standard HTML form
      (e.target as HTMLFormElement).submit();
    } finally {
      setLoading(false);
    }
  };

  // Client-side interactive Update
  const handleUpdateSubmit = async (e: React.FormEvent) => {
    if (!editingUser) return;
    setLoading(true);

    try {
      const res = await fetch(`/user/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'x-csrf-token': csrf_token,
        },
        body: JSON.stringify({
          name: editName.trim(),
          email: editEmail.trim(),
        }),
      });

      if (res.ok) {
        const updated: UserItem = await res.json();
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)));
        setEditingUser(null);
        showFeedback('success', `User #${updated.id} updated successfully.`);
      } else {
        const err = await res.json().catch(() => ({}));
        showFeedback('error', err.message || err.error || 'Failed to update user.');
      }
    } catch {
      showFeedback('error', 'Network error while updating user.');
    } finally {
      setLoading(false);
    }
  };

  // Client-side interactive Delete
  const handleDelete = async (id: number, name: string) => {

    setLoading(true);
    try {
      const res = await fetch(`/user/${id}`, {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json',
          'x-csrf-token': csrf_token,
        },
      });

      if (res.ok || res.status === 204) {
        setUsers((prev) => prev.filter((u) => u.id !== id));
        showFeedback('success', `User "${name}" removed successfully.`);
      } else {
        showFeedback('error', 'Failed to delete user.');
      }
    } catch {
      showFeedback('error', 'Network error while deleting user.');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (user: UserItem) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase() || 'U';
  };

  return (
    <div className="user-admin-page">
      <style>{`
        .user-admin-page {
          --bg-main: #0b0f19;
          --bg-card: #111827;
          --bg-card-hover: #161f33;
          --bg-input: #1a2234;
          --border: #1f293d;
          --border-focus: #4f46e5;
          --text-primary: #f9fafb;
          --text-secondary: #9ca3af;
          --text-muted: #6b7280;
          --primary: #6366f1;
          --primary-hover: #4f46e5;
          --danger: #ef4444;
          --danger-hover: #dc2626;
          --success: #10b981;
          --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
          --font-mono: 'JetBrains Mono', monospace;

          min-height: 100vh;
          background-color: var(--bg-main);
          color: var(--text-primary);
          font-family: var(--font-sans);
          padding: 2.5rem 1.5rem;
          box-sizing: border-box;
        }

        .user-admin-page * {
          box-sizing: border-box;
        }

        .admin-container {
          max-width: 1100px;
          margin: 0 auto;
        }

        /* Top Header */
        .admin-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 2rem;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .header-title-group h1 {
          font-size: 1.85rem;
          font-weight: 700;
          letter-spacing: -0.025em;
          color: var(--text-primary);
          margin: 0 0 0.25rem 0;
        }

        .header-subtitle {
          color: var(--text-secondary);
          font-size: 0.95rem;
          margin: 0;
        }

        .badge-tag {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.2rem 0.6rem;
          border-radius: 9999px;
          background: rgba(99, 102, 241, 0.15);
          color: #a5b4fc;
          font-size: 0.75rem;
          font-family: var(--font-mono);
          font-weight: 600;
          margin-bottom: 0.5rem;
          border: 1px solid rgba(99, 102, 241, 0.3);
        }

        /* Stats Cards */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .stat-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 0.75rem;
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .stat-label {
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
          font-weight: 600;
        }

        .stat-value {
          font-size: 1.75rem;
          font-weight: 700;
          color: var(--text-primary);
          font-family: var(--font-mono);
        }

        /* Feedback Banner */
        .feedback-banner {
          padding: 0.75rem 1.25rem;
          border-radius: 0.5rem;
          margin-bottom: 1.5rem;
          font-size: 0.9rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          animation: fadeIn 0.2s ease-in-out;
        }

        .feedback-success {
          background: rgba(16, 185, 129, 0.15);
          border: 1px solid rgba(16, 185, 129, 0.3);
          color: #6ee7b7;
        }

        .feedback-error {
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #fca5a5;
        }

        /* Actions Bar */
        .action-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.25rem;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .search-wrapper {
          position: relative;
          flex: 1;
          max-width: 380px;
        }

        .search-input {
          width: 100%;
          background: var(--bg-card);
          border: 1px solid var(--border);
          color: var(--text-primary);
          padding: 0.65rem 1rem 0.65rem 2.4rem;
          border-radius: 0.5rem;
          font-size: 0.9rem;
          outline: none;
          transition: border-color 0.15s ease;
        }

        .search-input:focus {
          border-color: var(--border-focus);
        }

        .search-icon {
          position: absolute;
          left: 0.8rem;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
          pointer-events: none;
        }

        .btn-primary {
          background: var(--primary);
          color: #ffffff;
          border: none;
          padding: 0.65rem 1.25rem;
          border-radius: 0.5rem;
          font-weight: 600;
          font-size: 0.9rem;
          cursor: pointer;
          transition: background 0.15s ease, transform 0.05s ease;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
        }

        .btn-primary:hover {
          background: var(--primary-hover);
        }

        .btn-secondary {
          background: transparent;
          color: var(--text-secondary);
          border: 1px solid var(--border);
          padding: 0.65rem 1rem;
          border-radius: 0.5rem;
          font-weight: 600;
          font-size: 0.9rem;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease;
        }

        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-primary);
        }

        /* Form Card (Create / Edit) */
        .form-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 0.75rem;
          padding: 1.5rem;
          margin-bottom: 2rem;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
        }

        .form-card h2 {
          font-size: 1.25rem;
          font-weight: 600;
          margin: 0 0 1.25rem 0;
          color: var(--text-primary);
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 1rem;
          margin-bottom: 1.25rem;
        }

        .form-field {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .form-field label {
          font-size: 0.85rem;
          font-weight: 500;
          color: var(--text-secondary);
        }

        .form-input {
          background: var(--bg-input);
          border: 1px solid var(--border);
          color: var(--text-primary);
          padding: 0.65rem 0.85rem;
          border-radius: 0.4rem;
          font-size: 0.9rem;
          outline: none;
        }

        .form-input:focus {
          border-color: var(--border-focus);
        }

        .form-actions {
          display: flex;
          gap: 0.75rem;
          justify-content: flex-end;
        }

        /* Users Table */
        .table-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 0.75rem;
          overflow: hidden;
        }

        .users-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }

        .users-table th {
          background: rgba(17, 24, 39, 0.95);
          padding: 0.9rem 1.25rem;
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 1px solid var(--border);
        }

        .users-table td {
          padding: 1rem 1.25rem;
          border-bottom: 1px solid var(--border);
          font-size: 0.9rem;
          color: var(--text-primary);
          vertical-align: middle;
        }

        .users-table tr:last-child td {
          border-bottom: none;
        }

        .users-table tr:hover td {
          background: var(--bg-card-hover);
        }

        .user-identity {
          display: flex;
          align-items: center;
          gap: 0.85rem;
        }

        .avatar {
          width: 36px;
          height: 36px;
          border-radius: 9999px;
          background: linear-gradient(135deg, #6366f1 0%, #4338ca 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          font-weight: 700;
          font-size: 0.85rem;
          flex-shrink: 0;
        }

        .user-name-title {
          font-weight: 600;
          color: var(--text-primary);
        }

        .user-email-text {
          font-size: 0.8rem;
          color: var(--text-secondary);
          font-family: var(--font-mono);
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          padding: 0.15rem 0.55rem;
          border-radius: 0.35rem;
          font-size: 0.75rem;
          font-weight: 600;
          background: rgba(16, 185, 129, 0.1);
          color: #34d399;
          border: 1px solid rgba(16, 185, 129, 0.25);
        }

        .table-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .btn-edit {
          background: transparent;
          border: 1px solid var(--border);
          color: #cbd5e1;
          padding: 0.35rem 0.75rem;
          border-radius: 0.35rem;
          font-size: 0.8rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-edit:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #ffffff;
        }

        .btn-delete {
          background: transparent;
          border: 1px solid rgba(239, 68, 68, 0.2);
          color: #f87171;
          padding: 0.35rem 0.75rem;
          border-radius: 0.35rem;
          font-size: 0.8rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-delete:hover {
          background: rgba(239, 68, 68, 0.15);
          color: #ef4444;
          border-color: var(--danger);
        }

        /* Empty State */
        .empty-state {
          padding: 3.5rem 1.5rem;
          text-align: center;
          color: var(--text-secondary);
        }

        .empty-state h3 {
          font-size: 1.15rem;
          color: var(--text-primary);
          margin: 0.5rem 0;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="admin-container">
        {/* Header */}
        <div className="admin-header">
          <div className="header-title-group">
            <span className="badge-tag">FORGETS ORM / ACTIVE RECORD</span>
            <h1>Users Page</h1>
            <p className="header-subtitle">
              Manage database records with full CRUD operations, React 19 SSR, and CSRF token protection.
            </p>
          </div>
          <div>
            <button
              id="btn-toggle-create"
              className="btn-primary"
              onClick={() => {
                setIsCreating(!isCreating);
                setEditingUser(null);
              }}
            >
              {isCreating ? 'Cancel' : '+ New User'}
            </button>
          </div>
        </div>

        {/* Feedback alert */}
        {feedback && (
          <div className={`feedback-banner feedback-${feedback.type}`}>
            <span>{feedback.message}</span>
            <button
              onClick={() => setFeedback(null)}
              style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}
            >
              ×
            </button>
          </div>
        )}

        {/* Metrics Overview */}
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-label">Total Users</span>
            <span className="stat-value">{users.length}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Database Connection</span>
            <span className="stat-value" style={{ fontSize: '1.25rem' }}>Active Record</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">CSRF Protection</span>
            <span className="stat-value" style={{ fontSize: '1.25rem', color: '#34d399' }}>Enabled</span>
          </div>
        </div>

        {/* Create User Card */}
        {isCreating && (
          <div className="form-card" id="create-user-section">
            <h2>Add New User</h2>
            <form action="/user" method="POST" onSubmit={handleCreateSubmit}>
              <input type="hidden" name="_token" value={csrf_token} />

              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="create-name">Name</label>
                  <input
                    id="create-name"
                    className="form-input"
                    type="text"
                    name="name"
                    placeholder="Jane Doe"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="create-email">Email Address</label>
                  <input
                    id="create-email"
                    className="form-input"
                    type="email"
                    name="email"
                    placeholder="jane@example.com"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="create-password">Password</label>
                  <input
                    id="create-password"
                    className="form-input"
                    type="password"
                    name="password"
                    placeholder="Min. 8 characters"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsCreating(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Edit User Modal / Card */}
        {editingUser && (
          <div className="form-card" id="edit-user-section">
            <h2>Edit User #{editingUser.id}</h2>
            <form action={`/user/${editingUser.id}/update`} method="POST" onSubmit={handleUpdateSubmit}>
              <input type="hidden" name="_token" value={csrf_token} />

              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="edit-name">Name</label>
                  <input
                    id="edit-name"
                    className="form-input"
                    type="text"
                    name="name"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="edit-email">Email Address</label>
                  <input
                    id="edit-email"
                    className="form-input"
                    type="email"
                    name="email"
                    required
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setEditingUser(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Actions Bar & Search */}
        <div className="action-bar">
          <div className="search-wrapper">
            <svg
              className="search-icon"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              id="search-users-input"
              className="search-input"
              type="text"
              placeholder="Search by name, email, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Showing {filteredUsers.length} of {users.length} users
          </span>
        </div>

        {/* Data Table */}
        <div className="table-card">
          {filteredUsers.length === 0 ? (
            <div className="empty-state">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <h3>No users found</h3>
              <p>{searchQuery ? 'Try adjusting your search criteria.' : 'Create your first user above.'}</p>
            </div>
          ) : (
            <table className="users-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>ID</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} id={`user-row-${user.id}`}>
                    <td>
                      <div className="user-identity">
                        <div className="avatar">{getInitials(user.name)}</div>
                        <div>
                          <div className="user-name-title">{user.name}</div>
                          <div className="user-email-text">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                        #{user.id}
                      </span>
                    </td>
                    <td>
                      <span className="status-badge">Active</span>
                    </td>
                    <td>
                      <div className="table-actions" style={{ justifyContent: 'flex-end' }}>
                        <button
                          id={`btn-edit-${user.id}`}
                          className="btn-edit"
                          onClick={() => startEdit(user)}
                        >
                          Edit
                        </button>
                        <form
                          action={`/user/${user.id}/delete`}
                          method="POST"
                          style={{ display: 'inline', margin: 0 }}
                          onSubmit={(e) => {
                            e.preventDefault();
                            handleDelete(user.id, user.name);
                          }}
                        >
                          <input type="hidden" name="_token" value={csrf_token} />
                          <button
                            id={`btn-delete-${user.id}`}
                            type="submit"
                            className="btn-delete"
                          >
                            Delete
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
