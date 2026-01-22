# Gatewayz Frontend

Gatewayz is a comprehensive AI model management platform, providing a unified interface for accessing and managing various Large Language Models (LLMs). The platform offers model browsing, interactive chat functionality, performance analytics, and developer tools.

## Features

### Core Functionality
- **Unified Model Access**: Browse and access 300+ AI models from 60+ providers through a single interface
- **Interactive Chat**: Real-time chat interface with multiple AI models
- **Model Analytics**: Comprehensive rankings and performance insights
- **Developer Tools**: API management, settings, and integration tools
- **Responsive Design**: Modern UI with dark/light theme support
- **Authentication**: Secure user authentication with Privy (email, Google, GitHub)

### Key Pages
- **Home**: Landing page with featured models and platform overview
- **Models**: Comprehensive model browser with filtering and search capabilities
- **Chat**: Interactive chat interface with model selection
- **Inbox**: AI coding agent inbox powered by Terragon (see [docs/TERRAGON_INBOX_SETUP.md](../docs/TERRAGON_INBOX_SETUP.md))
- **Rankings**: Performance analytics and model comparisons
- **Settings**: User preferences, API keys, and configuration management
- **Developers**: Developer resources and documentation
- **Organizations**: Organization management and team features

## 🛠️ Tech Stack

### Frontend
- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **Radix UI** - Accessible component primitives
- **Lucide React** - Icon library
- **Recharts** - Data visualization
- **Chart.js** - Advanced charting capabilities

### Authentication
- **Privy** - Web3-native authentication with email, Google, and GitHub
- **NextAuth.js** - Additional authentication support

### AI Integration
- **Google Genkit** - AI orchestration framework
- **Google AI** - Gemini model integration
- **Firebase** - Backend services and database

### Development Tools
- **ESLint** - Code linting
- **PostCSS** - CSS processing
- **pnpm** - Package management
- **Faker.js** - Mock data generation

## 📁 Project Structure

```
gatewayz-frontend/
├── src/
│   ├── ai/                    # AI integration and flows
│   │   ├── dev.ts            # Development AI configuration
│   │   ├── flows/
│   │   │   └── chat-flow.ts  # Chat flow implementation
│   │   └── genkit.ts         # Genkit AI setup
│   ├── app/                  # Next.js App Router pages
│   │   ├── api/             # API routes
│   │   │   ├── auth/        # Authentication endpoints
│   │   │   ├── init-db/     # Database initialization
│   │   │   └── test-db/     # Database testing
│   │   ├── chat/            # Chat interface
│   │   ├── models/          # Model browser
│   │   │   └── [name]/      # Dynamic model pages
│   │   ├── organizations/   # Organization management
│   │   │   └── [name]/      # Dynamic organization pages
│   │   ├── rankings/        # Analytics dashboard
│   │   ├── settings/        # User settings
│   │   │   ├── account/     # Account management
│   │   │   ├── activity/    # Activity logs
│   │   │   ├── credits/     # Credit management
│   │   │   ├── integrations/# Integration settings
│   │   │   ├── keys/        # API key management
│   │   │   ├── presets/     # Preset management
│   │   │   ├── privacy/     # Privacy settings
│   │   │   └── provisioning/# Provisioning settings
│   │   └── developers/      # Developer resources
│   ├── components/          # Reusable UI components
│   │   ├── ui/             # Base UI components (Radix UI)
│   │   ├── auth/           # Authentication components
│   │   ├── chat/           # Chat-specific components
│   │   ├── dashboard/      # Analytics components
│   │   ├── layout/         # Layout components
│   │   ├── models/         # Model-related components
│   │   ├── providers/      # Context providers
│   │   └── theme-provider.tsx # Theme management
│   ├── hooks/              # Custom React hooks
│   │   ├── use-auth.ts     # Authentication hook
│   │   ├── use-mobile.tsx  # Mobile detection
│   │   ├── use-toast.ts    # Toast notifications
│   │   └── useModelData.ts # Model data management
│   ├── lib/                # Utilities and data
│   │   ├── data.ts         # Model and analytics data
│   │   ├── database.ts     # Database utilities
│   │   ├── firebase.ts     # Firebase configuration
│   │   ├── models-data.ts  # Model definitions
│   │   ├── privy.ts        # Privy authentication config
│   │   ├── provider-data.ts# Provider information
│   │   └── utils.ts        # General utilities
│   └── styles/             # Global styles
├── docs/                   # Documentation
├── public/                 # Static assets
│   ├── assets/            # Images and icons
│   └── *.svg              # SVG assets
└── apphosting.yaml        # Firebase App Hosting config
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- pnpm (recommended) or npm
- Privy account (for authentication)
- Google AI API key (for Genkit)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd gatewayz-frontend
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   # or
   npm install
   ```

