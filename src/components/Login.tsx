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
      setErrorMessage(
        'Email and password are required.',
      );
      return;
    }

    setLoading(true);

    const { error } =
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

    setLoading(false);

    if (error) {
      console.error(
        'Login failed:',
        error,
      );

      setErrorMessage(error.message);
      return;
    }

    onLoginSuccess();
  }

  return (
    <>
      <style>
        {`
          .login-page {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            box-sizing: border-box;
            padding: 24px;
            background:
              linear-gradient(
                135deg,
                #f8fafc 0%,
                #eef4ff 100%
              );
          }

          .login-card {
            width: 100%;
            max-width: 420px;
            box-sizing: border-box;
            padding: 32px;
            background: #ffffff;
            border: 1px solid #e4e7ec;
            border-radius: 16px;
            box-shadow:
              0 12px 30px rgba(16, 24, 40, 0.08);
          }

          .login-brand {
            margin-bottom: 28px;
            text-align: center;
          }

          .login-brand-mark {
            width: 52px;
            height: 52px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 14px;
            border-radius: 14px;
            background: #eff6ff;
            color: #2563eb;
            font-size: 22px;
            font-weight: 800;
          }

          .login-brand h1 {
            margin: 0;
            color: #101828;
            font-size: 23px;
            line-height: 1.3;
            font-weight: 750;
          }

          .login-brand p {
            margin: 7px 0 0;
            color: #667085;
            font-size: 14px;
          }

          .login-heading {
            margin-bottom: 20px;
          }

          .login-heading h2 {
            margin: 0;
            color: #101828;
            font-size: 20px;
            line-height: 1.3;
          }

          .login-heading p {
            margin: 6px 0 0;
            color: #667085;
            font-size: 13px;
          }

          .login-error {
            margin-bottom: 16px;
            padding: 11px 13px;
            border: 1px solid #fecaca;
            border-radius: 8px;
            background: #fef2f2;
            color: #dc2626;
            font-size: 13px;
            line-height: 1.4;
          }

          .login-field {
            margin-bottom: 16px;
          }

          .login-field label {
            display: block;
            margin-bottom: 6px;
            color: #344054;
            font-size: 13px;
            font-weight: 600;
          }

          .login-field input {
            width: 100%;
            min-height: 44px;
            box-sizing: border-box;
            padding: 10px 12px;
            border: 1px solid #d0d5dd;
            border-radius: 7px;
            background: #ffffff;
            color: #101828;
            font-size: 14px;
          }

          .login-field input::placeholder {
            color: #98a2b3;
          }

          .login-field input:focus {
            outline: none;
            border-color: #2563eb;
            box-shadow:
              0 0 0 3px rgba(37, 99, 235, 0.12);
          }

          .login-button {
            width: 100%;
            min-height: 44px;
            margin-top: 4px;
            padding: 10px 16px;
            border: 1px solid #2563eb;
            border-radius: 7px;
            background: #2563eb;
            color: #ffffff;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
          }

          .login-button:hover:not(:disabled) {
            background: #1d4ed8;
            border-color: #1d4ed8;
          }

          .login-button:disabled {
            opacity: 0.65;
            cursor: not-allowed;
          }

          .login-footer {
            margin-top: 20px;
            text-align: center;
            color: #98a2b3;
            font-size: 11px;
          }

          @media (max-width: 480px) {
            .login-page {
              padding: 16px;
            }

            .login-card {
              padding: 24px 20px;
              border-radius: 14px;
            }

            .login-brand h1 {
              font-size: 21px;
            }
          }
        `}
      </style>

      <main className="login-page">
        <section className="login-card">
          <div className="login-brand">
            <div className="login-brand-mark">
              SKF
            </div>

            <h1>
              Sri Krishna Furniture
            </h1>

            <p>
              Furniture Management System
            </p>
          </div>

          <div className="login-heading">
            <h2>Welcome back</h2>

            <p>
              Sign in to continue to the system.
            </p>
          </div>

          {errorMessage && (
            <div className="login-error">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="login-field">
              <label htmlFor="email">
                Email
              </label>

              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="Enter your email"
              />
            </div>

            <div className="login-field">
              <label htmlFor="password">
                Password
              </label>

              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value,
                  )
                }
                placeholder="Enter your password"
              />
            </div>

            <button
              className="login-button"
              type="submit"
              disabled={loading}
            >
              {loading
                ? 'Signing in...'
                : 'Sign in'}
            </button>
          </form>

          <div className="login-footer">
            Sri Krishna Furniture
          </div>
        </section>
      </main>
    </>
  );
}

export default Login;