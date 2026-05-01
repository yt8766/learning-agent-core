import { useState } from 'react';

import { useAuth } from './auth-provider';

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('dev@example.com');
  const [password, setPassword] = useState('secret');

  return (
    <main style={styles.page}>
      <form
        onSubmit={event => {
          event.preventDefault();
          login(email, password);
        }}
        style={styles.form}
      >
        <h1 style={styles.title}>Knowledge</h1>
        <label style={styles.field}>
          邮箱
          <input onChange={event => setEmail(event.target.value)} style={styles.input} value={email} />
        </label>
        <label style={styles.field}>
          密码
          <input
            onChange={event => setPassword(event.target.value)}
            style={styles.input}
            type="password"
            value={password}
          />
        </label>
        <button style={styles.button} type="submit">
          登录
        </button>
      </form>
    </main>
  );
}

const styles = {
  page: {
    alignItems: 'center',
    background: '#f5f7fb',
    color: '#172033',
    display: 'grid',
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
    minHeight: '100vh',
    padding: 24
  },
  form: {
    background: '#ffffff',
    border: '1px solid #d0d5dd',
    borderRadius: 8,
    boxShadow: '0 12px 30px rgba(16, 24, 40, 0.08)',
    display: 'grid',
    gap: 16,
    justifySelf: 'center',
    maxWidth: 360,
    padding: 24,
    width: '100%'
  },
  title: { fontSize: 26, letterSpacing: 0, margin: 0 },
  field: { display: 'grid', fontSize: 14, gap: 6 },
  input: { border: '1px solid #d0d5dd', borderRadius: 8, fontSize: 15, padding: '10px 12px' },
  button: {
    background: '#175cd3',
    border: 0,
    borderRadius: 8,
    color: '#ffffff',
    cursor: 'pointer',
    fontSize: 15,
    padding: 12
  }
} as const;
