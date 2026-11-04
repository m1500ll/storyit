import { useProfile } from './useStore';

/** AI episode studio access (private beta). `undefined` while the profile loads. */
export function useBetaAccess(): boolean | undefined {
  const { data: profile, loading } = useProfile();
  if (loading && !profile) return undefined;
  return Boolean(profile?.beta_access);
}
