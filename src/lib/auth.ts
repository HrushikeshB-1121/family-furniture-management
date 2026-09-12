import { supabase } from './supabase';

export type UserRole = 'ADMIN' | 'STAFF';

export async function getCurrentUserRole(): Promise<UserRole | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Failed to load user role:', error);
    return null;
  }

  return data.role as UserRole;
}