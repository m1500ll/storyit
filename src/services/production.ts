import type { Scene } from '@/types/database';
import { hashScenes } from '@/lib/approval';
import { CREDIT_COSTS, estimateEpisodeCost } from './credits';
import { repository } from './repository';
import { delay } from './store';

/**
 * Production queue. Target architecture: scenes go into a `render_jobs` table consumed by a
 * server worker. For the MVP the render is simulated client-side, writing real status updates.
 */
export const productionService = {
  async startEpisode(storyId: string) {
    const story = await repository.getStory(storyId);
    if (!story) throw new Error('Story not found');
    await repository.consumeCredits(estimateEpisodeCost(story.scenes.length), storyId, `${story.title} — ${story.scenes.length} scene renders`);
    await repository.setStoryStatus(storyId, 'generating');
    await Promise.all(story.scenes.map((s) => repository.setSceneStatus(s.id, 'queued')));
    void this.run(storyId, story.scenes);
  },

  async retryScene(storyId: string, scene: Scene) {
    if (CREDIT_COSTS.sceneRetry > 0) await repository.consumeCredits(CREDIT_COSTS.sceneRetry, storyId, `Retry scene ${scene.position}`);
    void this.run(storyId, [scene]);
  },

  async run(storyId: string, scenes: Scene[]) {
    for (const scene of scenes) {
      await repository.setSceneStatus(scene.id, 'generating');
      await delay(700 + Math.random() * 600);
      await repository.setSceneStatus(scene.id, 'generated');
    }
    const story = await repository.getStory(storyId);
    if (story?.status === 'generating' && story.scenes.every((s) => s.status === 'generated')) {
      await repository.setStoryStatus(storyId, 'in_review');
    }
  },
};

export const approvalService = {
  async approve(storyId: string) {
    const story = await repository.getStory(storyId);
    if (!story) throw new Error('Story not found');
    if (story.scenes.some((s) => s.status !== 'generated')) throw new Error('All scenes must be generated before approval.');
    await repository.approveStory(storyId, hashScenes(story.scenes));
  },
};
