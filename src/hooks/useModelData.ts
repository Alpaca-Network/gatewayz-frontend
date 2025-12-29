
import { useState, useEffect, useMemo } from 'react';
import type { ModelData, AppData } from '@/lib/data';
import { topModels, monthlyModelTokenData, weeklyModelTokenData, yearlyModelTokenData, adjustModelDataForTimeRange, topApps, adjustAppDataForTimeRange } from '@/lib/data';
import type { TimeFrameOption } from '@/components/dashboard/top-apps-table';
import { captureHookError, addStateChangeBreadcrumb } from '@/lib/sentry-utils';


export type TimeRange = 'year' | 'month' | 'week';

export function useModelData(selectedTimeRange: TimeRange, selectedCategory: ModelData['category'] | 'All', appTimeFrame?: TimeFrameOption) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    try {
      setIsClient(true);
    } catch (error) {
      captureHookError(error, {
        hookName: 'useModelData',
        operation: 'client_mount',
      });
    }
  }, []);

  const chartData = useMemo(() => {
    try {
      const data = (() => {
        switch (selectedTimeRange) {
          case 'week':
            return weeklyModelTokenData;
          case 'month':
            return monthlyModelTokenData;
          case 'year':
          default:
            return yearlyModelTokenData;
        }
      })();
      addStateChangeBreadcrumb('useModelData', 'chartData', {
        timeRange: selectedTimeRange,
        dataLength: data?.length || 0,
      });
      return data;
    } catch (error) {
      captureHookError(error, {
        hookName: 'useModelData',
        operation: 'chart_data_memo',
        selectedTimeRange,
      });
      return yearlyModelTokenData;
    }
  }, [selectedTimeRange]);

  const filteredModels = useMemo(() => {
    try {
      if (!isClient) {
        const initialModels = selectedCategory === 'All'
          ? topModels
          : topModels.filter(model => model.category === selectedCategory);
        return initialModels.slice(0, 20);
      }

      const adjustedModels = adjustModelDataForTimeRange(topModels, selectedTimeRange);

      const categoryFilteredModels = selectedCategory === 'All'
        ? adjustedModels
        : adjustedModels.filter(model => model.category === selectedCategory);

      return categoryFilteredModels.slice(0, 20);
    } catch (error) {
      captureHookError(error, {
        hookName: 'useModelData',
        operation: 'filtered_models_memo',
        selectedTimeRange,
        selectedCategory,
      });
      return topModels.slice(0, 20);
    }
  }, [isClient, selectedTimeRange, selectedCategory]);

  const adjustedApps = useMemo(() => {
    try {
      if (!isClient || !appTimeFrame) {
        return topApps.slice(0, 20);
      }
      return adjustAppDataForTimeRange(topApps, appTimeFrame);
    } catch (error) {
      captureHookError(error, {
        hookName: 'useModelData',
        operation: 'adjusted_apps_memo',
        appTimeFrame,
      });
      return topApps.slice(0, 20);
    }
  }, [isClient, appTimeFrame]);

  return { filteredModels, chartData, adjustedApps };
}
