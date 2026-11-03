import type { Character, Scene, Story } from './database';

/** AI-generated concept proposed in Wizard phase 1. */
export interface StoryConcept {
  id: string;
  title: string;
  logline: string;
  tone: string;
  hook: string;
  characters: Pick<Character, 'name' | 'species' | 'personality' | 'visual_description'>[];
}

/** Scene draft returned by the AI before persistence (Wizard phase 2). */
export type SceneDraft = Pick<Scene, 'position' | 'title' | 'narration' | 'dialogue' | 'image_prompt' | 'video_prompt' | 'duration_seconds'>;

/** Scene as shown in the UI: storage paths resolved to short-lived signed URLs. */
export type SceneView = Scene & { audio_url?: string | null };

export interface StoryWithScenes extends Story {
  scenes: SceneView[];
  characters: Character[];
}

export const SCENES_PER_EPISODE = 15;
