import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';

import { supabase } from './lib/supabase';
import Login from './components/Login';
import AppShell from './components/AppShell';

type Profile = {
  id: string;
  display_name: string | null;
  role: 'ADMIN' | 'STAFF';
};

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    void loadInitialSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        setSession(currentSession);
      },
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setProfile(null);
      return;
    }

    void loadProfile(session.user.id);
  }, [session]);

  async function loadInitialSession() {
    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession();

    setSession(currentSession);
    setLoading(false);
  }

  async function loadProfile(userId: string) {
    setProfileLoading(true);
    setErrorMessage('');

    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, role')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Failed to load profile:', error);
      setErrorMessage(error.message);
      setProfileLoading(false);
      return;
    }

    setProfile(data as Profile);
    setProfileLoading(false);
  }

  if (loading) {
    return <p>Checking login...</p>;
  }

  if (!session) {
    return <Login onLoginSuccess={() => undefined} />;
  }

  if (profileLoading) {
    return <p>Loading user profile...</p>;
  }

  if (!profile) {
    return (
      <main>
        <h1>Unable to load profile</h1>
        <p>{errorMessage}</p>
      </main>
    );
  }

  return (
    <AppShell
      profile={profile}
      email={session.user.email}
    />
  );
}

export default App;