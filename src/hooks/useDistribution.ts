import { distribution } from '@/services/distribution';
import { useLiveQuery } from './useStore';

export const useAccounts = () => useLiveQuery(() => distribution.listAccounts(), 'd:accounts');
export const useGroups = () => useLiveQuery(() => distribution.listGroups(), 'd:groups');
export const useMedia = () => useLiveQuery(() => distribution.listMedia(), 'd:media');
export const useCampaigns = () => useLiveQuery(() => distribution.listCampaigns(), 'd:campaigns');
export const useIntegrations = () => useLiveQuery(() => distribution.integrationStatus(), 'd:integrations');
export const usePlanLimits = () => useLiveQuery(() => distribution.planLimits(), 'd:limits');
export const usePublications = (f: { from?: string; to?: string; mediaId?: string; accountId?: string } = {}) =>
  useLiveQuery(() => distribution.listPublications(f), `d:pubs:${JSON.stringify(f)}`);
