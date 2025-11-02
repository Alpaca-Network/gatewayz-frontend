import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const stringToColor = (str: string | null | undefined) => {
  if (!str) return 'hsl(0, 0%, 85%)'; // Default gray for null/undefined
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = hash % 360;
  // Use a slightly different HSL range for better pastel colors
  return `hsl(${h}, 60%, 85%)`;
};

export const extractTokenValue = (str: string): string | null => {
  const match = str.match(/^(\d+(?:\.\d+)?[BTMK])\s*tokens$/i);
  return match ? match[1] : null;
};