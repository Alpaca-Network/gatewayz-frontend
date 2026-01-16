import {SandboxClient} from "./sandbox-client";

interface SandboxPageProps {
  params: Promise<{sandboxId: string}>;
}

export default async function SandboxPage({params}: SandboxPageProps) {
  const {sandboxId} = await params;

  return <SandboxClient sandboxId={sandboxId} />;
}
