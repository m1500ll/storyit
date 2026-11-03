import type { Scene } from '@/types/database';
import { CREDIT_COSTS, creditService, estimateEpisodeCost } from './credits';
import { storyService } from './stories';
import { delay, store } from './store';

/**
 * Production queue. In production, scenes are inserted into a `render_jobs` table
 * consumed by a worker; here we simulate sequential rendering client-side.
 */
export const productionService = {
  async startEpisode(storyId: string) {
    const story = storyService.get(storyId);
    if (!story) throw new Error('Story not found');
    await creditService.consume(estimateEpisodeCost(story.scenes.length), storyId, `${story.title} — ${story.scenes.length} scene renders`);
    story.status = 'generating';
    story.scenes.forEach((s) => (s.status = 'queued'));
    store.notify();
    void this.run(storyId, story.scenes);
  },

  async retryScene(storyId: string, scene: Scene) {
    if (CREDIT_COSTS.sceneRetry > 0) await creditService.consume(CREDIT_COSTS.sceneRetry, storyId, `Retry scene ${scene.position}`);
    void this.run(storyId, [scene]);
  },

  async run(storyId: string, scenes: Scene[]) {
    for (const scene of scenes) {
      storyService.setSceneStatus(storyId, scene.id, 'generating');
      await delay(700 + Math.random() * 600);
      storyService.setSceneStatus(storyId, scene.id, 'generated');
    }
    const story = storyService.get(storyId);
    if (story && story.scenes.every((s) => s.status === 'generated') && story.status === 'generating') {
      story.status = 'in_review';
      store.notify();
    }
  },
};
