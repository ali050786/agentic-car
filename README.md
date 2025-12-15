# 🎨 Agentic Carousel Generator

An intelligent, AI-powered carousel generator that creates stunning, professional-quality carousel posts optimized for Instagram, LinkedIn, and other social media platforms. Built with modern web technologies and powered by multiple AI models.

## ✨ Features

- **AI-Powered Content Generation**: Leverage Groq (Llama 3.3), Claude Haiku 3.5, or Gemini Flash to generate carousel content
- **Multiple Templates**: Choose from beautifully designed carousel templates
- **Smart Theme System**: Dynamic light/dark themes with automatic color generation
- **Background Patterns**: 12+ customizable SVG patterns with adjustable opacity
- **Multi-Format Upload**: Support for PDF, DOCX, DOC, and Markdown files
- **YouTube Transcript Integration**: Generate carousels from YouTube videos (Coming Soon)
- **Real-time Preview**: See your carousel as you edit
- **Figma Export**: Optimized SVG output for seamless Figma integration
- **User Authentication**: Secure Google OAuth authentication via Appwrite
- **Carousel Library**: Save and manage your carousel history

## 🚀 Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **State Management**: Zustand
- **Backend**: Appwrite (BaaS)
- **AI Models**: 
  - Groq (Llama 3.3 70B)
  - Claude Haiku 3.5
  - Gemini Flash
- **Styling**: Vanilla CSS with modern design patterns
- **Icons**: Lucide React
- **Document Processing**: Mammoth (DOCX), PDF.js (PDF)

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **Git**

You'll also need API keys for:
- At least one AI provider (Groq/Claude/Gemini)
- Appwrite project

## 🛠️ Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/agentic-car.git
cd agentic-car
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit the `.env` file and add your API keys:

```env
# AI Model Keys (at least one required)
GROQ_API_KEY=your_groq_api_key_here
CLAUDE_API_KEY=your_claude_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here

# Appwrite Configuration
VITE_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT_ID=your_project_id_here
VITE_APPWRITE_DATABASE_ID=main
VITE_APPWRITE_CAROUSELS_COLLECTION_ID=carousels
VITE_APPWRITE_ANALYTICS_COLLECTION_ID=user_analytics
```

### 4. Set Up Appwrite

#### Create Appwrite Project

