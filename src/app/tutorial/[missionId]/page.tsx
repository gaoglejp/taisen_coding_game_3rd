import { notFound } from "next/navigation";
import { getTutorialMission } from "@/lib/tutorial";
import { TutorialMissionClient } from "./TutorialMissionClient";

interface Props {
  params: Promise<{ missionId: string }>;
}

export default async function TutorialMissionPage({ params }: Props) {
  const { missionId } = await params;
  const mission = getTutorialMission(missionId);
  if (!mission) notFound();

  return <TutorialMissionClient mission={mission} />;
}
