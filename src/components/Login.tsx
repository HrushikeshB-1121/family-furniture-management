import { useState } from 'react';
import { supabase } from '../lib/supabase';

type LoginProps = {
  onLoginSuccess: () => void;
};

function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setErrorMessage('');

    if (!email.trim() || !password) {
      setErrorMessage('Email and password are required.');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      console.error('Login failed:', error);
      setErrorMessage(error.message);
      return;
    }

    onLoginSuccess();
  }

  return (
    <main>
      <h1>Furniture Management System</h1>
      <h2>Login</h2>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email">Email</label>

          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Enter email"
          />
        </div>

        <div>
          <label htmlFor="password">Password</label>

          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            placeholder="Enter password"
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Signing in...' : 'Login'}
        </button>
      </form>

      {errorMessage && <p>{errorMessage}</p>}
    </main>
  );
}

export default Login;