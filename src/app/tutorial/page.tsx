"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TopbarPaper } from "@/components/layout/TopbarPaper";
import { getMissionNumber, TUTORIAL_MISSIONS } from "@/lib/tutorial";
import {
  DEFAULT_TUTORIAL_PROGRESS,
  isMissionUnlocked,
  loadTutorialProgress,
  resetTutorialProgress,
  type TutorialProgress,
} from "@/lib/tutorial-progress";

const T = {
  bg: "#f6f4ee",
  surface: "#ffffff",
  line: "#e7e3d6",
  ink: "#1f2330",
  inkSoft: "#4b5563",
  accent: "#f59e0b",
  p1: "#2563eb",
  success: "#15803d",
};

export default function TutorialTopPage() {
  const [progress, setProgress] = useState<TutorialProgress>(DEFAULT_TUTORIAL_PROGRESS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setProgress(loadTutorialProgress());
      setLoaded(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const current = TUTORIAL_MISSIONS.find((mission) => mission.missionId === progress.currentMissionId) ?? TUTORIAL_MISSIONS[0];

  const reset = () => {
    setProgress(resetTutorialProgress());
  };

  return (
    <div style={{ minHeight: "100vh", background: T.bg }}>
      <TopbarPaper title="基本チュートリアル" />
      <main style={{ maxWidth: 1120, margin: "0 auto", padding: "28px 24px 48px" }}>
        <section
          style={{
            background: T.surface,
            border: `1px solid ${T.line}`,
            borderRadius: 16,
            padding: "26px 30px",
            display: "flex",
            justifyContent: "space-between",
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          <div style={{ maxWidth: 720 }}>
            <p style={{ margin: "0 0 8px", color: T.p1, fontSize: 12, fontWeight: 800 }}>TUTORIAL</p>
            <h1 style={{ margin: "0 0 12px", fontSize: 28, lineHeight: 1.2, color: T.ink }}>基本チュートリアル</h1>
            <div style={{ display: "grid", gap: 6, color: T.inkSoft, fontSize: 14, lineHeight: 1.7 }}>
              <span>自機を動かすためのルール作成を、4つのミッションで練習します。</span>
              <span>画面操作方法ではなく、作戦コードの基礎を学びます。</span>
              <span>応用的な作戦は通常の一人対戦で試してください。</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
            <Link
              href={`/tutorial/${current.missionId}`}
              style={{
                background: T.accent,
                color: "#fff",
                borderRadius: 10,
                padding: "11px 18px",
                textDecoration: "none",
                fontWeight: 800,
                boxShadow: "0 2px 8px rgba(245,158,11,.28)",
              }}
            >
              {progress.completedMissionIds.length > 0 ? "再開する" : "開始する"}
            </Link>
            <button
              type="button"
              onClick={reset}
              disabled={!loaded}
              style={{
                border: `1px solid ${T.line}`,
                background: T.surface,
                color: T.ink,
                borderRadius: 10,
                padding: "10px 16px",
                fontWeight: 800,
                cursor: loaded ? "pointer" : "wait",
              }}
            >
              最初からやり直す
            </button>
            <Link
              href="/practice"
              style={{
                border: `1px solid ${T.line}`,
                background: T.surface,
                color: T.ink,
                borderRadius: 10,
                padding: "10px 16px",
                textDecoration: "none",
                fontWeight: 800,
              }}
            >
              通常の一人対戦へ戻る
            </Link>
          </div>
        </section>

        <section style={{ marginTop: 22 }}>
          <h2 style={{ margin: "0 0 12px", fontSize: 18, color: T.ink }}>ミッション一覧</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
            {TUTORIAL_MISSIONS.map((mission) => {
              const unlocked = isMissionUnlocked(mission.missionId, progress);
              const completed = progress.completedMissionIds.includes(mission.missionId);
              const active = progress.currentMissionId === mission.missionId && !completed;
              return (
                <article
                  key={mission.missionId}
                  style={{
                    background: T.surface,
                    border: `1px solid ${active ? T.accent : T.line}`,
                    borderRadius: 12,
                    padding: 18,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    minHeight: 210,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 900, color: T.inkSoft }}>
                      MISSION {getMissionNumber(mission.missionId)}
                    </span>
                    <Status completed={completed} unlocked={unlocked} active={active} />
                  </div>
                  <h3 style={{ margin: 0, fontSize: 17, color: T.ink }}>{mission.title}</h3>
                  <p style={{ margin: 0, color: T.inkSoft, fontSize: 13, lineHeight: 1.6 }}>{mission.summary}</p>
                  <div style={{ marginTop: "auto" }}>
                    {unlocked ? (
                      <Link
                        href={`/tutorial/${mission.missionId}`}
                        style={{
                          display: "inline-flex",
                          border: `1px solid ${completed ? T.line : T.p1}`,
                          background: completed ? T.surface : T.p1,
                          color: completed ? T.ink : "#fff",
                          borderRadius: 9,
                          padding: "8px 12px",
                          textDecoration: "none",
                          fontSize: 13,
                          fontWeight: 800,
                        }}
                      >
                        {completed ? "もう一度試す" : active ? "再開" : "開始"}
                      </Link>
                    ) : (
                      <span style={{ color: T.inkSoft, fontSize: 13, fontWeight: 700 }}>前のミッションをクリアすると開始できます</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}

function Status({
  completed,
  unlocked,
  active,
}: {
  completed: boolean;
  unlocked: boolean;
  active: boolean;
}) {
  const label = completed ? "クリア済み" : active ? "進行中" : unlocked ? "開始可" : "ロック";
  const color = completed ? T.success : active ? T.accent : unlocked ? T.p1 : T.inkSoft;
  return (
    <span
      style={{
        border: `1px solid ${color}`,
        color,
        borderRadius: 999,
        padding: "2px 8px",
        fontSize: 11,
        fontWeight: 800,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}
