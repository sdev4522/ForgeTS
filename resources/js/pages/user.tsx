import React from 'react';
import type { PageProps } from '@/types';

interface UserItem {
  id: number;
  name: string;
  email: string;
}

interface UserPageProps extends PageProps {
  userData?: UserItem[];
}

export default function UserPage({ csrf_token, userData = [] }: UserPageProps) {
  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', color: '#f8fafc' }}>
      <h1>Users Page</h1>

      <form action="/user" method="post">
        <input type="hidden" name="_token" value={csrf_token} />
        <input type="text" placeholder="name" name="name" /> <br /><br />
        <input type="text" placeholder="email" name="email" /> <br /><br />
        <input type="password" placeholder="password" name="password" /> <br /><br />
        <button type="submit">Submit</button>
      </form>
      <br />
      {userData.map((user: any) => (
        <div key={user.id} style={{ marginBottom: '0.75rem' }}>
          <a href={`/user/${user.id}`}>{user.name}</a> — <span>{user.email}</span>
        </div>
      ))}
    </div>
  );
}
