"use client";

import { useState, useEffect, useMemo } from 'react';
import { ProviderAPI, Provider, ProviderStats, HealthStatus } from '@/lib/catalog-api';
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
  Server,
  Activity,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  ExternalLink,
  Zap,
  Eye,
  Image as ImageIcon,
  MessageSquare,
} from 'lucide-react';

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [stats, setStats] = useState<ProviderStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterHealth, setFilterHealth] = useState<HealthStatus | 'all'>('all');

  const fetchProviders = async () => {
    try {
      setLoading(true);
      setError(null);

      const [providersData, statsData] = await Promise.all([
        ProviderAPI.getAllProviders({ include_inactive: true }),
        ProviderAPI.getProviderStats(),
      ]);

      setProviders(providersData);
      setStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load providers');
      console.error('Error fetching providers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      fetchProviders();
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const results = await ProviderAPI.searchProviders(searchQuery);
      setProviders(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const filteredProviders = useMemo(() => {
    return providers.filter((provider) => {
      const matchesStatus =
        filterStatus === 'all' ||
        (filterStatus === 'active' && provider.is_active) ||
        (filterStatus === 'inactive' && !provider.is_active);

      const matchesHealth =
        filterHealth === 'all' || provider.health_status === filterHealth;

      return matchesStatus && matchesHealth;
    });
  }, [providers, filterStatus, filterHealth]);

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

  if (loading && providers.length === 0) {
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
            <Server className="w-8 h-8 text-blue-500" />
            Provider Catalog
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage and monitor AI model providers
          </p>
        </div>
        <Button onClick={fetchProviders} variant="outline" size="sm">
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
                <p className="text-sm text-muted-foreground">Total Providers</p>
                <p className="text-2xl font-bold">{stats.total_providers}</p>
              </div>
              <Server className="w-8 h-8 text-blue-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-green-500">{stats.active_providers}</p>
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
                <p className="text-sm text-muted-foreground">Issues</p>
                <p className="text-2xl font-bold text-yellow-500">
                  {stats.health_distribution.degraded + stats.health_distribution.down}
                </p>
              </div>
              <AlertCircle className="w-8 h-8 text-yellow-500" />
            </div>
          </Card>
        </div>
      )}

      {/* Filters and Search */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="flex gap-2">
              <Input
                placeholder="Search providers by name or slug..."
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
          </div>
          <div className="flex gap-2">
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

      {/* Providers Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Health</TableHead>
                <TableHead>Capabilities</TableHead>
                <TableHead>Avg Response</TableHead>
                <TableHead>Links</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProviders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No providers found
                  </TableCell>
                </TableRow>
              ) : (
                filteredProviders.map((provider) => (
                  <TableRow key={provider.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {provider.logo_url && (
                          <img
                            src={provider.logo_url}
                            alt={provider.name}
                            className="w-8 h-8 rounded object-cover"
                          />
                        )}
                        <div>
                          <p className="font-medium">{provider.name}</p>
                          <p className="text-sm text-muted-foreground">{provider.slug}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={provider.is_active ? 'default' : 'secondary'}>
                        {provider.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>{getHealthBadge(provider.health_status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {provider.supports_streaming && (
                          <div title="Streaming">
                            <Zap className="w-4 h-4 text-yellow-500" />
                          </div>
                        )}
                        {provider.supports_function_calling && (
                          <div title="Function Calling">
                            <MessageSquare className="w-4 h-4 text-blue-500" />
                          </div>
                        )}
                        {provider.supports_vision && (
                          <div title="Vision">
                            <Eye className="w-4 h-4 text-purple-500" />
                          </div>
                        )}
                        {provider.supports_image_generation && (
                          <div title="Image Generation">
                            <ImageIcon className="w-4 h-4 text-pink-500" />
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {provider.average_response_time_ms
                        ? `${provider.average_response_time_ms}ms`
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {provider.site_url && (
                          <a
                            href={provider.site_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-700"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Results Count */}
      <div className="text-sm text-muted-foreground text-center">
        Showing {filteredProviders.length} of {providers.length} providers
      </div>
    </div>
  );
}
