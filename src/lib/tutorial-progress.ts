"use client";

import { TUTORIAL_MISSION_IDS, type TutorialMissionId } from "@/lib/tutorial";

export interface TutorialProgress {
  completedMissionIds: TutorialMissionId[];
  currentMissionId: TutorialMissionId;
  completed: boolean;
}

const STORAGE_KEY = "taisen:tutorial:progress:v1";

export const DEFAULT_TUTORIAL_PROGRESS: TutorialProgress = {
  completedMissionIds: [],
  currentMissionId: "mission-1",
  completed: false,
};

function isMissionId(value: unknown): value is TutorialMissionId {
  return typeof value === "string" && TUTORIAL_MISSION_IDS.includes(value as TutorialMissionId);
}

export function normalizeTutorialProgress(value: unknown): TutorialProgress {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULT_TUTORIAL_PROGRESS;
  }
  const raw = value as Partial<TutorialProgress>;
  const completedMissionIds = Array.isArray(raw.completedMissionIds)
    ? raw.completedMissionIds.filter(isMissionId)
    : [];
  const uniqueCompleted = Array.from(new Set(completedMissionIds));
  const currentMissionId = isMissionId(raw.currentMissionId) ? raw.currentMissionId : "mission-1";
  return {
    completedMissionIds: uniqueCompleted,
    currentMissionId,
    completed: Boolean(raw.completed),
  };
}

export function loadTutorialProgress(): TutorialProgress {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return normalizeTutorialProgress(raw ? JSON.parse(raw) : null);
  } catch {
    return DEFAULT_TUTORIAL_PROGRESS;
  }
}

export function saveTutorialProgress(progress: TutorialProgress): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeTutorialProgress(progress)));
}

export function resetTutorialProgress(): TutorialProgress {
  saveTutorialProgress(DEFAULT_TUTORIAL_PROGRESS);
  return DEFAULT_TUTORIAL_PROGRESS;
}

export function isMissionUnlocked(missionId: TutorialMissionId, progress: TutorialProgress): boolean {
  const index = TUTORIAL_MISSION_IDS.indexOf(missionId);
  if (index <= 0) return true;
  return progress.completedMissionIds.includes(TUTORIAL_MISSION_IDS[index - 1]);
}

export function markMissionCompleted(
  missionId: TutorialMissionId,
  progress: TutorialProgress
): TutorialProgress {
  const completedMissionIds = Array.from(new Set([...progress.completedMissionIds, missionId]));
  const index = TUTORIAL_MISSION_IDS.indexOf(missionId);
  const nextMissionId = TUTORIAL_MISSION_IDS[index + 1] ?? missionId;
  const nextProgress = {
    completedMissionIds,
    currentMissionId: nextMissionId,
    completed: completedMissionIds.length >= TUTORIAL_MISSION_IDS.length,
  };
  saveTutorialProgress(nextProgress);
  return nextProgress;
}
