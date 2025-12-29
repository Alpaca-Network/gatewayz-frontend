"use client";

import { useState, useEffect, useMemo } from 'react';
import { ModelsAPI, ProviderAPI, ModelWithProvider, ModelStats, Provider, HealthStatus } from '@/lib/catalog-api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Cpu,
  Activity,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  Zap,
  Eye,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export default function ModelsPage() {
  const [models, setModels] = useState<ModelWithProvider[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [stats, setStats] = useState<ModelStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProvider, setFilterProvider] = useState<number | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterHealth, setFilterHealth] = useState<HealthStatus | 'all'>('all');
  const [filterModality, setFilterModality] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize] = useState(50);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [modelsData, providersData, statsData] = await Promise.all([
        ModelsAPI.getAllModels({
          limit: pageSize,
          offset: currentPage * pageSize,
          is_active_only: false
        }),
        ProviderAPI.getAllProviders({ include_inactive: true }),
        ModelsAPI.getModelStats(),
      ]);

      setModels(modelsData);
      setProviders(providersData);
      setStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load models');
      console.error('Error fetching models:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentPage]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      fetchData();
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const results = await ModelsAPI.searchModels(
        searchQuery,
        filterProvider !== 'all' ? filterProvider : undefined
      );
      setModels(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const filteredModels = useMemo(() => {
    return models.filter((model) => {
      const matchesProvider =
        filterProvider === 'all' || model.provider_id === filterProvider;

      const matchesStatus =
        filterStatus === 'all' ||
        (filterStatus === 'active' && model.is_active) ||
        (filterStatus === 'inactive' && !model.is_active);

      const matchesHealth =
        filterHealth === 'all' || model.health_status === filterHealth;

      const matchesModality =
        filterModality === 'all' || model.modality === filterModality;

      return matchesProvider && matchesStatus && matchesHealth && matchesModality;
    });
  }, [models, filterProvider, filterStatus, filterHealth, filterModality]);

  const getHealthIcon = (status: HealthStatus) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'degraded':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'down':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <HelpCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getHealthBadge = (status: HealthStatus) => {
    const variants: Record<HealthStatus, string> = {
      healthy: 'bg-green-500/10 text-green-500 border-green-500/20',
      degraded: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      down: 'bg-red-500/10 text-red-500 border-red-500/20',
      unknown: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
    };

    return (
      <Badge variant="outline" className={variants[status]}>
        {getHealthIcon(status)}
        <span className="ml-1 capitalize">{status}</span>
      </Badge>
    );
  };

  const formatPrice = (price?: string) => {
    if (!price) return '-';
    const numPrice = parseFloat(price);
    return numPrice === 0 ? 'Free' : `$${numPrice.toFixed(6)}`;
  };

  const modalities = useMemo(() => {
    if (!stats?.by_modality) return [];
    return Object.keys(stats.by_modality);
  }, [stats]);

  if (loading && models.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Cpu className="w-8 h-8 text-purple-500" />
            Models Catalog
          </h1>
          <p className="text-muted-foreground mt-1">
            Browse and manage AI models across all providers
          </p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Models</p>
                <p className="text-2xl font-bold">{stats.total_models}</p>
              </div>
              <Cpu className="w-8 h-8 text-purple-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-green-500">{stats.active_models}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Healthy</p>
                <p className="text-2xl font-bold text-green-500">
                  {stats.health_distribution.healthy}
                </p>
              </div>
              <Activity className="w-8 h-8 text-green-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Modalities</p>
                <p className="text-2xl font-bold text-blue-500">
                  {Object.keys(stats.by_modality).length}
                </p>
              </div>
              <Eye className="w-8 h-8 text-blue-500" />
            </div>
          </Card>
        </div>
      )}

      {/* Filters and Search */}
      <Card className="p-4">
        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            <Input
              placeholder="Search models by name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} size="sm">
              <Search className="w-4 h-4 mr-2" />
              Search
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={filterProvider}
              onChange={(e) => setFilterProvider(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="px-3 py-2 rounded-md border border-input bg-background text-sm"
            >
              <option value="all">All Providers</option>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-3 py-2 rounded-md border border-input bg-background text-sm"
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
            <select
              value={filterHealth}
              onChange={(e) => setFilterHealth(e.target.value as any)}
              className="px-3 py-2 rounded-md border border-input bg-background text-sm"
            >
              <option value="all">All Health</option>
              <option value="healthy">Healthy</option>
              <option value="degraded">Degraded</option>
              <option value="down">Down</option>
              <option value="unknown">Unknown</option>
            </select>
            <select
              value={filterModality}
              onChange={(e) => setFilterModality(e.target.value)}
              className="px-3 py-2 rounded-md border border-input bg-background text-sm"
            >
              <option value="all">All Modalities</option>
              {modalities.map((modality) => (
                <option key={modality} value={modality}>
                  {modality || 'Unknown'}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="p-4 border-red-500/20 bg-red-500/5">
          <div className="flex items-center gap-2 text-red-500">
            <XCircle className="w-5 h-5" />
            <p>{error}</p>
          </div>
        </Card>
      )}

      {/* Models Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Health</TableHead>
                <TableHead>Modality</TableHead>
                <TableHead>Context</TableHead>
                <TableHead>Pricing (Input/Output)</TableHead>
                <TableHead>Capabilities</TableHead>
                <TableHead>Avg Response</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredModels.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    No models found
                  </TableCell>
                </TableRow>
              ) : (
                filteredModels.map((model) => (
                  <TableRow key={model.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{model.model_name}</p>
                        <p className="text-xs text-muted-foreground">{model.model_id}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {model.provider ? (
                        <div className="flex items-center gap-2">
                          {model.provider.logo_url && (
                            <img
                              src={model.provider.logo_url}
                              alt={model.provider.name}
                              className="w-5 h-5 rounded"
                            />
                          )}
                          <span className="text-sm">{model.provider.name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={model.is_active ? 'default' : 'secondary'}>
                        {model.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>{getHealthBadge(model.health_status)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{model.modality || 'Unknown'}</Badge>
                    </TableCell>
                    <TableCell>
                      {model.context_length ? model.context_length.toLocaleString() : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs">
                        <div>{formatPrice(model.pricing_prompt)} / 1K</div>
                        <div className="text-muted-foreground">
                          {formatPrice(model.pricing_completion)} / 1K
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {model.supports_streaming && (
                          <div title="Streaming">
                            <Zap className="w-4 h-4 text-yellow-500" />
                          </div>
                        )}
                        {model.supports_function_calling && (
                          <div title="Function Calling">
                            <MessageSquare className="w-4 h-4 text-blue-500" />
                          </div>
                        )}
                        {model.supports_vision && (
                          <div title="Vision">
                            <Eye className="w-4 h-4 text-purple-500" />
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {model.average_response_time_ms
                        ? `${model.average_response_time_ms}ms`
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {filteredModels.length} of {models.length} models (Page {currentPage + 1})
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0 || loading}
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => p + 1)}
            disabled={models.length < pageSize || loading}
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
