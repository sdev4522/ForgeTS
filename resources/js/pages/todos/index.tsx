// resources/js/pages/todos/index.tsx
// ─────────────────────────────────────────────────────────────────────
// React SSR Page Component for Todo Application.
// Placed cleanly inside resources/js/pages/.
// ─────────────────────────────────────────────────────────────────────

import React from 'react';

export interface TodoItem {
  id: number;
  title: string;
  completed: number | boolean;
}

export interface TodoPageProps {
  todos: TodoItem[];
  csrf_token?: string;
}

export default function TodoPage({ todos = [], csrf_token = '' }: TodoPageProps) {
  return (
    <div className="container">
      {/* Header */}
      <div className="header">
        <div className="logo">
          <span>Forge</span>TS (React SSR)
        </div>
        <div className="badge">
          <span className="dot"></span> React 19 SSR Enabled
        </div>
      </div>

      {/* Create Todo Card */}
      <div className="card">
        <form action="/todos/create" method="POST" className="form-group">
          {csrf_token && <input type="hidden" name="_token" value={csrf_token} />}
          <input
            type="text"
            name="title"
            placeholder="Add a new task via React SSR..."
            required
            autoFocus
          />
          <button type="submit">+ Add Task</button>
        </form>
      </div>

      {/* Todo List Card */}
      <div className="card">
        <div className="todo-list">
          {todos.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: '20px' }}>
              No tasks yet! Add your first task above.
            </div>
          ) : (
            todos.map((todo) => {
              const isDone = Boolean(todo.completed);
              return (
                <div className="todo-item" key={todo.id}>
                  <span className={`todo-title ${isDone ? 'completed' : ''}`}>
                    {todo.title}
                  </span>
                  <div className="actions">
                    <form
                      action={`/todos/${todo.id}/toggle`}
                      method="POST"
                      style={{ display: 'inline' }}
                    >
                      {csrf_token && <input type="hidden" name="_token" value={csrf_token} />}
                      <button
                        type="submit"
                        className={`btn-toggle ${isDone ? 'done' : ''}`}
                      >
                        {isDone ? 'Completed' : 'Mark Done'}
                      </button>
                    </form>

                    <form
                      action={`/todos/${todo.id}/delete`}
                      method="POST"
                      style={{ display: 'inline' }}
                    >
                      {csrf_token && <input type="hidden" name="_token" value={csrf_token} />}
                      <button type="submit" className="btn-delete">
                        Delete
                      </button>
                    </form>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
