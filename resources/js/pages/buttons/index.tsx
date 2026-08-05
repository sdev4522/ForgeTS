import React, { useState } from 'react';

export default function ButtonPage() {
  const [count, setCount] = useState(0)

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', color: '#f8fafc' }}>
      <h1>Buttons Page</h1>
      <div className="mt-10">
        <p>Counter: {count}</p>
        <button
          onClick={() => setCount(count + 1)}
          className="px-4 py-2 bg-primary text-white rounded hover:bg-opacity-90 transition-colors"
        >
          Add
        </button>
      </div>
    </div>
  );
}
