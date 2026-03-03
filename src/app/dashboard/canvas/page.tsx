"use client";

import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { WorkflowCanvas } from "@/components/canvas/WorkflowCanvas";
import { useWorkflowStore } from "@/stores/workflow-store";

function CanvasLoader() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const loadWorkflow = useWorkflowStore(s => s.loadWorkflow);
  const loadedRef = useRef<string | null>(null);

  useEffect(() => {
    if (id && loadedRef.current !== id) {
      loadedRef.current = id;
      loadWorkflow(id);
    }
  }, [id, loadWorkflow]);

  return <WorkflowCanvas />;
}

export default function CanvasPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Suspense fallback={<WorkflowCanvas />}>
        <CanvasLoader />
      </Suspense>
    </div>
  );
}
