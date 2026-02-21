import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { api } from "../../api";
import { useEffect, useRef } from "react";

export const Route = createFileRoute("/chat/new")({
  component: NewChat,
});

function NewChat() {
  const navigate = useNavigate();
  const createConversation = api.createConversation.useMutation();
  const { data: modelsData, isLoading: modelsLoading } = api.getModels.useQuery({
    queryKey: ["getModels"],
    queryData: {},
  });
  const models = modelsData?.payload ?? [];
  const hasModels = models.length > 0;
  const hasCreated = useRef(false);

  useEffect(() => {
    // Create a new chat with the first available model and redirect
    // Use ref to prevent double creation in React StrictMode
    if (!modelsLoading && hasModels && !hasCreated.current) {
      hasCreated.current = true;
      const defaultModel = models[0]!.modelId;
      createConversation.mutateAsync({ body: { modelId: defaultModel } }).then((result) => {
        if (result.payload && "id" in result.payload) {
          navigate({ to: "/chat/$id", params: { id: result.payload.id } });
        }
      });
    }
  }, [hasModels, models, modelsLoading, createConversation, navigate]);

  if (!modelsLoading && !hasModels) {
    return (
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="text-center text-muted-foreground text-sm max-w-md">
          No models are configured. Set <code>AI_SDK_MODELS</code> in your <code>.env</code> file.
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
    </div>
  );
}
