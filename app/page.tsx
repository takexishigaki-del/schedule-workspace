import { ScheduleWorkspace } from "@/components/schedule-workspace/ScheduleWorkspace";
import scheduleWorkspaceData from "@/data/schedule-workspace.json";
import { scheduleWorkspaceDataSchema } from "@/lib/schedule-schema";

export default function Page() {
  const result = scheduleWorkspaceDataSchema.safeParse(scheduleWorkspaceData);

  if (!result.success) {
    throw new Error(
      `データの形式が正しくありません: ${result.error.issues[0]?.message}`,
    );
  }

  return <ScheduleWorkspace initialData={result.data} />;
}