1. Go to [Appwrite Cloud](https://cloud.appwrite.io/) or your self-hosted instance
2. Create a new project
3. Copy your Project ID to the `.env` file

#### Configure Google OAuth

1. In your Appwrite project, go to **Auth** → **Settings**
2. Enable **Google OAuth2** provider
3. Follow the [Google OAuth Setup Guide](#google-oauth-setup)

#### Create Database & Collections

1. Create a database named `main`
2. Create collections:
   - **carousels**: Store user-generated carousels
   - **user_analytics**: Track usage analytics

**Carousels Collection Schema:**
```json
{
  "userId": "string",
  "title": "string",
  "slides": "string (JSON)",
  "template": "string",
  "theme": "string (JSON)",
  "createdAt": "datetime"
}
```

**User Analytics Collection Schema:**
```json
{
  "userId": "string",
  "carouselsCreated": "integer",
  "lastActive": "datetime"
}
```

3. Set appropriate permissions (read/write for authenticated users)

## 🔑 API Keys Setup

### Groq (Recommended - Free)

1. Visit [Groq Console](https://console.groq.com/keys)
2. Sign up for a free account
3. Generate an API key
4. Add to `.env`: `GROQ_API_KEY=your_key_here`

**Benefits:**
- Very fast generation
- Generous free tier rate limits
- Llama 3.3 70B model

### Claude (Best Quality)

1. Visit [Anthropic Console](https://console.anthropic.com/)
2. Create an account
3. Generate an API key
4. Add to `.env`: `CLAUDE_API_KEY=your_key_here`

**Benefits:**
- Excellent reasoning
- Superior JSON adherence
- Claude Haiku 3.5 model

### Gemini (Google's Free Model)

1. Visit [Google AI Studio](https://aistudio.google.com/apikey)
2. Create an API key
3. Add to `.env`: `GEMINI_API_KEY=your_key_here`

**Benefits:**
- Free tier with generous limits
- Native JSON mode support
- Gemini Flash 1.5 model

## 🔐 Google OAuth Setup

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google+ API**

### 2. Configure OAuth Consent Screen

1. Navigate to **APIs & Services** → **OAuth consent screen**
2. Choose **External** user type
3. Fill in the application details:
   - App name
   - Support email
   - Developer contact
4. Add scopes: `email`, `profile`, `openid`
5. Save and continue

### 3. Create OAuth 2.0 Credentials

1. Navigate to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Choose **Web application**
4. Add authorized redirect URIs:
   ```
   https://cloud.appwrite.io/v1/account/sessions/oauth2/callback/google/[PROJECT_ID]
   ```
   Replace `[PROJECT_ID]` with your Appwrite project ID
5. Copy the **Client ID** and **Client Secret**

### 4. Configure in Appwrite

1. Go to your Appwrite project → **Auth** → **Settings**
2. Find **Google** provider
3. Paste your Client ID and Client Secret
4. Save changes

## 🏃‍♂️ Running the Application

### Development Mode

Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Backend Server (Optional)

If you need the backend server for additional processing:

```bash
npm run server
```

Server runs on `http://localhost:3000`

### Production Build

Build for production:

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

## 📁 Project Structure

```
agentic-car/
├── assets/           # Static assets and templates
├── components/       # React components
│   ├── FloatingBottomBar.tsx
│   ├── FloatingSidebar.tsx
│   ├── CarouselPreview.tsx
│   └── ...
├── config/           # Configuration files
├── core/             # Core logic and agents
│   └── agents/       # AI agent implementations
├── database/         # Database utilities
├── lib/              # External libraries
├── pages/            # Page components
│   ├── Login.tsx
│   ├── Signup.tsx
│   └── Dashboard.tsx
├── services/         # API services
├── store/            # Zustand state management
├── utils/            # Utility functions
│   ├── optimizers/   # Template optimizers
│   ├── patternGenerator.ts
│   ├── brandUtils.ts
│   └── ...
├── .env.example      # Environment variables template
├── package.json      # Dependencies
└── vite.config.ts    # Vite configuration
```

## 🎯 Usage

### Creating Your First Carousel

1. **Sign In**: Use Google OAuth to authenticate
2. **Choose Input Method**:
   - Enter text directly
   - Upload a file (PDF, DOCX, DOC, MD)
   - Paste a YouTube URL
3. **Select AI Model**: Choose from Groq, Claude, or Gemini
4. **Generate**: Click generate and watch the AI create your carousel
5. **Customize**:
   - Choose a template
   - Adjust colors and themes
   - Modify background patterns
   - Edit individual slides
6. **Export**: Download as SVG or copy to Figma

### Template Features

- **Template 1**: Modern, clean design with split layouts
- **Template 2**: Bold, centered content with emphasis

Each template supports:
- Custom color schemes
- Dynamic theming (light/dark)
- Pattern overlays
- Icon integration
- List formatting

## 🐛 Troubleshooting

### Common Issues

**Issue**: `Module not found` errors
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Issue**: API key not working
- Verify the key is correct in `.env`
- Ensure `.env` is in the root directory
- Restart the development server

**Issue**: Appwrite authentication errors
- Check OAuth redirect URIs match exactly
- Verify Google OAuth credentials are correct
- Check Appwrite project ID in `.env`

**Issue**: Patterns not showing
- Clear browser cache
- Check pattern opacity settings
- Verify theme configuration

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- [Appwrite](https://appwrite.io/) - Backend as a Service
- [Groq](https://groq.com/) - Fast AI inference
- [Anthropic](https://www.anthropic.com/) - Claude AI
- [Google AI](https://ai.google/) - Gemini models
- [Lucide](https://lucide.dev/) - Beautiful icons
- [React](https://react.dev/) - UI framework

## 📧 Support

For issues and questions:
- Open an issue on GitHub
- Contact: your-email@example.com

---

Made with ❤️ by Sikandar Ali Abdul
