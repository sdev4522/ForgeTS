import React, { useState } from 'react';
import type { PageProps } from '@/types';
import "./style.css";
export interface UserItem {
  id: number;
  name: string;
  email: string;
  created_at?: string;
  updated_at?: string;
}

export interface UserPageProps extends PageProps {
  userData?: UserItem[];
}

export default function UserPage({
  csrf_token = '',
  userData = [],
}: UserPageProps) {
  const [users, setUsers] = useState<UserItem[]>(userData);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);

  // Create form state
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');

  // UI feedback
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const [loading, setLoading] = useState(false);

  const showFeedback = (
    type: 'success' | 'error',
    message: string,
  ) => {
    setFeedback({ type, message });

    setTimeout(() => {
      setFeedback(null);
    }, 4000);
  };

  const filteredUsers = users.filter((user) => {
    const query = searchQuery.toLowerCase();

    return (
      user.name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      String(user.id).includes(query)
    );
  });

  // ------------------------------------------------------------
  // CREATE
  // ------------------------------------------------------------

  const handleCreateSubmit = async (
    e: React.FormEvent<HTMLFormElement>,
  ) => {
    e.preventDefault();

    if (!newName.trim() || !newEmail.trim()) {
      showFeedback('error', 'Name and Email are required.');
      return;
    }

    if (!newPassword.trim()) {
      showFeedback('error', 'Password is required.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'x-csrf-token': csrf_token,
        },
        body: JSON.stringify({
          name: newName.trim(),
          email: newEmail.trim(),
          password: newPassword.trim(),
        }),
      });

      if (!response.ok) {
        const errorBody = await response
          .json()
          .catch(() => ({}));

        const message =
          typeof errorBody?.message === 'string'
            ? errorBody.message
            : typeof errorBody?.error === 'string'
              ? errorBody.error
              : 'Failed to create user.';

        showFeedback('error', message);
        return;
      }

      const createdUser: UserItem = await response.json();

      setUsers((previousUsers) => [
        createdUser,
        ...previousUsers,
      ]);

      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setIsCreating(false);

      showFeedback(
        'success',
        `User ${createdUser.name} created successfully.`,
      );
    } catch {
      showFeedback(
        'error',
        'Network error while creating user.',
      );
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------
  // UPDATE
  // ------------------------------------------------------------

  const handleUpdateSubmit = async (
    e: React.FormEvent<HTMLFormElement>,
  ) => {
    e.preventDefault();

    if (!editingUser) {
      return;
    }

    if (!editName.trim() || !editEmail.trim()) {
      showFeedback('error', 'Name and Email are required.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `/user/${editingUser.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'x-csrf-token': csrf_token,
          },
          body: JSON.stringify({
            name: editName.trim(),
            email: editEmail.trim(),
          }),
        },
      );

      if (!response.ok) {
        const errorBody = await response
          .json()
          .catch(() => ({}));

        const message =
          typeof errorBody?.message === 'string'
            ? errorBody.message
            : typeof errorBody?.error === 'string'
              ? errorBody.error
              : 'Failed to update user.';

        showFeedback('error', message);
        return;
      }

      const updatedUser: UserItem = await response.json();

      setUsers((previousUsers) =>
        previousUsers.map((user) =>
          user.id === updatedUser.id
            ? { ...user, ...updatedUser }
            : user,
        ),
      );

      setEditingUser(null);
      setEditName('');
      setEditEmail('');

      showFeedback(
        'success',
        `User #${updatedUser.id} updated successfully.`,
      );
    } catch {
      showFeedback(
        'error',
        'Network error while updating user.',
      );
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------
  // DELETE
  // ------------------------------------------------------------

  const handleDelete = async (
    id: number,
    name: string,
  ) => {
    setLoading(true);

    try {
      const response = await fetch(`/user/${id}`, {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          'x-csrf-token': csrf_token,
        },
      });

      if (!response.ok && response.status !== 204) {
        const errorBody = await response
          .json()
          .catch(() => ({}));

        const message =
          typeof errorBody?.message === 'string'
            ? errorBody.message
            : typeof errorBody?.error === 'string'
              ? errorBody.error
              : 'Failed to delete user.';

        showFeedback('error', message);
        return;
      }

      setUsers((previousUsers) =>
        previousUsers.filter((user) => user.id !== id),
      );

      if (editingUser?.id === id) {
        setEditingUser(null);
        setEditName('');
        setEditEmail('');
      }

      showFeedback(
        'success',
        `User "${name}" removed successfully.`,
      );
    } catch {
      showFeedback(
        'error',
        'Network error while deleting user.',
      );
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------
  // EDIT
  // ------------------------------------------------------------

  const startEdit = (user: UserItem) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setIsCreating(false);
  };

  // ------------------------------------------------------------
  // HELPERS
  // ------------------------------------------------------------

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);

    if (parts.length >= 2) {
      const first = parts[0]?.[0] ?? '';
      const second = parts[1]?.[0] ?? '';

      return `${first}${second}`.toUpperCase();
    }

    return name.slice(0, 2).toUpperCase() || 'U';
  };

  return (
    <div className="user-admin-page">

      <button
        id="btn-toggle-create"
        type="button"
        className="btn-primary"
        onClick={() => {
          window.location.href = "/";
        }}
      >
        Back to Home
      </button>
      <div className="admin-container">
        {/* Header */}
        <div className="admin-header">
          <div className="header-title-group">
            <span className="badge-tag">
              FORGETS ORM / ACTIVE RECORD
            </span>

            <h1>Users Page</h1>

            <p className="header-subtitle">
              Manage database records with full CRUD operations,
              React 19 SSR, and CSRF token protection.
            </p>
          </div>

          <div>
            <button
              id="btn-toggle-create"
              type="button"
              className="btn-primary"
              onClick={() => {
                setIsCreating((current) => !current);
                setEditingUser(null);
              }}
            >
              {isCreating ? 'Cancel' : '+ New User'}
            </button>
          </div>
        </div>

        {/* Feedback */}
        {feedback && (
          <div
            className={`feedback-banner feedback-${feedback.type}`}
          >
            <span>{feedback.message}</span>

            <button
              type="button"
              onClick={() => setFeedback(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
              }}
            >
              ×
            </button>
          </div>
        )}

        {/* Metrics */}
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-label">
              Total Users
            </span>

            <span className="stat-value">
              {users.length}
            </span>
          </div>

          <div className="stat-card">
            <span className="stat-label">
              Database Connection
            </span>

            <span
              className="stat-value"
              style={{ fontSize: '1.25rem' }}
            >
              Active Record
            </span>
          </div>

          <div className="stat-card">
            <span className="stat-label">
              CSRF Protection
            </span>

            <span
              className="stat-value"
              style={{
                fontSize: '1.25rem',
                color: '#34d399',
              }}
            >
              Enabled
            </span>
          </div>
        </div>

        {/* Create User */}
        {isCreating && (
          <div
            className="form-card"
            id="create-user-section"
          >
            <h2>Add New User</h2>

            <form onSubmit={handleCreateSubmit}>
              <input
                type="hidden"
                name="_token"
                value={csrf_token}
              />

              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="create-name">
                    Name
                  </label>

                  <input
                    id="create-name"
                    className="form-input"
                    type="text"
                    name="name"
                    placeholder="Jane Doe"
                    required
                    value={newName}
                    onChange={(event) =>
                      setNewName(event.target.value)
                    }
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="create-email">
                    Email Address
                  </label>

                  <input
                    id="create-email"
                    className="form-input"
                    type="email"
                    name="email"
                    placeholder="jane@example.com"
                    required
                    value={newEmail}
                    onChange={(event) =>
                      setNewEmail(event.target.value)
                    }
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="create-password">
                    Password
                  </label>

                  <input
                    id="create-password"
                    className="form-input"
                    type="password"
                    name="password"
                    placeholder="Min. 8 characters"
                    required
                    value={newPassword}
                    onChange={(event) =>
                      setNewPassword(event.target.value)
                    }
                  />
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setIsCreating(false);
                    setNewName('');
                    setNewEmail('');
                    setNewPassword('');
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading}
                >
                  {loading
                    ? 'Creating...'
                    : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Edit User */}
        {editingUser && (
          <div
            className="form-card"
            id="edit-user-section"
          >
            <h2>
              Edit User #{editingUser.id}
            </h2>

            <form onSubmit={handleUpdateSubmit}>
              <input
                type="hidden"
                name="_token"
                value={csrf_token}
              />

              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="edit-name">
                    Name
                  </label>

                  <input
                    id="edit-name"
                    className="form-input"
                    type="text"
                    name="name"
                    required
                    value={editName}
                    onChange={(event) =>
                      setEditName(event.target.value)
                    }
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="edit-email">
                    Email Address
                  </label>

                  <input
                    id="edit-email"
                    className="form-input"
                    type="email"
                    name="email"
                    required
                    value={editEmail}
                    onChange={(event) =>
                      setEditEmail(event.target.value)
                    }
                  />
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setEditingUser(null);
                    setEditName('');
                    setEditEmail('');
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading}
                >
                  {loading
                    ? 'Saving...'
                    : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Search */}
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
              <circle
                cx="11"
                cy="11"
                r="8"
              />

              <line
                x1="21"
                y1="21"
                x2="16.65"
                y2="16.65"
              />
            </svg>

            <input
              id="search-users-input"
              className="search-input"
              type="text"
              placeholder="Search by name, email, or ID..."
              value={searchQuery}
              onChange={(event) =>
                setSearchQuery(event.target.value)
              }
            />
          </div>

          <span
            style={{
              fontSize: '0.85rem',
              color: 'var(--text-muted)',
            }}
          >
            Showing {filteredUsers.length} of{' '}
            {users.length} users
          </span>
        </div>

        {/* Users Table */}
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
                style={{
                  color: 'var(--text-muted)',
                  marginBottom: '0.5rem',
                }}
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle
                  cx="9"
                  cy="7"
                  r="4"
                />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>

              <h3>No users found</h3>

              <p>
                {searchQuery
                  ? 'Try adjusting your search criteria.'
                  : 'Create your first user above.'}
              </p>
            </div>
          ) : (
            <table className="users-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>ID</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    id={`user-row-${user.id}`}
                  >
                    <td>
                      <div className="user-identity">
                        <div className="avatar">
                          {getInitials(user.name)}
                        </div>

                        <div>
                          <div className="user-name-title">
                            {user.name}
                          </div>

                          <div className="user-email-text">
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span
                        style={{
                          fontFamily:
                            'var(--font-mono)',
                          color:
                            'var(--text-muted)',
                        }}
                      >
                        #{user.id}
                      </span>
                    </td>

                    <td>
                      <span className="status-badge">
                        Active
                      </span>
                    </td>

                    <td>
                      <div
                        className="table-actions"
                        style={{
                          justifyContent: 'flex-end',
                        }}
                      >
                        <button
                          id={`btn-edit-${user.id}`}
                          type="button"
                          className="btn-edit"
                          disabled={loading}
                          onClick={() =>
                            startEdit(user)
                          }
                        >
                          Edit
                        </button>

                        <button
                          id={`btn-delete-${user.id}`}
                          type="button"
                          className="btn-delete"
                          disabled={loading}
                          onClick={() =>
                            handleDelete(
                              user.id,
                              user.name,
                            )
                          }
                        >
                          Delete
                        </button>
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