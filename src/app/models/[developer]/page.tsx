'use client';

import { useState, useMemo, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { models as staticModels } from '@/lib/models-data';
import { Search, ChevronRight, Box } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Model {
  name: string;
  developer: string;
  description: string;
  context: number;
  inputCost: number;
  outputCost: number;
  isFree: boolean;
  tokens: string;
  category: string;
  modalities: string[];
}

export default function DeveloperModelsPage() {
  const params = useParams();
  const developer = (params.developer as string)?.toLowerCase() || '';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Filter models by developer
  const developerModels = useMemo(() => {
    return staticModels.filter(m => m.developer.toLowerCase() === developer);
  }, [developer]);

  // Get unique categories for this developer
  const categories = useMemo(() => {
    const cats = new Set(developerModels.map(m => m.category));
    return Array.from(cats).sort();
  }, [developerModels]);

  // Filter by search and category
  const filteredModels = useMemo(() => {
    return developerModels.filter(model => {
      const matchesSearch = model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           model.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = !selectedCategory || model.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [developerModels, searchQuery, selectedCategory]);

  // Determine developer display name and info
  const developerDisplayName = developer.charAt(0).toUpperCase() + developer.slice(1);
  const developerModelsCount = developerModels.length;

  if (developerModels.length === 0) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 max-w-screen-2xl">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">Developer Not Found</h1>
          <p className="text-muted-foreground mb-6">
            No models found for developer: <code className="px-2 py-1 bg-muted rounded text-sm">{developer}</code>
          </p>
          <Link href="/models">
            <Button>Browse All Models</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 max-w-screen-2xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Link href="/models" className="text-primary hover:underline text-sm">
            Models
          </Link>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{developerDisplayName}</span>
        </div>
        <h1 className="text-3xl lg:text-4xl font-bold mb-2">{developerDisplayName} Models</h1>
        <p className="text-lg text-muted-foreground">
          Exploring {developerModelsCount} model{developerModelsCount !== 1 ? 's' : ''} from {developerDisplayName}
        </p>
      </div>

      {/* Search and Filters */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search models by name or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Category Filter */}
            {categories.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-3">Categories</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={selectedCategory === null ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedCategory(null)}
                  >
                    All
                  </Button>
                  {categories.map(category => (
                    <Button
                      key={category}
                      variant={selectedCategory === category ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedCategory(category)}
                    >
                      {category}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Results count */}
            <p className="text-sm text-muted-foreground">
              Showing {filteredModels.length} of {developerModelsCount} model{developerModelsCount !== 1 ? 's' : ''}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Models Grid */}
      {filteredModels.length === 0 ? (
        <Card className="p-12 text-center">
          <Box className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-semibold mb-2">No models found</h3>
          <p className="text-muted-foreground">
            {searchQuery ? 'Try adjusting your search query' : 'Try selecting a different category'}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredModels.map((model) => (
            <Link
              key={model.name}
              href={`/models/${model.developer.toLowerCase()}/${model.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
            >
              <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  {/* Model header */}
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold mb-2 line-clamp-2">{model.name}</h3>
                    <div className="flex flex-wrap gap-1 mb-3">
                      <Badge variant="secondary" className="text-xs">
                        {model.category}
                      </Badge>
                      {model.isFree && (
                        <Badge className="bg-black text-white hover:bg-gray-800 text-xs">
                          Free
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                    {model.description}
                  </p>

                  {/* Model info */}
                  <div className="space-y-2 mb-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Context:</span>
                      <span className="font-medium">{model.context.toLocaleString()}K</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Input Cost:</span>
                      <span className="font-medium">${(model.inputCost * 1000000).toFixed(2)}/M</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Output Cost:</span>
                      <span className="font-medium">${(model.outputCost * 1000000).toFixed(2)}/M</span>
                    </div>
                  </div>

                  {/* Modalities */}
                  {model.modalities.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {model.modalities.map(modality => (
                        <Badge
                          key={modality}
                          variant="outline"
                          className="text-xs"
                        >
                          {modality}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Action */}
                  <Button className="w-full mt-4" variant="outline" size="sm">
                    View Details
                  </Button>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Back link */}
      <div className="mt-12 text-center">
        <Link href="/models" className="text-primary hover:underline">
          ← Back to all models
        </Link>
      </div>
    </div>
  );
}
