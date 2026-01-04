'use client';

export default function AgentsPage() {
  return (
    <div className="h-screen w-full">
      <iframe
        src="https://vibe-kanban-staging.up.railway.app/"
        className="h-full w-full border-0"
        title="Vibe Kanban - Agent Orchestration"
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
}
