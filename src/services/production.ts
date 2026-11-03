import { hashScenes } from '@/lib/approval';
import { repository } from './repository';

/**
 * Production queue. The heavy lifting (image → Veo clip → voice-over) runs in the `render`
 * Edge Function; the browser just starts it and keeps "ticking" while the editor is open.
 */
export const productionService = {
  startEpisode: (storyId: string) => repository.startRender(storyId),
  tick: (storyId: string) => repository.tickRender(storyId),
  retryScene: (storyId: string, sceneId: string, fromStart = false) => repository.retryScene(storyId, sceneId, fromStart),
};

export const approvalService = {
  async approve(storyId: string) {
    const story = await repository.getStory(storyId);
    if (!story) throw new Error('Story not found');
    if (story.scenes.some((s) => s.status !== 'generated')) throw new Error('All scenes must be generated before approval.');
    await repository.approveStory(storyId, hashScenes(story.scenes));
  },
};
