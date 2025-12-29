'use client';

/**
 * ComfyUI Playground
 *
 * Interactive playground for generating images and videos using ComfyUI workflows.
 * Features:
 * - Workflow template selection
 * - Parameter customization
 * - Real-time generation progress
 * - Output gallery with download options
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { usePrivy } from '@privy-io/react-auth';
import { getApiKey } from '@/lib/api';
import {
  Loader2,
  Play,
  Square,
  Download,
  Image as ImageIcon,
  Video,
  Upload,
  Sparkles,
  Wand2,
  Zap,
  Settings,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  listWorkflows,
  executeWorkflowStream,
  getServerStatus,
  compressImage,
  getWorkflowTypeDisplayName,
  getStatusDisplayInfo,
  cancelExecution,
  type WorkflowTemplate,
  type WorkflowType,
  type ExecutionOutput,
  type ProgressUpdate,
  type ExecutionResponse,
  type ServerStatus,
} from '@/lib/comfyui-service';

// ============================================================================
// Types
// ============================================================================

interface GenerationResult {
  id: string;
  outputs: ExecutionOutput[];
  prompt: string;
  workflow: string;
  timestamp: Date;
  executionTimeMs?: number;
  creditsCharged?: number;
}

// ============================================================================
// Components
// ============================================================================

function WorkflowCard({
  workflow,
  selected,
  onClick,
}: {
  workflow: WorkflowTemplate;
  selected: boolean;
  onClick: () => void;
}) {
  const getTypeIcon = (type: WorkflowType) => {
    switch (type) {
      case 'text-to-image':
        return <Sparkles className="w-4 h-4" />;
      case 'image-to-image':
        return <Wand2 className="w-4 h-4" />;
      case 'text-to-video':
      case 'image-to-video':
        return <Video className="w-4 h-4" />;
      case 'upscale':
        return <Zap className="w-4 h-4" />;
      default:
        return <ImageIcon className="w-4 h-4" />;
    }
  };

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:border-primary/50',
        selected && 'border-primary ring-2 ring-primary/20'
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {getTypeIcon(workflow.type)}
            <h3 className="font-medium text-sm">{workflow.name}</h3>
          </div>
          <Badge variant="secondary" className="text-xs">
            {workflow.credits_per_run} credits
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
          {workflow.description}
        </p>
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="outline" className="text-xs">
            {getWorkflowTypeDisplayName(workflow.type)}
          </Badge>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />~{workflow.estimated_time_seconds}s
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function OutputGallery({
  results,
  onDelete,
}: {
  results: GenerationResult[];
  onDelete: (id: string) => void;
}) {
  const downloadOutput = (output: ExecutionOutput, filename?: string) => {
    const link = document.createElement('a');

    if (output.b64_data) {
      link.href = output.b64_data;
    } else if (output.url) {
      link.href = output.url;
    } else {
      return;
    }

    link.download = filename || output.filename || `output.${output.type === 'video' ? 'mp4' : 'png'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <ImageIcon className="w-12 h-12 mb-4 opacity-50" />
        <p>No generations yet</p>
        <p className="text-sm">Select a workflow and enter a prompt to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {results.map((result) => (
        <Card key={result.id} className="overflow-hidden">
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm">{result.workflow}</CardTitle>
                <CardDescription className="text-xs truncate max-w-md">
                  {result.prompt}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {result.executionTimeMs && (
                  <span className="text-xs text-muted-foreground">
                    {(result.executionTimeMs / 1000).toFixed(1)}s
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(result.id)}
                  className="h-8 w-8 p-0"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {result.outputs.map((output, idx) => (
                <div
                  key={idx}
                  className="relative group rounded-lg overflow-hidden bg-muted aspect-square"
                >
                  {output.type === 'image' && (output.b64_data || output.url) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={output.b64_data || output.url}
                      alt={`Output ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  )}
                  {output.type === 'video' && (output.b64_data || output.url) && (
                    <video
                      src={output.b64_data || output.url}
                      className="w-full h-full object-cover"
                      controls
                      loop
                      muted
                    />
                  )}
                  {output.error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-destructive/10">
                      <AlertCircle className="w-8 h-8 text-destructive" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => downloadOutput(output, `${result.workflow}-${idx + 1}.${output.type === 'video' ? 'mp4' : 'png'}`)}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Download
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function ComfyUIPlaygroundPage() {
  const { ready, authenticated } = usePrivy();
  const { toast } = useToast();

  // Server status
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);

  // Workflows
  const [workflows, setWorkflows] = useState<WorkflowTemplate[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowTemplate | null>(null);
  const [loadingWorkflows, setLoadingWorkflows] = useState(true);

  // Generation parameters
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [steps, setSteps] = useState(20);
  const [cfgScale, setCfgScale] = useState(7);
  const [seed, setSeed] = useState<number | null>(null);
  const [inputImage, setInputImage] = useState<string | null>(null);
  const [denoiseStrength, setDenoiseStrength] = useState(0.75);

  // Video parameters
  const [frames, setFrames] = useState(16);
  const [fps, setFps] = useState(8);

  // UI state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeTab, setActiveTab] = useState<'image' | 'video'>('image');

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [results, setResults] = useState<GenerationResult[]>([]);

  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initializedRef = useRef(false);
  const currentExecutionIdRef = useRef<string | null>(null);

  // Check server status
  const checkServerStatus = useCallback(async () => {
    setCheckingStatus(true);
    try {
      const status = await getServerStatus();
      setServerStatus(status);
    } catch (error) {
      console.error('Failed to check server status:', error);
      setServerStatus({ connected: false } as ServerStatus);
    } finally {
      setCheckingStatus(false);
    }
  }, []);

  // Load workflows
  const loadWorkflows = useCallback(async () => {
    setLoadingWorkflows(true);
    try {
      const response = await listWorkflows();
      setWorkflows(response.workflows);
      // Only set initial workflow if none selected yet
      setSelectedWorkflow((current) => {
        if (current === null && response.workflows.length > 0) {
          return response.workflows[0];
        }
        return current;
      });
    } catch (error) {
      console.error('Failed to load workflows:', error);
      toast({
        title: 'Error',
        description: 'Failed to load workflow templates',
        variant: 'destructive',
      });
    } finally {
      setLoadingWorkflows(false);
    }
  }, [toast]);

  // Initialize - runs once when authenticated
  useEffect(() => {
    if (ready && authenticated && !initializedRef.current) {
      initializedRef.current = true;
      checkServerStatus();
      loadWorkflows();
    }
    // For unauthenticated users, stop the loading spinners
    if (ready && !authenticated) {
      setCheckingStatus(false);
      setLoadingWorkflows(false);
    }
  }, [ready, authenticated, checkServerStatus, loadWorkflows]);

  // Handle image upload
  const handleImageUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        const compressed = await compressImage(file);
        setInputImage(compressed);
        toast({
          title: 'Image uploaded',
          description: 'Your image has been processed and is ready to use',
        });
      } catch (error) {
        console.error('Failed to process image:', error);
        toast({
          title: 'Error',
          description: 'Failed to process image',
          variant: 'destructive',
        });
      }
    },
    [toast]
  );

  // Generate
  const handleGenerate = useCallback(async () => {
    if (!selectedWorkflow || !prompt.trim()) {
      toast({
        title: 'Missing information',
        description: 'Please select a workflow and enter a prompt',
        variant: 'destructive',
      });
      return;
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      toast({
        title: 'Not authenticated',
        description: 'Please log in to generate images',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    setProgress(0);
    setStatusMessage('Starting generation...');

    try {
      abortControllerRef.current = new AbortController();

      const request = {
        workflow_id: selectedWorkflow.id,
        prompt,
        negative_prompt: negativePrompt || undefined,
        width,
        height,
        steps,
        cfg_scale: cfgScale,
        seed: seed !== null ? seed : undefined,
        input_image: inputImage || undefined,
        denoise_strength: denoiseStrength,
        frames,
        fps,
      };

      let finalResponse: ExecutionResponse | null = null;
      currentExecutionIdRef.current = null;

      for await (const update of executeWorkflowStream(request, abortControllerRef.current.signal)) {
        if (abortControllerRef.current?.signal.aborted) break;

        if ('outputs' in update && Array.isArray(update.outputs)) {
          // This is the final response (outputs can be empty array)
          finalResponse = update as ExecutionResponse;
        } else {
          // This is a progress update
          const progressUpdate = update as ProgressUpdate;
          // Track the execution ID for cancellation
          if (progressUpdate.execution_id) {
            currentExecutionIdRef.current = progressUpdate.execution_id;
          }
          setProgress(progressUpdate.progress || 0);
          setStatusMessage(progressUpdate.message || `Status: ${progressUpdate.status}`);
        }
      }

      if (finalResponse && finalResponse.outputs.length > 0) {
        const newResult: GenerationResult = {
          id: `result-${Date.now()}`,
          outputs: finalResponse.outputs,
          prompt,
          workflow: selectedWorkflow.name,
          timestamp: new Date(),
          executionTimeMs: finalResponse.execution_time_ms || undefined,
          creditsCharged: finalResponse.credits_charged || undefined,
        };

        setResults((prev) => [newResult, ...prev]);

        toast({
          title: 'Generation complete',
          description: `Generated ${finalResponse.outputs.length} ${finalResponse.outputs.length === 1 ? 'output' : 'outputs'}`,
        });
      } else if (finalResponse?.error) {
        toast({
          title: 'Generation failed',
          description: finalResponse.error,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Generation error:', error);
      toast({
        title: 'Generation failed',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
      setProgress(0);
      setStatusMessage('');
    }
  }, [
    selectedWorkflow,
    prompt,
    negativePrompt,
    width,
    height,
    steps,
    cfgScale,
    seed,
    inputImage,
    denoiseStrength,
    frames,
    fps,
    toast,
  ]);

  // Cancel generation
  const handleCancel = useCallback(async () => {
    abortControllerRef.current?.abort();

    // Try to cancel on server side as well
    if (currentExecutionIdRef.current) {
      try {
        await cancelExecution(currentExecutionIdRef.current);
      } catch (error) {
        console.error('Failed to cancel execution on server:', error);
      }
    }

    currentExecutionIdRef.current = null;
    setIsGenerating(false);
    setProgress(0);
    setStatusMessage('');
    toast({
      title: 'Cancelled',
      description: 'Generation has been cancelled',
    });
  }, [toast]);

  // Delete result
  const handleDeleteResult = useCallback((id: string) => {
    setResults((prev) => prev.filter((r) => r.id !== id));
  }, []);

  // Filter workflows by tab
  const filteredWorkflows = workflows.filter((w) => {
    if (activeTab === 'image') {
      return ['text-to-image', 'image-to-image', 'upscale', 'inpaint', 'outpaint'].includes(w.type);
    }
    return ['text-to-video', 'image-to-video'].includes(w.type);
  });

  // Requires input image
  const requiresInputImage = selectedWorkflow?.type
    ? ['image-to-image', 'image-to-video', 'upscale', 'inpaint', 'outpaint'].includes(
        selectedWorkflow.type
      )
    : false;

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Wand2 className="w-8 h-8 text-purple-500" />
                ComfyUI Playground
              </h1>
              <p className="text-muted-foreground mt-1">
                Generate images and videos with AI-powered workflows
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Server Status */}
              <div className="flex items-center gap-2">
                {checkingStatus ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : serverStatus?.connected ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-muted-foreground">
                      Server connected ({serverStatus.queue_size} in queue)
                    </span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-yellow-500" />
                    <span className="text-sm text-muted-foreground">Server disconnected</span>
                  </>
                )}
                <Button variant="ghost" size="sm" onClick={checkServerStatus} disabled={checkingStatus}>
                  <RefreshCw className={cn('w-4 h-4', checkingStatus && 'animate-spin')} />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Workflow Selection & Parameters */}
          <div className="lg:col-span-1 space-y-6">
            {/* Workflow Type Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'image' | 'video')}>
              <TabsList className="w-full">
                <TabsTrigger value="image" className="flex-1 gap-2">
                  <ImageIcon className="w-4 h-4" />
                  Image
                </TabsTrigger>
                <TabsTrigger value="video" className="flex-1 gap-2">
                  <Video className="w-4 h-4" />
                  Video
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Workflow Selection */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Select Workflow</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {loadingWorkflows ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : filteredWorkflows.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No workflows available for this type
                  </p>
                ) : (
                  filteredWorkflows.map((workflow) => (
                    <WorkflowCard
                      key={workflow.id}
                      workflow={workflow}
                      selected={selectedWorkflow?.id === workflow.id}
                      onClick={() => setSelectedWorkflow(workflow)}
                    />
                  ))
                )}
              </CardContent>
            </Card>

            {/* Input Image (for img2img workflows) */}
            {requiresInputImage && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Input Image</CardTitle>
                </CardHeader>
                <CardContent>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  {inputImage ? (
                    <div className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={inputImage}
                        alt="Input"
                        className="w-full rounded-lg border"
                      />
                      <Button
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => setInputImage(null)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full h-32 border-dashed"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <Upload className="w-8 h-8" />
                        <span>Upload Image</span>
                      </div>
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Middle Panel - Generation Controls */}
          <div className="lg:col-span-1 space-y-6">
            {/* Prompt Input */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Prompt</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Describe what you want to create..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="min-h-24 resize-none"
                  disabled={isGenerating}
                />
                <Textarea
                  placeholder="Negative prompt (things to avoid)..."
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  className="min-h-16 resize-none text-sm"
                  disabled={isGenerating}
                />
              </CardContent>
            </Card>

            {/* Basic Parameters */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Parameters</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                  >
                    <Settings className="w-4 h-4 mr-1" />
                    {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Dimensions */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm">Width: {width}</Label>
                    <Slider
                      min={256}
                      max={2048}
                      step={64}
                      value={[width]}
                      onValueChange={(v) => setWidth(v[0])}
                      disabled={isGenerating}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Height: {height}</Label>
                    <Slider
                      min={256}
                      max={2048}
                      step={64}
                      value={[height]}
                      onValueChange={(v) => setHeight(v[0])}
                      disabled={isGenerating}
                    />
                  </div>
                </div>

                {/* Steps */}
                <div className="space-y-2">
                  <Label className="text-sm">Steps: {steps}</Label>
                  <Slider
                    min={1}
                    max={100}
                    step={1}
                    value={[steps]}
                    onValueChange={(v) => setSteps(v[0])}
                    disabled={isGenerating}
                  />
                </div>

                {/* CFG Scale */}
                <div className="space-y-2">
                  <Label className="text-sm">CFG Scale: {cfgScale}</Label>
                  <Slider
                    min={1}
                    max={30}
                    step={0.5}
                    value={[cfgScale]}
                    onValueChange={(v) => setCfgScale(v[0])}
                    disabled={isGenerating}
                  />
                </div>

                {/* Advanced Parameters */}
                {showAdvanced && (
                  <>
                    {/* Seed */}
                    <div className="space-y-2">
                      <Label className="text-sm">Seed (empty = random)</Label>
                      <Input
                        type="number"
                        placeholder="Random"
                        value={seed ?? ''}
                        onChange={(e) => setSeed(e.target.value ? parseInt(e.target.value) : null)}
                        disabled={isGenerating}
                      />
                    </div>

                    {/* Denoise Strength (for img2img) */}
                    {requiresInputImage && (
                      <div className="space-y-2">
                        <Label className="text-sm">Denoise Strength: {denoiseStrength}</Label>
                        <Slider
                          min={0}
                          max={1}
                          step={0.05}
                          value={[denoiseStrength]}
                          onValueChange={(v) => setDenoiseStrength(v[0])}
                          disabled={isGenerating}
                        />
                      </div>
                    )}

                    {/* Video Parameters */}
                    {activeTab === 'video' && (
                      <>
                        <div className="space-y-2">
                          <Label className="text-sm">Frames: {frames}</Label>
                          <Slider
                            min={8}
                            max={32}
                            step={1}
                            value={[frames]}
                            onValueChange={(v) => setFrames(v[0])}
                            disabled={isGenerating}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm">FPS: {fps}</Label>
                          <Slider
                            min={4}
                            max={30}
                            step={1}
                            value={[fps]}
                            onValueChange={(v) => setFps(v[0])}
                            disabled={isGenerating}
                          />
                        </div>
                      </>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Generation Progress */}
            {isGenerating && (
              <Card>
                <CardContent className="py-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{statusMessage}</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Generate Button */}
            <div className="flex gap-2">
              {isGenerating ? (
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={handleCancel}
                >
                  <Square className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              ) : (
                <Button
                  className="flex-1"
                  onClick={handleGenerate}
                  disabled={!authenticated || !selectedWorkflow || !prompt.trim() || (requiresInputImage && !inputImage)}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Generate
                  {selectedWorkflow && (
                    <Badge variant="secondary" className="ml-2">
                      {selectedWorkflow.credits_per_run} credits
                    </Badge>
                  )}
                </Button>
              )}
            </div>

            {!authenticated && (
              <p className="text-xs text-muted-foreground text-center">
                Please log in to generate images and videos
              </p>
            )}
          </div>

          {/* Right Panel - Output Gallery */}
          <div className="lg:col-span-1">
            <Card className="h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Generated Outputs</CardTitle>
                  {results.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setResults([])}
                    >
                      Clear All
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <OutputGallery results={results} onDelete={handleDeleteResult} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
