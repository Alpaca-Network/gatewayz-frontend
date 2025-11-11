import type { UserTier } from './api';

export type Model = {
  name: string;
  isFree: boolean;
  tokens: string;
  category: string;
  description: string;
  developer: string;
  context: number;
  inputCost: number;
  outputCost: number;
  modalities: string[];
  series: string;
  supportedParameters: string[];
  requiredTier?: UserTier;
  speedTier?: 'ultra-fast' | 'fast' | 'medium' | 'slow'; // Response speed indicator
  avgLatencyMs?: number; // Average time-to-first-token in milliseconds
  is_private?: boolean; // Indicates if model is on a private network (e.g., NEAR)
};

export const models: Model[] = [
  {
    name: 'GPT-4o mini',
    isFree: false,
    tokens: '21B tokens',
    category: 'Multimodal',
    description: 'A smaller, faster, and cheaper version of GPT-4o, with the same level of intelligence.',
    developer: 'openai',
    context: 128,
    inputCost: 0.15,
    outputCost: 0.60,
    modalities: ['Text', 'Image'],
    series: 'GPT',
    supportedParameters: ['tools', 'temperature', 'top_p'],
  },
  {
    name: 'Qwen: Qwen2 72B A16B 2507',
    isFree: true,
    tokens: '142M tokens',
    category: 'Multilingual',
    description: 'Qwen2-72B-A16B-Instruct-2507 is a multilingual, instruction-tuned mixture-of-experts language model based on the Qwen2-72B architecture, with 16B active parameters per forward ...',
    developer: 'qwen',
    context: 262,
    inputCost: 0,
    outputCost: 0,
    modalities: ['Text', 'File'],
    series: 'Qwen',
    supportedParameters: ['tools', 'temperature'],
  },
  {
    name: 'Qwen: Qwen2 57B A14B 2507',
    isFree: false,
    tokens: '77.4M tokens',
    category: 'Multilingual',
    description: 'Qwen2-57B-A14B-Instruct-2507 is a multilingual, instruction-tuned mixture-of-experts language model based on the Qwen2-57B architecture, with 14B active parameters per forward ...',
    developer: 'qwen',
    context: 262,
    inputCost: 0.15,
    outputCost: 0.85,
    modalities: ['Text', 'File'],
    series: 'Qwen',
    supportedParameters: ['tools', 'temperature', 'top_p'],
  },
  {
    name: 'Switchpoint Router',
    isFree: false,
    tokens: '495M tokens',
    category: 'Router',
    description: 'Switchpoint AI\'s router instantly analyzes your request and directs it to the optimal AI from an ever-evolving library. As the world of LLMs advances, our router gets smarter, ensuring you always ...',
    developer: 'switchpoint',
    context: 131,
    inputCost: 0.85,
    outputCost: 3.40,
    modalities: ['Text'],
    series: 'Other',
    supportedParameters: ['temperature'],
  },
  {
    name: 'MoonshotAI: Kimi K2',
    isFree: true,
    tokens: '20.1B tokens',
    category: 'Multilingual',
    description: 'Kimi K2 is a powerful multilingual model with a large context window, developed by Moonshot AI.',
    developer: 'moonshotai',
    context: 200,
    inputCost: 0,
    outputCost: 0,
    modalities: ['Text', 'File'],
    series: 'Kimi',
    supportedParameters: ['temperature', 'top_p'],
  },
  {
    name: 'Google: Gemini 2.0 Flash',
    isFree: false,
    tokens: '18.5B tokens',
    category: 'Multimodal',
    description: 'Fast and efficient Gemini model optimized for speed and performance with multimodal capabilities.',
    developer: 'google',
    context: 1024,
    inputCost: 0.075,
    outputCost: 0.3,
    modalities: ['Text', 'Image', 'File'],
    series: 'Gemini',
    supportedParameters: ['tools', 'temperature', 'top_p'],
  },
  {
    name: 'Google: Gemini 2.1 Pro',
    isFree: false,
    tokens: '19.5B tokens',
    category: 'Multimodal',
    description: 'The latest and most capable Gemini model from Google, with advanced multimodal reasoning.',
    developer: 'google',
    context: 1024,
    inputCost: 0.5,
    outputCost: 1.5,
    modalities: ['Text', 'Image', 'File'],
    series: 'Gemini',
    supportedParameters: ['tools', 'temperature', 'top_p'],
  },
  {
    name: 'Anthropic: Claude 3.5 Sonnet',
    isFree: false,
    tokens: '19.2B tokens',
    category: 'Multimodal',
    description: 'Claude 3.5 Sonnet sets new industry standards for intelligence, speed, and cost, outperforming competitor models and previous generation.',
    developer: 'anthropic',
    context: 200,
    inputCost: 0.25,
    outputCost: 1.25,
    modalities: ['Text', 'Image'],
    series: 'Claude',
    supportedParameters: ['tools', 'temperature', 'top_p'],
  },
  {
    name: 'Meta: Llama 3.1 405B',
    isFree: false,
    tokens: '18.8B tokens',
    category: 'Language',
    description: 'The most powerful model in the Llama 3.1 series, with a massive 405 billion parameters for unparalleled performance.',
    developer: 'meta',
    context: 128,
    inputCost: 0.9,
    outputCost: 2.5,
    modalities: ['Text'],
    series: 'Llama',
    supportedParameters: ['temperature', 'top_p'],
  },
  {
    name: 'Arch-Router-1.5B',
    isFree: true,
    tokens: '19.2B tokens',
    category: 'Router',
    description: 'Arch-Router-1.5B is a routing model based on Qwen2.5-1.5B-Instruct, designed for intelligent request routing and preference tasks.',
    developer: 'katanemo',
    context: 256,
    inputCost: 0,
    outputCost: 0,
    modalities: ['Text'],
    series: 'Other',
    supportedParameters: ['temperature', 'top_p'],
  },
  {
    name: 'DeepSeek V3',
    isFree: false,
    tokens: '671B tokens',
    category: 'Reasoning',
    description: 'DeepSeek V3 is a powerful Mixture-of-Experts model with 671B total parameters and 37B activated per token. Features multi-head latent attention and DeepSeekMoE architecture for enhanced performance and efficiency.',
    developer: 'alpaca-network',
    context: 64,
    inputCost: 0.27,
    outputCost: 1.10,
    modalities: ['Text'],
    series: 'DeepSeek',
    supportedParameters: ['temperature', 'top_p', 'max_tokens'],
    speedTier: 'fast',
    is_private: true,
  }
];
