/**
 * Tests for useModelData hook
 * Provides model data filtering and time range adjustments
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useModelData } from '../useModelData';
import * as data from '@/lib/data';
import * as sentryUtils from '@/lib/sentry-utils';

// Mock data module
jest.mock('@/lib/data', () => ({
  topModels: [
    { id: '1', name: 'Model 1', category: 'Text', tokens: 1000 },
    { id: '2', name: 'Model 2', category: 'Image', tokens: 2000 },
    { id: '3', name: 'Model 3', category: 'Text', tokens: 3000 },
    { id: '4', name: 'Model 4', category: 'Code', tokens: 4000 },
  ],
  topApps: [
    { id: '1', name: 'App 1', requests: 100 },
    { id: '2', name: 'App 2', requests: 200 },
  ],
  weeklyModelTokenData: [{ date: '2024-01-01', value: 100 }],
  monthlyModelTokenData: [{ date: '2024-01-01', value: 200 }],
  yearlyModelTokenData: [{ date: '2024-01-01', value: 300 }],
  adjustModelDataForTimeRange: jest.fn((models, timeRange) => models),
  adjustAppDataForTimeRange: jest.fn((apps, timeFrame) => apps.slice(0, 20)),
}));

// Mock sentry utils
jest.mock('@/lib/sentry-utils', () => ({
  captureHookError: jest.fn(),
  addStateChangeBreadcrumb: jest.fn(),
}));

describe('useModelData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Time Range Selection', () => {
    it('should return yearly data by default', () => {
      const { result } = renderHook(() => useModelData('year', 'All'));

      expect(result.current.chartData).toEqual(data.yearlyModelTokenData);
    });

    it('should return monthly data when month is selected', () => {
      const { result } = renderHook(() => useModelData('month', 'All'));

      expect(result.current.chartData).toEqual(data.monthlyModelTokenData);
    });

    it('should return weekly data when week is selected', () => {
      const { result } = renderHook(() => useModelData('week', 'All'));

      expect(result.current.chartData).toEqual(data.weeklyModelTokenData);
    });
  });

  describe('Category Filtering', () => {
    it('should return all models when category is "All"', async () => {
      const { result } = renderHook(() => useModelData('year', 'All'));

      // Wait for client-side mounting
      await waitFor(() => {
        expect(result.current.filteredModels.length).toBeGreaterThan(0);
      });

      expect(data.adjustModelDataForTimeRange).toHaveBeenCalledWith(
        data.topModels,
        'year'
      );
    });

    it('should filter models by category', async () => {
      const { result } = renderHook(() => useModelData('year', 'Text'));

      await waitFor(() => {
        expect(result.current.filteredModels.length).toBeGreaterThan(0);
      });

      // Should call adjust function with topModels
      expect(data.adjustModelDataForTimeRange).toHaveBeenCalled();
    });

    it('should limit results to 20 models', async () => {
      const { result } = renderHook(() => useModelData('year', 'All'));

      await waitFor(() => {
        expect(result.current.filteredModels.length).toBeLessThanOrEqual(20);
      });
    });
  });

  describe('Client-Side Mounting', () => {
    it('should handle server-side rendering', () => {
      const { result } = renderHook(() => useModelData('year', 'All'));

      // Initially should return limited models
      expect(result.current.filteredModels).toBeDefined();
      expect(Array.isArray(result.current.filteredModels)).toBe(true);
    });

    it('should update after client mount', async () => {
      const { result } = renderHook(() => useModelData('year', 'All'));

      // Wait for client-side effect
      await waitFor(() => {
        expect(data.adjustModelDataForTimeRange).toHaveBeenCalled();
      });
    });
  });

  describe('App Data', () => {
    it('should return top apps without timeframe', () => {
      const { result } = renderHook(() => useModelData('year', 'All'));

      expect(result.current.adjustedApps).toBeDefined();
      expect(Array.isArray(result.current.adjustedApps)).toBe(true);
    });

    it('should adjust apps with timeframe', async () => {
      const { result } = renderHook(() =>
        useModelData('year', 'All', '30days')
      );

      await waitFor(() => {
        expect(data.adjustAppDataForTimeRange).toHaveBeenCalledWith(
          data.topApps,
          '30days'
        );
      });
    });

    it('should limit apps to 20', async () => {
      const { result } = renderHook(() =>
        useModelData('year', 'All', '30days')
      );

      await waitFor(() => {
        expect(result.current.adjustedApps.length).toBeLessThanOrEqual(20);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle errors in chartData memo', () => {
      // Force an error by making data access throw
      const mockError = new Error('Chart data error');
      jest.spyOn(data, 'weeklyModelTokenData', 'get').mockImplementation(() => {
        throw mockError;
      });

      const { result } = renderHook(() => useModelData('week', 'All'));

      // Should return fallback data
      expect(result.current.chartData).toEqual(data.yearlyModelTokenData);

      // Should capture error
      expect(sentryUtils.captureHookError).toHaveBeenCalledWith(
        mockError,
        expect.objectContaining({
          hookName: 'useModelData',
          operation: 'chart_data_memo',
        })
      );
    });

    it('should handle errors in filteredModels memo', async () => {
      const mockError = new Error('Filter error');
      (data.adjustModelDataForTimeRange as jest.Mock).mockImplementation(() => {
        throw mockError;
      });

      const { result } = renderHook(() => useModelData('year', 'Text'));

      await waitFor(() => {
        expect(sentryUtils.captureHookError).toHaveBeenCalledWith(
          mockError,
          expect.objectContaining({
            hookName: 'useModelData',
            operation: 'filtered_models_memo',
          })
        );
      });

      // Should return fallback data
      expect(result.current.filteredModels.length).toBeLessThanOrEqual(20);
    });

    it('should handle errors in adjustedApps memo', async () => {
      const mockError = new Error('Apps error');
      (data.adjustAppDataForTimeFrame as jest.Mock).mockImplementation(() => {
        throw mockError;
      });

      const { result } = renderHook(() =>
        useModelData('year', 'All', '30days')
      );

      await waitFor(() => {
        expect(result.current.adjustedApps).toBeDefined();
      });
    });
  });

  describe('Memoization', () => {
    it('should memoize chartData based on timeRange', () => {
      const { result, rerender } = renderHook(
        ({ timeRange, category }) => useModelData(timeRange, category),
        {
          initialProps: { timeRange: 'year' as const, category: 'All' as const },
        }
      );

      const firstChartData = result.current.chartData;

      // Re-render with same props
      rerender({ timeRange: 'year', category: 'Text' });

      // Chart data should be same reference (memoized)
      expect(result.current.chartData).toBe(firstChartData);
    });

    it('should update chartData when timeRange changes', () => {
      const { result, rerender } = renderHook(
        ({ timeRange, category }) => useModelData(timeRange, category),
        {
          initialProps: { timeRange: 'year' as const, category: 'All' as const },
        }
      );

      const firstChartData = result.current.chartData;

      // Change timeRange
      rerender({ timeRange: 'month', category: 'All' });

      // Chart data should be different
      expect(result.current.chartData).not.toBe(firstChartData);
    });

    it('should memoize filteredModels based on category and timeRange', async () => {
      const { result, rerender } = renderHook(
        ({ timeRange, category }) => useModelData(timeRange, category),
        {
          initialProps: { timeRange: 'year' as const, category: 'All' as const },
        }
      );

      await waitFor(() => {
        expect(result.current.filteredModels.length).toBeGreaterThan(0);
      });

      const firstFilteredModels = result.current.filteredModels;

      // Re-render with same props
      rerender({ timeRange: 'year', category: 'All' });

      // Should be same reference (memoized)
      expect(result.current.filteredModels).toBe(firstFilteredModels);
    });
  });

  describe('Breadcrumb Logging', () => {
    it('should add breadcrumb for chartData changes', () => {
      renderHook(() => useModelData('week', 'All'));

      expect(sentryUtils.addStateChangeBreadcrumb).toHaveBeenCalledWith(
        'useModelData',
        'chartData',
        expect.objectContaining({
          timeRange: 'week',
        })
      );
    });
  });
});
