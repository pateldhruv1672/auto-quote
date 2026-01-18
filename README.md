# 🚗 AutoQuote - AI-Powered Car Damage Repair Finder

<div align="center">

![AutoQuote Banner](https://img.shields.io/badge/AutoQuote-AI%20Repair%20Finder-blue?style=for-the-badge&logo=react)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.2-61DAFB?logo=react)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green?logo=nodedotjs)](https://nodejs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.0-646CFF?logo=vite)](https://vitejs.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**An intelligent, end-to-end solution for finding and booking vehicle repair services using AI-powered image analysis, web research, and autonomous phone calling.**

[Features](#-features) • [Architecture](#-architecture) • [Quick Start](#-quick-start) • [API Reference](#-api-reference) • [Contributing](#-contributing)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Usage](#-usage)
  - [Web Application](#web-application)
  - [CLI Agent](#cli-agent)
  - [Programmatic Usage](#programmatic-usage)
- [API Reference](#-api-reference)
- [Data Models](#-data-models)
- [Caching Strategy](#-caching-strategy)
- [Development](#-development)
- [Troubleshooting](#-troubleshooting)
- [License](#-license)

---

## 🎯 Overview

AutoQuote is a comprehensive full-stack application that revolutionizes how users find vehicle repair services. By combining cutting-edge AI technologies, it automates the entire process from damage assessment to appointment booking:

1. **Upload** a photo of vehicle damage
2. **AI analyzes** the damage using computer vision
3. **Intelligent search** finds nearby repair shops using web research
4. **AI phone agent** calls shops simultaneously for quotes
5. **Compare & book** the best option with one click

This eliminates hours of manual research, phone calls, and quote comparisons, providing users with actionable repair options in minutes.
<img width="1512" height="855" alt="image" src="https://github.com/user-attachments/assets/7443cf89-c3a9-4482-a418-f556a95c9ea2" />


---

## ✨ Features

### Core Functionality

| Feature | Description |
|---------|-------------|
| 📷 **AI Image Analysis** | Upload car damage photos and receive detailed damage assessments using Freepik's Image-to-Prompt API |
| 📍 **Smart Location Detection** | Automatic geolocation with reverse geocoding for accurate local shop searches |
| 🔍 **Intelligent Shop Discovery** | Leverages Yutori Research API for deep web search to find repair shops with ratings, reviews, and services |
| 🗺️ **Interactive Map** | Leaflet-powered map displays all nearby shops with detailed popups |
| 📞 **AI Voice Calling** | VAPI-powered AI agent makes parallel calls to multiple shops for real-time quotes |
| 📊 **Quote Comparison** | Side-by-side comparison of quotes with AI-ranked recommendations |
| 📅 **Automated Booking** | One-click appointment booking through AI phone calls |
| 💾 **Smart Caching** | Dual-layer caching (local JSON + AWS DynamoDB) for fast response times |

### User Experience

- **Drag & Drop Upload** - Intuitive image upload with preview
- **Real-time Status Updates** - Live progress indicators for all operations
- **Responsive Design** - Works seamlessly on desktop and mobile devices
- **Calling Animation** - Visual feedback during AI phone calls
- **Confirmation Details** - Complete booking information with confirmation numbers

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER INTERFACE                                  │
│                      React + Vite + TypeScript + Leaflet                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND SERVER                                  │
│                          Express.js + TypeScript                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐│
│  │   /api/     │  │   /api/     │  │   /api/     │  │       /api/         ││
│  │  analyze-   │  │   search-   │  │   call-     │  │       book-         ││
│  │   image     │  │    shops    │  │   shops     │  │    appointment      ││
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────────┬───────────┘│
└─────────┼────────────────┼────────────────┼───────────────────┼────────────┘
          │                │                │                   │
          ▼                ▼                ▼                   ▼
   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  ┌──────────────┐
   │   Freepik    │ │   Yutori     │ │    VAPI      │  │    VAPI      │
   │  Image-to-   │ │  Research    │ │   Voice      │  │   Booking    │
   │   Prompt     │ │     API      │ │   Calling    │  │   Calling    │
   └──────────────┘ └──────────────┘ └──────────────┘  └──────────────┘
                           │
                           ▼
                   ┌──────────────┐
                   │   Caching    │
                   │   Layer      │
                   ├──────────────┤
                   │ Local JSON + │
                   │  DynamoDB    │
                   └──────────────┘
```

### Project Structure

```
auto-quote/
├── vehicle-repair-agent/
│   ├── backend/                    # Express.js API server
│   │   ├── src/
│   │   │   ├── server.ts           # Main server with REST endpoints
│   │   │   └── vapi-client.ts      # VAPI integration for AI calling
│   │   ├── cache/                  # Local cache storage
│   │   │   ├── repair_shops_cache.json
│   │   │   ├── call_sessions.json
│   │   │   └── booking_sessions.json
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── frontend/                   # React + Vite frontend
│   │   ├── src/
│   │   │   ├── App.tsx             # Main application component
│   │   │   ├── types.ts            # TypeScript type definitions
│   │   │   ├── index.css           # Application styles
│   │   │   └── main.tsx            # React entry point
│   │   ├── index.html
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   └── tsconfig.json
│   │
│   ├── src/                        # CLI Agent (standalone)
│   │   ├── index.ts                # CLI entry point
│   │   ├── vehicle-repair-agent.ts # Core agent logic
│   │   ├── yutori-client.ts        # Yutori API client
│   │   └── types.ts                # Shared type definitions
│   │
│   ├── .env                        # Environment configuration
│   ├── package.json
│   └── tsconfig.json
│
├── dmg car 1.jpeg                  # Sample damage image
├── fraud_call.csv                  # Call data exports
└── README.md                       # This file
```

---

## 🛠️ Tech Stack

### Frontend

| Technology | Purpose |
|------------|---------|
| **React 18** | UI component framework |
| **TypeScript 5.3** | Type-safe development |
| **Vite 5** | Build tool and dev server |
| **Leaflet** | Interactive mapping |
| **react-leaflet** | React bindings for Leaflet |
| **Axios** | HTTP client |

### Backend

| Technology | Purpose |
|------------|---------|
| **Node.js 18+** | Runtime environment |
| **Express.js** | Web framework |
| **TypeScript** | Type-safe development |
| **AWS SDK v3** | DynamoDB integration |
| **Axios** | External API calls |

### External APIs

| Service | Purpose |
|---------|---------|
| **[Freepik Image-to-Prompt](https://freepik.com/api)** | AI damage image analysis |
| **[Yutori Research API](https://yutori.com)** | Intelligent web research for shop discovery |
| **[VAPI](https://vapi.ai)** | AI voice calling and conversation |
| **[OpenStreetMap Nominatim](https://nominatim.org)** | Geocoding and reverse geocoding |
| **[AWS DynamoDB](https://aws.amazon.com/dynamodb)** | Cloud caching (optional) |

---

## 📦 Prerequisites

Before installation, ensure you have the following:

- **Node.js** v18.0.0 or higher
- **npm** v9.0.0 or higher (or **pnpm**)
- **Git** for version control

### API Keys Required

| API | Required | How to Obtain |
|-----|----------|---------------|
| Yutori API | Yes | [yutori.com](https://yutori.com) |
| Freepik API | Recommended | [freepik.com/api](https://freepik.com/api) |
| VAPI | For calling | [vapi.ai](https://vapi.ai) |
| AWS Credentials | Optional | [AWS Console](https://console.aws.amazon.com/iam) |

---

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/auto-quote.git
cd auto-quote/vehicle-repair-agent
```

### 2. Install Dependencies

```bash
# Install root dependencies (for CLI agent)
npm install

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the `vehicle-repair-agent` directory:

```bash
cp .env.example .env
```

Edit the `.env` file with your API keys:

```env
# Required APIs
YUTORI_API_KEY=your_yutori_api_key_here

# Recommended APIs
FREEPIK_API_KEY=your_freepik_api_key_here

# AI Calling (for quote requests and booking)
VAPI_API_KEY=your_vapi_api_key_here
VAPI_PHONE_NUMBER_ID=your_vapi_phone_number_id

# Demo phone numbers for testing (optional)
DEMO_PHONE_1=+14155551234
DEMO_PHONE_2=+14155555678

# AWS DynamoDB (optional cloud caching)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-west-2
DYNAMODB_TABLE_NAME=RepairShopsCache

# Default user location
USER_LOCATION=San Jose, CA, US
```

---

## ⚙️ Configuration

### Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `YUTORI_API_KEY` | Yes | - | Yutori API key for web research |
| `FREEPIK_API_KEY` | No | - | Freepik API key for image analysis |
| `VAPI_API_KEY` | No | - | VAPI key for AI phone calls |
| `VAPI_PHONE_NUMBER_ID` | No | - | VAPI phone number for outbound calls |
| `AWS_ACCESS_KEY_ID` | No | - | AWS access key for DynamoDB |
| `AWS_SECRET_ACCESS_KEY` | No | - | AWS secret key for DynamoDB |
| `AWS_REGION` | No | `us-west-2` | AWS region for DynamoDB |
| `DYNAMODB_TABLE_NAME` | No | `RepairShopsCache` | DynamoDB table name |
| `USER_LOCATION` | No | `San Jose, CA, US` | Default search location |
| `PORT` | No | `4000` | Backend server port |

### Mock Mode

The application gracefully handles missing API keys:

- **No Freepik key**: Returns generic damage description
- **No Yutori key**: Returns mock repair shop data
- **No VAPI key**: Simulates AI calls with mock results

This allows for development and testing without all API credentials.

---

## 📖 Usage

### Web Application

#### Starting the Application

**Terminal 1 - Backend Server:**

```bash
cd vehicle-repair-agent/backend
npm run dev
```

The backend will start on `http://localhost:4000`.

**Terminal 2 - Frontend Dev Server:**

```bash
cd vehicle-repair-agent/frontend
npm run dev
```

The frontend will start on `http://localhost:3000`.

#### Using the Application

1. **Open** `http://localhost:3000` in your browser
2. **Allow** location access when prompted
3. **Upload** a photo of vehicle damage (drag & drop or click)
4. **Click** "Analyze & Find Repair Shops"
5. **Wait** for AI to:
   - Analyze the damage
   - Search for nearby shops
   - Call shops for quotes (if VAPI configured)
6. **Review** quotes and click "Book Appointment" on your preferred shop
7. **Enter** your contact details
8. **Receive** confirmation with appointment details

### CLI Agent

For command-line usage without the web interface:

```bash
cd vehicle-repair-agent
npm run dev
```

This runs an interactive CLI that searches for repair shops based on your configured location.

### Programmatic Usage

Import and use the agent in your own TypeScript/JavaScript projects:

```typescript
import { VehicleRepairAgent } from "./vehicle-repair-agent";

// Initialize the agent
const agent = new VehicleRepairAgent(
  "your-yutori-api-key",
  "San Jose, CA, US",    // User location
  "America/Los_Angeles"   // User timezone
);

// Method 1: Research API (comprehensive web search)
const researchResults = await agent.findRepairShopsWithResearch(5); // 5-mile radius

// Method 2: Browsing API (targeted website navigation)
const browsingResults = await agent.findRepairShopsWithBrowsing(
  5,                      // Radius in miles
  "https://www.yelp.com"  // Starting URL
);

// Method 3: Comprehensive search (both APIs combined)
const allResults = await agent.findRepairShopsComprehensive(5);

// Display results
agent.printSummary(allResults);
console.log(agent.formatResults(allResults));

// Save results to file
const savedPath = agent.saveResults(allResults);
console.log(`Results saved to: ${savedPath}`);

// Load previous results
const loadedResults = agent.loadResults(savedPath);
```

---

## 📡 API Reference

### Backend REST Endpoints

#### `POST /api/analyze-image`

Analyzes a car damage image using AI.

**Request Body:**

```json
{
  "image": "base64_encoded_image_string"
}
```

**Response:**

```json
{
  "description": "Car damage analysis: Vehicle shows visible dent on front bumper with paint scratches extending to the fender..."
}
```

---

#### `POST /api/search-shops`

Searches for repair shops near a location.

**Request Body:**

```json
{
  "location": "San Jose, CA, US",
  "latitude": 37.3382,
  "longitude": -121.8863,
  "damageDescription": "Front bumper dent with paint scratches",
  "radiusMiles": 5
}
```

**Response:**

```json
{
  "shops": [
    {
      "shop_name": "Elite Auto Body",
      "address": "1234 Main St",
      "city": "San Jose",
      "state": "CA",
      "zip_code": "95112",
      "phone_number": "(408) 555-1234",
      "website": "https://eliteautobody.com",
      "rating": 4.8,
      "review_count": 256,
      "reviews": ["Excellent service!", "Fixed my car perfectly."],
      "services": ["Collision Repair", "Dent Removal", "Paint Work"],
      "hours_of_operation": "Mon-Fri 8am-6pm",
      "latitude": 37.3392,
      "longitude": -121.8853,
      "distance_miles": 0.8
    }
  ],
  "search_location": "San Jose, CA, US",
  "search_radius_miles": 5,
  "total_found": 15,
  "cached": false
}
```

---

#### `POST /api/call-shops`

Initiates AI phone calls to multiple repair shops for quotes.

**Request Body:**

```json
{
  "shops": [
    {
      "shop_name": "Elite Auto Body",
      "phone_number": "(408) 555-1234",
      "address": "1234 Main St",
      "city": "San Jose",
      "state": "CA"
    }
  ],
  "damageDescription": "Front bumper dent with paint scratches",
  "limit": 2
}
```

**Response:**

```json
{
  "sessionId": "session-1705432800000",
  "status": "calling",
  "message": "AI agent is calling repair shops...",
  "shopsBeingCalled": ["Elite Auto Body", "Pacific Coast Auto"]
}
```

---

#### `GET /api/call-status/:sessionId`

Gets the status and results of a calling session.

**Response:**

```json
{
  "sessionId": "session-1705432800000",
  "status": "completed",
  "shopsBeingCalled": ["Elite Auto Body", "Pacific Coast Auto"],
  "elapsedSeconds": 45,
  "results": [
    {
      "callId": "call-abc123",
      "shopName": "Elite Auto Body",
      "phoneNumber": "(408) 555-1234",
      "status": "ended",
      "transcript": "Full call transcript...",
      "summary": "Called about vehicle damage. Quote: $750 for repairs, 3 days.",
      "quotation": {
        "price": 750,
        "currency": "USD",
        "estimatedDays": 3,
        "notes": "Includes paint matching"
      },
      "duration": 120
    }
  ],
  "analysis": {
    "ranked": [...],
    "bestOption": {...},
    "summary": "Analyzed 2 shops. Recommended: Elite Auto Body at $750."
  }
}
```

---

#### `POST /api/book-appointment`

Books an appointment at a selected repair shop.

**Request Body:**

```json
{
  "shop": {
    "shop_name": "Elite Auto Body",
    "phone_number": "(408) 555-1234",
    "address": "1234 Main St",
    "city": "San Jose",
    "state": "CA"
  },
  "damageDescription": "Front bumper dent",
  "customerName": "John Doe",
  "customerPhone": "+14155551234",
  "preferredTime": "morning"
}
```

**Response:**

```json
{
  "bookingId": "booking-1705432800000",
  "status": "calling",
  "shopName": "Elite Auto Body",
  "requestedDate": "Friday, January 17, 2026",
  "message": "AI is calling to book your appointment..."
}
```

---

#### `GET /api/booking-status/:bookingId`

Gets the status of a booking request.

**Response:**

```json
{
  "bookingId": "booking-1705432800000",
  "status": "completed",
  "shopName": "Elite Auto Body",
  "requestedDate": "Friday, January 17, 2026",
  "elapsedSeconds": 30,
  "result": {
    "appointmentBooked": true,
    "appointmentDate": "Friday, January 17, 2026",
    "appointmentTime": "10:00 AM",
    "confirmationNumber": "CONF-XK7B9M",
    "specialInstructions": "Please bring insurance information",
    "summary": "Successfully booked appointment..."
  }
}
```

---

#### `GET /api/health`

Health check endpoint.

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2026-01-16T12:00:00.000Z"
}
```

---

## 📊 Data Models

### VehicleRepairShop

```typescript
interface VehicleRepairShop {
  shop_name: string;           // Name of the repair shop
  address: string;             // Street address
  city: string;                // City
  state: string;               // State abbreviation
  zip_code: string;            // ZIP/Postal code
  phone_number: string;        // Contact phone number
  email?: string;              // Contact email (optional)
  website?: string;            // Website URL (optional)
  rating?: number;             // Average rating (1-5)
  review_count?: number;       // Total number of reviews
  reviews?: string[];          // Sample customer reviews
  services?: string[];         // List of services offered
  hours_of_operation?: string; // Business hours
  latitude?: number;           // GPS latitude
  longitude?: number;          // GPS longitude
  distance_miles?: number;     // Distance from search location
}
```

### VapiCallResult

```typescript
interface VapiCallResult {
  callId: string;              // Unique call identifier
  shopName: string;            // Name of shop called
  phoneNumber: string;         // Phone number called
  status: string;              // Call status (queued, ringing, ended, failed)
  transcript?: string;         // Full call transcript
  summary?: string;            // AI-generated call summary
  quotation?: {
    price: number;             // Quoted repair price
    currency: string;          // Currency (USD)
    estimatedDays?: number;    // Estimated repair duration
    notes?: string;            // Additional notes
  };
  duration?: number;           // Call duration in seconds
}
```

### BookingCallResult

```typescript
interface BookingCallResult {
  callId: string;
  shopName: string;
  phoneNumber: string;
  status: string;
  appointmentBooked: boolean;        // Whether booking succeeded
  appointmentDate?: string;          // Confirmed date
  appointmentTime?: string;          // Confirmed time
  confirmationNumber?: string;       // Booking confirmation number
  specialInstructions?: string;      // Instructions from shop
  estimatedCompletion?: string;      // Expected repair duration
  alternativeDateOffered?: string;   // If requested date unavailable
}
```

---

## 💾 Caching Strategy

AutoQuote implements a two-tier caching system for optimal performance:

### Local File Cache

- **Location:** `backend/cache/repair_shops_cache.json`
- **Purpose:** Fast local access, works offline
- **Persistence:** Survives server restarts

### AWS DynamoDB Cache (Optional)

- **Purpose:** Cloud-based caching across deployments
- **TTL:** 7 days automatic expiration
- **Benefits:** Shared cache across multiple instances

### Cache Flow

```
Request → Check Local Cache
              │
              ├── Hit → Return cached data
              │
              └── Miss → Check DynamoDB
                            │
                            ├── Hit → Return & update local
                            │
                            └── Miss → Fetch from API
                                          │
                                          └── Update both caches
```

### API Timeout Handling

If the Yutori API takes longer than 15 seconds:
1. Return cached results immediately to the user
2. Continue fetching in the background
3. Update cache when complete for next request

---

## 🔧 Development

### Running in Development Mode

```bash
# Backend with hot reload
cd backend && npm run dev

# Frontend with HMR
cd frontend && npm run dev
```

### Building for Production

```bash
# Build backend
cd backend && npm run build

# Build frontend
cd frontend && npm run build
```

### Running Production Build

```bash
# Start backend
cd backend && npm start

# Serve frontend (using any static server)
cd frontend && npx serve dist
```

### TypeScript Compilation

```bash
# Check types without building
npx tsc --noEmit

# Build with source maps
npx tsc --sourceMap
```

---

## 🐛 Troubleshooting

### Common Issues

#### "Location permission denied"

The app falls back to San Jose, CA as the default location. To use your actual location:
1. Click the location icon in your browser's address bar
2. Allow location access for the site
3. Refresh the page

#### "No repair shops found"

- Ensure `YUTORI_API_KEY` is set correctly
- Try a different/larger search radius
- Check if mock mode is being used (look for "mock" in console)

#### "AI calling not working"

- Verify `VAPI_API_KEY` and `VAPI_PHONE_NUMBER_ID` are set
- Check VAPI account has available credits
- Ensure phone numbers are in E.164 format (+1XXXXXXXXXX)

#### "Image analysis returns generic description"

- Verify `FREEPIK_API_KEY` is set
- Check Freepik API quota/limits
- Ensure image is in JPEG/PNG format

#### DynamoDB connection errors

- Verify AWS credentials are correct
- Check IAM permissions for DynamoDB access
- Ensure the table exists in the specified region

### Debug Mode

Enable verbose logging by setting:

```bash
DEBUG=* npm run dev
```

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Yutori](https://yutori.com) - AI-powered web research
- [Freepik](https://freepik.com) - Image analysis API
- [VAPI](https://vapi.ai) - Voice AI platform
- [Leaflet](https://leafletjs.com) - Open-source mapping
- [OpenStreetMap](https://openstreetmap.org) - Map data and geocoding

---

<div align="center">

**Built with ❤️ for the future of automotive services**

[Report Bug](https://github.com/yourusername/auto-quote/issues) • [Request Feature](https://github.com/yourusername/auto-quote/issues)

</div>
