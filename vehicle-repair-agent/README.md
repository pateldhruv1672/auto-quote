# Car Damage Repair Finder

A full-stack application that allows users to upload car damage photos, analyzes them with AI, and finds nearby repair shops.

## Features

- 📷 **Image Upload**: Drag & drop or click to upload car damage photos
- 🤖 **AI Analysis**: Uses Freepik's Image-to-Prompt API to analyze damage
- 📍 **Location Detection**: Automatically detects user's location
- 🔍 **Smart Search**: Uses Yutori Research API to find relevant repair shops
- 🗺️ **Interactive Map**: Displays repair shops as pins on a Leaflet map
- 📞 **AI Calling Animation**: Shows the AI agent contacting all shops simultaneously

## Project Structure

```
vehicle-repair-agent/
├── backend/           # Express API server
│   ├── src/
│   │   └── server.ts  # Main server with /api endpoints
│   └── package.json
├── frontend/          # React + Vite frontend
│   ├── src/
│   │   ├── App.tsx    # Main React component
│   │   ├── types.ts   # TypeScript interfaces
│   │   └── index.css  # Styling
│   └── package.json
├── src/               # Original Yutori agent (CLI)
└── .env               # API keys configuration
```

## Prerequisites

- Node.js 18+ or higher
- A Yutori API key (get one at [yutori.com](https://yutori.com))
- A Freepik API key (get one at [freepik.com/api](https://freepik.com/api))

## Installation

1. Clone or navigate to the project directory:
   ```bash
   cd vehicle-repair-agent
   ```

2. Configure API Keys - Edit `.env`:
   ```bash
   cp .env.example .env
   # Add your API keys:
   # YUTORI_API_KEY=your_yutori_api_key
   # FREEPIK_API_KEY=your_freepik_api_key
   ```

3. Install dependencies:
   ```bash
   # Backend
   cd backend && npm install
   
   # Frontend  
   cd ../frontend && npm install
   ```

## Usage

### Start the Application

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

Then open http://localhost:3000 in your browser.

### CLI Agent (Original)

```bash
npm run dev
```

### Programmatic Usage

```typescript
import { VehicleRepairAgent } from "./vehicle-repair-agent";

const agent = new VehicleRepairAgent(
  "your-api-key",
  "San Jose, CA, US",  // Location
  "America/Los_Angeles" // Timezone
);

// Using Research API (recommended for comprehensive results)
const results = await agent.findRepairShopsWithResearch(5); // 5 mile radius

// Using Browsing API (for specific website navigation)
const yelpResults = await agent.findRepairShopsWithBrowsing(5, "https://www.yelp.com");

// Using both APIs for comprehensive coverage
const comprehensiveResults = await agent.findRepairShopsComprehensive(5);

// Print results
agent.printSummary(results);
console.log(agent.formatResults(results));
```

## Output Format

The agent returns results in the following JSON structure:

```json
{
  "shops": [
    {
      "shop_name": "ABC Auto Repair",
      "address": "123 Main Street",
      "city": "San Jose",
      "state": "CA",
      "zip_code": "95112",
      "phone_number": "(408) 555-1234",
      "email": "info@abcauto.com",
      "website": "https://www.abcauto.com",
      "rating": 4.5,
      "review_count": 150,
      "reviews": [
        "Great service and fair prices!",
        "Fixed my car quickly and professionally."
      ],
      "services": [
        "Oil change",
        "Brake repair",
        "Engine diagnostics",
        "Tire rotation"
      ],
      "hours_of_operation": "Mon-Fri 8am-6pm, Sat 9am-4pm",
      "distance_miles": 2.3
    }
  ],
  "search_location": "San Jose, CA, US",
  "search_radius_miles": 5,
  "total_found": 15
}
```

## API Reference

### VehicleRepairAgent

#### Constructor

```typescript
new VehicleRepairAgent(apiKey: string, userLocation?: string, userTimezone?: string)
```

- `apiKey`: Your Yutori API key
- `userLocation`: Location in format "City, State, Country" (default: "San Jose, CA, US")
- `userTimezone`: Timezone string (default: "America/Los_Angeles")

#### Methods

- `findRepairShopsWithResearch(radiusMiles: number)`: Use Research API for deep web search
- `findRepairShopsWithBrowsing(radiusMiles: number, startUrl: string)`: Use Browsing API to navigate specific websites
- `findRepairShopsComprehensive(radiusMiles: number)`: Use both APIs and merge results
- `printSummary(results)`: Print a formatted summary to console
- `formatResults(results)`: Get results as a formatted JSON string

### YutoriClient

Low-level client for Yutori API:

- `createResearchTask(request)`: Create a research task
- `getResearchStatus(taskId)`: Get research task status
- `waitForResearchCompletion(taskId, pollInterval, maxWait)`: Poll until completion
- `createBrowsingTask(request)`: Create a browsing task
- `getBrowsingStatus(taskId)`: Get browsing task status
- `waitForBrowsingCompletion(taskId, pollInterval, maxWait)`: Poll until completion

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `YUTORI_API_KEY` | Your Yutori API key | (required) |
| `USER_LOCATION` | Search location | "San Jose, CA, US" |

## License

MIT
