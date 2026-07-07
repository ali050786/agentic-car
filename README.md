# 🎨 Agentic Carousel Generator

An intelligent, AI-powered multi-agent platform that generates high-quality carousel posts optimized for LinkedIn, Instagram, and other social media platforms. Built with modern React, a background worker queue, and custom conversational AI agents.

## ✨ Features

*   **Chat-Driven Agentic Workspace**: Rebuilt editor page that acts as an interactive chat canvas. The `OrchestratorAgent` handles requests via a single inference call, routing commands to copy updates (`copy`), layout and palette swaps (`design`), or visual generation (`image`).
*   **Background Worker Queue**: All generation and complex edit jobs run asynchronously on a dedicated Node/Express background worker. This ensures jobs survive browser tab closure or navigation.
*   **Three-Layer Memory System**:
    *   **Durable Memory**: Persistent user-profile design preferences stored in the database.
    *   **Rolling Compact Summary**: `MemoryAgent` compresses conversation history when it scrolls past the 10-message window, keeping LLM prompts lean yet coherent.
    *   **Single-Call Extraction**: The orchestrator extracts preference notes in real-time without extra API overhead.
*   **AI Research Enrichment**: `ResearchAgent` analyzes user prompts and queries the Tavily API to fetch real-world data, citations, and trends to enrich the carousel content automatically.
*   **Doodle Pipeline (Template 3)**: Automatic prompt generation via the `ArtDirectorAgent` that sends scene metadata to Replicate (Flux model) to render black pencil sketches on white, saved straight to Appwrite Storage. Includes automated visual asset repair loops.
*   **Visual Styling Suite (Templates 1–4)**:
    *   **Template 1 (The Truth)**: Direct, high-contrast, bold industrial style.
    *   **Template 2 (The Clarity)**: Clean, professional, modern design with architectural arches.
    *   **Template 3 (The Sketch)**: Fun, narrative-driven whiteboard doodle style.
    *   **Template 4 (The Statement)**: Premium minimalist typographic layout utilizing sentence-case text and highlight `accentPhrase` substrings.
*   **Automatic Quality Checks**: Incorporates a `ProofreaderAgent` to perform automated grammar, punctuation, and layout-fit passes.
*   **SVG Figma Export**: Optimized code generator using Satori, allowing seamless copy-pasting directly into Figma.
*   **User Auth**: Appwrite-based Google OAuth authentication.

## 🚀 Tech Stack

*   **Frontend**: React 19, TypeScript, Vite, Tailwind CSS (layouts), Zustand (state management)
*   **Background Worker**: Node.js, Express, Job Queue Store
*   **Backend / BaaS**: Appwrite (Database, Storage, Auth, Jobs collection)
*   **AI & Image Integrations**:
    *   Claude 3.5 Haiku / Sonnet (via Anthropic API)
    *   OpenRouter Free Models (Fallback route)
    *   Tavily Search API (Research enrichment)
    *   Replicate (Flux Schnell) (Doodle generation)

## 📋 Prerequisites

Ensure you have the following installed:
*   **Node.js** (v18 or higher)
*   **npm** or **yarn**
*   **Git**

You will need API keys for:
*   Anthropic API and OpenRouter
*   Tavily Search API (optional, for web research)
*   Replicate API Token (optional, for Template-3 doodle sketch generation)
*   Appwrite Cloud or self-hosted project credentials

## 🛠️ Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/ali050786/agentic-car.git
cd agentic-car
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to create your local `.env`:
```bash
cp .env.example .env
```

Edit `.env` and provide your credentials. Key parameters include:
```env
# AI Model Keys
CLAUDE_API_KEY=your_claude_key
OPENROUTER_API_KEY=your_openrouter_key

# Research Agent (Tavily Search)
VITE_TAVILY_API_KEY=your_tavily_key

# Doodle Generation
REPLICATE_API_TOKEN=your_replicate_token
VITE_APPWRITE_STORAGE_BUCKET_ID=your_storage_bucket_id

# Appwrite Core Config
VITE_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT_ID=your_project_id
VITE_APPWRITE_DATABASE_ID=main
VITE_APPWRITE_CAROUSELS_COLLECTION_ID=carousels
VITE_APPWRITE_ANALYTICS_COLLECTION_ID=user_analytics
VITE_APPWRITE_PROFILES_COLLECTION_ID=profiles
VITE_APPWRITE_API_KEY=your_server_api_key

# Background Worker config
VITE_WORKER_URL=http://localhost:4000
APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=your_project_id
APPWRITE_API_KEY=your_highly_privileged_server_key
```

### 4. Create Appwrite Database & Collections
Set up the `main` database with the following collections:
*   `carousels`: Stores user carousels.
*   `user_analytics`: Tracks creation limits and dates.
*   `profiles`: Persistent user profile preferences.
*   `generation_jobs`: Tracks background worker jobs (`status`, `progress`, `payload`).

---

## 🏃‍♂️ Running the Application

To run the full stack locally, you must run both the frontend dev server and the background queue worker.

### Run Frontend (Vite)
```bash
npm run dev
```
The client dashboard will be available at `http://localhost:5173`.

### Run Background Worker (Express queue)
```bash
npm run worker
```
The worker starts at `http://localhost:4000`, polling and executing Appwrite job lists.

### Production Build
Build both bundles:
```bash
npm run build
```

---

## 📂 Project Structure
```
agentic-car/
├── assets/           # Static assets, SVG themes, and template shapes
├── components/       # UI Components
│   ├── chat/         # Conversational Orchestrator Panel
│   ├── artifact/     # Carousel slide preview and visual setting controllers
│   ├── sidebar/      # CarouselHistorySidebar component
│   └── landing/      # Landing page layouts
├── core/             # Core Logic
│   └── agents/       # Multi-agent implementations (Orchestrator, Research, Strategist, Template, Proofreader, ArtDirector, Memory)
├── database/         # Appwrite DB schema utilities
├── pages/            # View pages (Login, Dashboard, ImageRefinement)
├── store/            # Zustand client stores (useCarouselStore, useAuthStore)
├── worker/           # Background job worker (express app, queue managers, jobs)
├── tsconfig.json     # TypeScript configuration
└── vite.config.ts    # Build config
```

---

## 📄 License
This project is licensed under the MIT License.
