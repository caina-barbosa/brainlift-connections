# BrainLift Connections

A tool for extracting DOK (Depth of Knowledge) sections from WorkFlowy BrainLift documents and visualizing the connections between them using LLM-powered analysis.

## What is BrainLift?

BrainLift is a structured knowledge management system used in EPHOR to capture and organize expertise. It follows a hierarchical **Depth of Knowledge (DOK)** framework:

### The DOK Hierarchy

| Level | Name | Description | Purpose |
|-------|------|-------------|---------|
| **DOK1** | Facts | Raw, external facts copied directly from sources | Foundation - objective data points |
| **DOK2** | Knowledge Tree | Structured categories with sources + owner summaries | Organization - curated knowledge structure |
| **DOK3** | Insights | Synthesized insights that transcend multiple sources | Synthesis - patterns and connections |
| **DOK4** | SPOV | Spiky Points of View - contrarian, provocative conclusions | Differentiation - unique perspectives |

### Knowledge Flow

```
DOK2 (Knowledge) → DOK3 (Insights) → DOK4 (SPOVs)
     Facts feed      Patterns become    Contrarian
     into insights   bold conclusions   perspectives
```

## Features

- **Extract DOK sections** from WorkFlowy shared links
- **Analyze connections** between DOK levels using LLM (Groq + Qwen)
- **Visualize as flow diagram** with React Flow
- **Persist BrainLifts** for later revisiting
- **Smart layout** - connected nodes align horizontally

## Quick Start

### 1. Configure Environment

```bash
cd backend
cp .env.example .env
# Edit .env and add your Groq API key
```

Get your API key from [Groq Console](https://console.groq.com/).

### 2. Start the Backend

```bash
cd backend

# Create virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the server
python main.py
```

API available at `http://localhost:8001`

### 3. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

UI available at `http://localhost:5173`

## Usage

1. Paste a WorkFlowy secret link
2. Click **Extract** - sections are parsed and saved
3. Click **Analyze Connections** - LLM finds relationships
4. Toggle **List/Flow** view to visualize

## Connection Analysis

### How It Works

The system uses a **"pick the best"** approach to find meaningful connections:

```
For each DOK3 insight:
  → Show ALL DOK2 items to the LLM
  → Ask: "Which ONE directly relates? (or none)"
  → LLM picks at most 1, classifies as SUPPORTS or CONTRADICTS

For each DOK4 SPOV:
  → Show ALL DOK3 insights to the LLM
  → Ask: "Which ONE directly relates? (or none)"
  → LLM picks at most 1, classifies as SUPPORTS or CONTRADICTS
```

### Why This Approach?

| Approach | Problem |
|----------|---------|
| Pairwise scoring | Everything gets 90%+ scores (no context) |
| **Pick the best** | Forces competition, LLM must choose |

### Post-Processing

After LLM analysis, connections are capped at **max 2 per node** to keep the visualization clean.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/extract` | Extract DOK sections from WorkFlowy URL |
| `GET` | `/brainlifts` | List all saved BrainLifts |
| `GET` | `/brainlifts/{id}` | Get a saved BrainLift with sections & connections |
| `DELETE` | `/brainlifts/{id}` | Delete a BrainLift |
| `POST` | `/brainlifts/{id}/analyze` | Run connection analysis |
| `POST` | `/brainlifts/{id}/analyze?force=true` | Re-run analysis (bypass cache) |

## Project Structure

```
Brainlift-Connections/
├── backend/
│   ├── main.py              # FastAPI server, endpoints, DOK parsing
│   ├── groq_service.py      # LLM connection analysis
│   ├── storage.py           # JSON file persistence
│   ├── requirements.txt
│   ├── .env.example
│   └── data/                # Saved BrainLifts (gitignored)
│       └── brainlifts.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx          # Main app with sidebar
│   │   ├── DOKFlow.tsx      # React Flow visualization
│   │   └── *.css
│   └── package.json
├── .gitignore
└── README.md
```

## Tech Stack

**Backend:**
- Python 3.11+
- FastAPI
- Groq SDK (qwen/qwen3-32b model)
- aiohttp, Pydantic

**Frontend:**
- React 19
- TypeScript
- Vite
- Tailwind CSS v4
- React Flow (@xyflow/react)

## Flow Visualization

The flow view shows DOK connections with smart layout:

```
DOK4 (SPOVs)      DOK3 (Insights)     DOK2 (Knowledge)
┌──────────┐      ┌──────────┐        ┌──────────┐
│  SPOV 1  │──────│ Insight 1│────────│ Source A │
└──────────┘      └──────────┘        └──────────┘
┌──────────┐             │            ┌──────────┐
│  SPOV 2  │─────────────┘            │ Source B │ (dimmed)
└──────────┘                          └──────────┘
```

- **Green edges**: Supports relationship
- **Red edges**: Contradicts relationship
- **Dimmed nodes**: No connections (unlinked)
- **Grouped nodes**: Connected to same parent align vertically

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GROQ_API_KEY` | Your Groq API key (required for analysis) |

## Section Name Variants

The parser recognizes multiple naming conventions:

- **DOK4**: "DOK4 - SPOV", "DOK4-SPOVs", "SpikyPOVs", "Spiky POVs"
- **DOK3**: "DOK3 - Insights", "DOK3-Insights", "Insights"
- **DOK2**: "DOK2 - Knowledge Tree", "Knowledge Tree", "DOK1 and DOK2"

## Future Possibilities

- [ ] Export connections to Markdown/JSON
- [ ] Batch analyze multiple BrainLifts
- [ ] Contradiction detection improvements
- [ ] DOK1 extraction within DOK2 sources
