import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/primitives";
import { VideoManagement } from "@/components/videos/VideoManagement";

export function VideosPage() {
  return (
    <AppShell>
      <PageHeader
        title="Video Ingestion & AI Processing"
        subtitle="Upload onboard transit camera feeds, dispatch YOLO v11 detection pipelines, and monitor real-time processing jobs."
      />
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-4">
        <VideoManagement />
      </div>
    </AppShell>
  );
}
