/**
 * Tests for model detail page redirects
 * Tests the actual ModelProfilePage component redirect behavior
 */

import { render, waitFor } from '@testing-library/react';
import { useRouter, useParams } from 'next/navigation';
import ModelProfilePage from '../page';

// Mock Next.js router and params
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useParams: jest.fn(),
}));

// Mock other dependencies
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}));

jest.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

jest.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: any) => <>{children}</>,
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ children }: any) => <div>{children}</div>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: () => <div>Select</div>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children, value }: any) => <option value={value}>{children}</option>,
}));

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: any) => <div>{children}</div>,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
  DialogTrigger: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/components/ui/table', () => ({
  Table: ({ children }: any) => <table>{children}</table>,
  TableBody: ({ children }: any) => <tbody>{children}</tbody>,
  TableCell: ({ children }: any) => <td>{children}</td>,
  TableHead: ({ children }: any) => <th>{children}</th>,
  TableHeader: ({ children }: any) => <thead>{children}</thead>,
  TableRow: ({ children }: any) => <tr>{children}</tr>,
}));

jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('recharts', () => ({
  AreaChart: () => <div>AreaChart</div>,
  Area: () => <div>Area</div>,
  XAxis: () => <div>XAxis</div>,
  YAxis: () => <div>YAxis</div>,
  CartesianGrid: () => <div>CartesianGrid</div>,
  Tooltip: () => <div>Tooltip</div>,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  LineChart: () => <div>LineChart</div>,
  Line: () => <div>Line</div>,
  Legend: () => <div>Legend</div>,
}));

jest.mock('@/lib/api', () => ({
  getApiKey: jest.fn(() => 'test-api-key'),
}));

jest.mock('@/components/models/inline-chat', () => ({
  InlineChat: () => <div>InlineChat</div>,
}));

jest.mock('@/lib/http', () => ({
  safeParseJson: jest.fn(async (response) => {
    return response.json();
  }),
}));

describe('ModelProfilePage - Redirect Behavior', () => {
  let mockReplace: jest.Mock;
  let mockRouter: any;

  beforeEach(() => {
    mockReplace = jest.fn();
    mockRouter = {
      replace: mockReplace,
      push: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
      prefetch: jest.fn(),
    };
    (useRouter as jest.Mock).mockReturnValue(mockRouter);

    // Mock fetch for API calls
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Not found' }),
      } as Response)
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Cerebras qwen-3-32b redirect', () => {
    it('should redirect cerebras/qwen-3-32b to qwen/qwen2-5-32b', async () => {
      // Mock params for cerebras/qwen-3-32b URL
      (useParams as jest.Mock).mockReturnValue({
        name: ['cerebras', 'qwen-3-32b'],
      });

      render(<ModelProfilePage />);

      // Wait for the useEffect to trigger the redirect
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/models/qwen/qwen2-5-32b');
      }, { timeout: 1000 });

      expect(mockReplace).toHaveBeenCalledTimes(1);
    });

    it('should not redirect other cerebras models', async () => {
      const testCases = [
        ['cerebras', 'llama3-1-8b'],
        ['cerebras', 'llama-3-3-70b'],
        ['cerebras', 'gpt-oss-120b'],
        ['cerebras', 'qwen-3-235b-a22b-instruct-2507'],
        ['cerebras', 'zai-glm-4-6'],
      ];

      for (const params of testCases) {
        mockReplace.mockClear();
        (useParams as jest.Mock).mockReturnValue({ name: params });

        render(<ModelProfilePage />);

        // Wait a bit to ensure no redirect happens
        await new Promise(resolve => setTimeout(resolve, 100));

        expect(mockReplace).not.toHaveBeenCalledWith('/models/qwen/qwen2-5-32b');
      }
    });

    it('should not redirect qwen-3-32b from other providers', async () => {
      const testCases = [
        ['qwen', 'qwen-3-32b'],
        ['openrouter', 'qwen-3-32b'],
        ['huggingface', 'qwen-3-32b'],
      ];

      for (const params of testCases) {
        mockReplace.mockClear();
        (useParams as jest.Mock).mockReturnValue({ name: params });

        render(<ModelProfilePage />);

        // Wait a bit to ensure no redirect happens
        await new Promise(resolve => setTimeout(resolve, 100));

        expect(mockReplace).not.toHaveBeenCalledWith('/models/qwen/qwen2-5-32b');
      }
    });
  });

  describe('Alibaba models - no redirect', () => {
    // Alibaba Cloud models now have developer: 'alibaba' and should NOT redirect
    // They should be accessible directly at /models/alibaba/...
    it('should not redirect alibaba models (they have their own developer tag)', async () => {
      const testCases = [
        ['alibaba', 'qwen2-5-32b'],
        ['alibaba', 'qwen2-5-72b'],
        ['alibaba', 'qwen-turbo'],
      ];

      for (const params of testCases) {
        mockReplace.mockClear();
        (useParams as jest.Mock).mockReturnValue({ name: params });

        render(<ModelProfilePage />);

        // Wait a bit to ensure no redirect happens
        await new Promise(resolve => setTimeout(resolve, 100));

        // Should NOT redirect alibaba models - they have their own developer tag now
        const calls = mockReplace.mock.calls.filter((call: any[]) =>
          call[0].includes('/models/qwen/')
        );
        expect(calls).toHaveLength(0);
      }
    });
  });

  describe('Redirect specificity', () => {
    it('should redirect cerebras qwen-3-32b to the correct qwen model', async () => {
      // This test ensures cerebras/qwen-3-32b goes to the specific qwen2-5-32b page
      (useParams as jest.Mock).mockReturnValue({
        name: ['cerebras', 'qwen-3-32b'],
      });

      render(<ModelProfilePage />);

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalled();
      }, { timeout: 1000 });

      // Should redirect to the specific qwen2-5-32b model
      expect(mockReplace).toHaveBeenCalledWith('/models/qwen/qwen2-5-32b');
      expect(mockReplace).not.toHaveBeenCalledWith('/models/qwen/qwen-3-32b');
    });
  });

  describe('Redirect URL format validation', () => {
    it('should use normalized URL format with hyphens', async () => {
      (useParams as jest.Mock).mockReturnValue({
        name: ['cerebras', 'qwen-3-32b'],
      });

      render(<ModelProfilePage />);

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalled();
      }, { timeout: 1000 });

      const redirectUrl = mockReplace.mock.calls[0][0];

      // Verify URL uses hyphens (normalized format) not periods
      expect(redirectUrl).toBe('/models/qwen/qwen2-5-32b');
      expect(redirectUrl).toContain('qwen2-5-32b');
      expect(redirectUrl).not.toContain('qwen2.5');
      expect(redirectUrl).not.toContain('qwen-3-32b');
    });
  });

  describe('Invalid URL handling', () => {
    it('should show invalid URL message for malformed paths', () => {
      (useParams as jest.Mock).mockReturnValue({
        name: ['cerebras'], // Missing model name
      });

      const { getByText } = render(<ModelProfilePage />);

      expect(getByText(/Invalid Model URL/i)).toBeInTheDocument();
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it('should show invalid URL message for empty paths', () => {
      (useParams as jest.Mock).mockReturnValue({
        name: [],
      });

      const { getByText } = render(<ModelProfilePage />);

      expect(getByText(/Invalid Model URL/i)).toBeInTheDocument();
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });
});
