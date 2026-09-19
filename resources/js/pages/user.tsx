import React from 'react';
import type { PageProps } from '../../types';


export default function UserPage({ csrf_token, user }: PageProps) {
    console.log(user);
    return (
        <div style={{ padding: '2rem', fontFamily: 'sans-serif', color: '#f8fafc' }}>
            <h1>Abouts Page</h1>
            <p>{user?.name}</p>
            <p>{user?.email}</p>
            <p>{user?.password}</p>

            <form action="/user" method="post">
                <input type="hidden" name="_token" value={csrf_token} />
                <input type="text" placeholder='name' name="name" />
                <input type="text" placeholder='email' name="email" />
                <input type="password" placeholder='password' name="password" />
                <button type="submit">Submit</button>
            </form>

        </div>
    );
}
