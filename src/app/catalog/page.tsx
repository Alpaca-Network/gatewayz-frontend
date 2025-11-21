"use client";

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Server, Cpu, ArrowRight, Database } from 'lucide-react';

export default function CatalogPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold flex items-center justify-center gap-3">
            <Database className="w-10 h-10 text-blue-500" />
            Catalog Management
          </h1>
          <p className="text-muted-foreground text-lg">
            View and manage providers and models from your backend database
          </p>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
          {/* Providers Card */}
          <Link href="/catalog/providers">
            <Card className="p-8 hover:shadow-lg transition-all duration-300 cursor-pointer group h-full">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="p-4 rounded-full bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                  <Server className="w-12 h-12 text-blue-500" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold">Providers</h2>
                  <p className="text-muted-foreground">
                    Manage AI model providers, monitor health status, and view capabilities
                  </p>
                </div>
                <div className="flex items-center gap-2 text-blue-500 font-medium group-hover:gap-3 transition-all">
                  View Providers
                  <ArrowRight className="w-5 h-5" />
                </div>
              </div>
            </Card>
          </Link>

          {/* Models Card */}
          <Link href="/catalog/models">
            <Card className="p-8 hover:shadow-lg transition-all duration-300 cursor-pointer group h-full">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="p-4 rounded-full bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
                  <Cpu className="w-12 h-12 text-purple-500" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold">Models</h2>
                  <p className="text-muted-foreground">
                    Browse AI models across all providers, view pricing, and manage availability
                  </p>
                </div>
                <div className="flex items-center gap-2 text-purple-500 font-medium group-hover:gap-3 transition-all">
                  View Models
                  <ArrowRight className="w-5 h-5" />
                </div>
              </div>
            </Card>
          </Link>
        </div>

        {/* Info Section */}
        <Card className="p-6 bg-blue-500/5 border-blue-500/20 mt-8">
          <div className="space-y-2">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-500" />
              About the Catalog
            </h3>
            <p className="text-sm text-muted-foreground">
              This catalog displays real-time data from your backend database tables:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 ml-6 list-disc">
              <li>
                <strong>Providers table:</strong> Stores information about AI model providers including health status, capabilities, and metadata
              </li>
              <li>
                <strong>Models table:</strong> Contains all AI models with pricing, context length, modalities, and health monitoring
              </li>
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
}