3. **Environment Setup**
   Create a `.env.local` file in the root directory:
   ```env
   # Privy Configuration
   NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id
   
   # Google AI API Key (for Genkit)
   GOOGLE_AI_API_KEY=your-google-ai-api-key
   ```

4. **Privy Setup**
   - Create a Privy account at [dashboard.privy.io](https://dashboard.privy.io/)
   - Create a new app and get your App ID
   - Configure login methods (email, Google, GitHub)
   - Set up OAuth providers for Google and GitHub
   - Add your domain to authorized domains

5. **Start development server**
   ```bash
   pnpm dev
   # or
   npm run dev
   ```

6. **Start AI development server** (in a separate terminal)
   ```bash
   pnpm genkit:dev
   ```

The application will be available at `http://localhost:3000`

## 📊 Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint
- `pnpm typecheck` - Run TypeScript type checking
- `pnpm genkit:dev` - Start Genkit AI development server
- `pnpm genkit:watch` - Start Genkit with file watching

## 🎯 Key Features Deep Dive

### Authentication System
- **Privy Integration**: Web3-native authentication with multiple providers
- **Multiple Login Methods**: Email/password, Google OAuth, GitHub OAuth
- **Secure Session Management**: JWT-based authentication with automatic refresh
- **User Profile Management**: Comprehensive user settings and preferences

### Model Management
- **300+ Models**: Access to models from OpenAI, Google, Anthropic, Meta, and more
- **Advanced Filtering**: Filter by modality, context length, pricing, and capabilities
- **Real-time Search**: Instant model discovery with intelligent search
- **Performance Metrics**: Token usage, latency, and cost tracking
- **Dynamic Model Pages**: Individual pages for each model with detailed information

### Chat Interface
- **Multi-Model Support**: Switch between different AI models seamlessly
- **Session Management**: Persistent chat history with local storage
- **Real-time Responses**: Streaming AI responses with loading states
- **Model Selection**: Easy model switching with categorized options
- **Custom Styling**: Dedicated CSS for chat interface

### Analytics Dashboard
- **Performance Rankings**: Model performance comparisons across categories
- **Usage Statistics**: Token generation and model usage analytics
- **Trend Analysis**: Historical performance data with interactive charts
- **Category Filtering**: Filter analytics by model categories and time ranges
- **Interactive Charts**: Advanced data visualization with Chart.js and Recharts

### Developer Tools
- **API Management**: Manage API keys and provider settings
- **Integration Guides**: Documentation for API integration
- **Settings Panel**: Comprehensive configuration options
- **Provider Management**: Control which AI providers to use
- **Database Management**: Built-in database initialization and testing tools

### Organization Features
- **Team Management**: Organization-based user management
- **Resource Sharing**: Shared access to models and configurations
- **Billing Management**: Organization-level billing and usage tracking

## 🔧 Configuration

### Privy Authentication Setup
The application uses Privy for authentication. Configure your Privy app:

1. **Dashboard Configuration**:
   - Enable email, Google, and GitHub login methods
   - Configure OAuth providers with proper redirect URIs
   - Set up your app appearance and branding

2. **Environment Variables**:
   ```env
   NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id
   ```

3. **OAuth Provider Setup**:
   - **Google**: Set up OAuth in Google Cloud Console
   - **GitHub**: Create OAuth app in GitHub Developer Settings
   - Use Privy's callback URLs for both providers

### Firebase Configuration
Firebase is used for backend services. Configure in `src/lib/firebase.ts`:

```typescript
const firebaseConfig = {
  projectId: "your-project-id",
  appId: "your-app-id",
  storageBucket: "your-storage-bucket",
  apiKey: "your-api-key",
  authDomain: "your-auth-domain",
  messagingSenderId: "your-sender-id"
};
```

### AI Model Configuration
AI models are configured in `src/ai/genkit.ts` and model data is managed in `src/lib/models-data.ts`.

### Theme Configuration
The application supports dark/light themes with configuration in `tailwind.config.ts` and theme provider in `src/components/theme-provider.tsx`.

## 🚀 Deployment

### Firebase App Hosting
The project is configured for Firebase App Hosting with `apphosting.yaml`:

```yaml
run: pnpm run build && pnpm run start
```

### Environment Variables
Ensure all required environment variables are set in your deployment environment:
- `NEXT_PUBLIC_PRIVY_APP_ID`
- `GOOGLE_AI_API_KEY`

### Production Considerations
- Set up proper OAuth redirect URIs for production domains
- Configure Firebase project for production
- Set up proper CORS policies
- Configure Google Analytics (already included)

## 🛠️ Development

### Code Structure
- **App Router**: Uses Next.js 15 App Router for modern routing
- **TypeScript**: Full type safety throughout the application
- **Component Library**: Radix UI components with custom styling
- **State Management**: React hooks and context for state management
- **Error Handling**: Comprehensive error boundaries and error handling

### Custom Hooks
- `useAuth`: Authentication state management
- `useMobile`: Mobile device detection
- `useToast`: Toast notification management
- `useModelData`: Model data fetching and management

### API Routes
- `/api/auth/[...nextauth]`: NextAuth.js authentication
- `/api/init-db`: Database initialization
- `/api/test-db`: Database testing endpoints

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the documentation in the `docs/` folder
- Review the component examples in `src/components/`
- Check the Privy documentation for authentication issues

## 🧪 Testing Tool Calling

The platform includes comprehensive testing tools for validating tool/function calling capabilities across AI models.

### Quick Start
```bash
# Set your API key
export GATEWAYZ_API_KEY="your_api_key_here"

# List models with tool calling support
pnpm tsx test-tool-calling.ts --list

# Run a simple test
pnpm tsx test-tool-calling-simple.ts

# Test with curl
bash test-tool-calling-curl.sh
```

### Test Files
- `test-tool-calling.ts` - Full test suite with multiple scenarios
- `test-tool-calling-simple.ts` - Quick minimal example
- `test-tool-calling-curl.sh` - Shell script using curl
- `TOOL_CALLING_README.md` - Quick start guide
- `TOOL_CALLING_TESTS.md` - Complete documentation
- `TOOL_CALLING_EXAMPLE_OUTPUT.md` - Example outputs

### Supported Models with Tool Calling
- GPT-4o mini (OpenAI)
- Qwen: Qwen2 72B A16B 2507 (FREE) ⭐
- Qwen: Qwen2 57B A14B 2507
- DeepSeek: DeepSeek V3.5
- Anthropic: Claude 3.7 Sonnet
- Google: Gemini 2.1 Pro
- And more...

See [TOOL_CALLING_README.md](TOOL_CALLING_README.md) for detailed instructions.

## 🔗 Related Documentation

- [Tool Calling Tests](TOOL_CALLING_README.md) - Tool/function calling test suite
- [Privy Documentation](https://docs.privy.io/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Google Genkit Documentation](https://firebase.google.com/docs/genkit)
- [Radix UI Documentation](https://www.radix-ui.com/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
