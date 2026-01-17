# 🚗 AutoQuote AI - Intelligent Vehicle Repair Assistant

<div align="center">

![AutoQuote AI Banner](https://img.shields.io/badge/🔧-AutoQuote%20AI-blue?style=for-the-badge&labelColor=0d1117)

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![AWS DynamoDB](https://img.shields.io/badge/DynamoDB-4053D6?style=flat-square&logo=amazondynamodb&logoColor=white)](https://aws.amazon.com/dynamodb/)
[![OpenStreetMap](https://img.shields.io/badge/OpenStreetMap-7EBC6F?style=flat-square&logo=openstreetmap&logoColor=white)](https://www.openstreetmap.org/)

**AI-powered vehicle damage assessment with automated shop discovery, voice-based quote collection, and appointment booking**

[Features](#-features) • [Demo](#-demo) • [Tech Stack](#-tech-stack) • [Quick Start](#-quick-start) • [API Keys](#-api-keys) • [Architecture](#-architecture)

</div>

---

## 🌟 Features

### 📸 **AI Damage Assessment**
Upload a photo of your vehicle damage and our AI analyzes it using Freepik's advanced image-to-prompt technology to understand the type and severity of damage.

### 🔍 **Smart Shop Discovery**
Powered by Yutori Research API, AutoQuote finds the best auto repair shops within 5 miles of your location, ranking them by reviews, ratings, and expertise.

### 📞 **Voice AI Quote Collection**
Using VAPI's voice AI technology, AutoQuote automatically calls multiple repair shops simultaneously, speaks with their staff, describes your damage, and collects personalized repair quotes.

### 📅 **One-Click Appointment Booking**
Choose your preferred shop and book an appointment with a single click. Our AI agent calls the shop, confirms availability, and schedules your visit.

### 🗺️ **Interactive Map View**
Visualize all nearby repair shops on an interactive Leaflet map with pins showing shop details, ratings, and distance from your location.

### ⚡ **Smart Caching**
Dual-layer caching with local JSON files and AWS DynamoDB ensures fast responses and reliable data persistence.

---

## 🎬 Demo

### How It Works

1. **📍 Enter Location** - Provide your address or zip code
2. **📸 Upload Photo** - Take or upload a photo of the vehicle damage
3. **🔍 AI Analysis** - Our AI describes and assesses the damage
4. **🏪 Find Shops** - Discover nearby repair shops on an interactive map
5. **📞 Get Quotes** - AI calls shops and collects repair estimates
6. **📅 Book Appointment** - Select a shop and schedule your visit

---

## 🛠️ Tech Stack

| Category | Technology |
|----------|------------|
| **Frontend** | React 18, TypeScript, Vite |
| **Backend** | Node.js, Express, TypeScript |
| **Maps** | Leaflet, OpenStreetMap |
| **AI/ML** | Freepik Image-to-Prompt API |
| **Research** | Yutori Research API |
| **Voice AI** | VAPI (Voice AI Platform) |
| **Database** | AWS DynamoDB |
| **Styling** | CSS3 with modern animations |

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- API keys (see [API Keys](#-api-keys))

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/autoquote-ai.git
cd autoquote-ai

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### Environment Setup

Create a `.env` file in the `backend` directory:

```env
# Yutori Research API
YUTORI_API_KEY=your_yutori_api_key

# Freepik Image Analysis
FREEPIK_API_KEY=your_freepik_api_key

# VAPI Voice AI
VAPI_API_KEY=your_vapi_private_key
VAPI_PHONE_NUMBER_ID=your_vapi_phone_number_id

# AWS DynamoDB (Optional)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-west-2

# Demo Phone Numbers (for testing)
DEMO_PHONE_1=+14155551234
DEMO_PHONE_2=+14155555678
```

### Running the Application

```bash
# Terminal 1: Start Backend
cd backend
npm run dev

# Terminal 2: Start Frontend
cd frontend
npm run dev
```

Open http://localhost:3000 in your browser.

---

## 🔑 API Keys

| Service | Purpose | Get Key |
|---------|---------|---------|
| **Yutori** | Research API for shop discovery | [yutori.ai](https://yutori.ai) |
| **Freepik** | Image-to-Prompt AI analysis | [freepik.com/api](https://www.freepik.com/api) |
| **VAPI** | Voice AI for phone calls | [vapi.ai](https://vapi.ai) |
| **AWS** | DynamoDB caching (optional) | [aws.amazon.com](https://aws.amazon.com) |

---

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  React Frontend │────▶│  Express API    │────▶│  Yutori API     │
│  (Port 3000)    │     │  (Port 4000)    │     │  (Research)     │
│                 │     │                 │     │                 │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
                    ▼            ▼            ▼
            ┌───────────┐ ┌───────────┐ ┌───────────┐
            │  Freepik  │ │   VAPI    │ │  DynamoDB │
            │  (Image)  │ │  (Voice)  │ │  (Cache)  │
            └───────────┘ └───────────┘ └───────────┘
```

### Key Components

- **`/backend/src/server.ts`** - Main Express server with all API endpoints
- **`/backend/src/vapi-client.ts`** - VAPI voice AI integration
- **`/frontend/src/App.tsx`** - React UI with map and modals
- **`/backend/src/data/`** - JSON file caching for shops and sessions

---

## 📁 Project Structure

```
vehicle-repair-agent/
├── backend/
│   ├── src/
│   │   ├── server.ts           # Express API server
│   │   ├── vapi-client.ts      # VAPI voice AI client
│   │   └── data/               # JSON cache files
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx             # Main React component
│   │   ├── index.css           # Styles
│   │   └── main.tsx            # Entry point
│   ├── package.json
│   └── vite.config.ts
└── README.md
```

---

## 🎯 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/search-shops` | POST | Find repair shops near location |
| `/api/analyze-image` | POST | Analyze vehicle damage image |
| `/api/start-calling` | POST | Initiate quote collection calls |
| `/api/call-status/:sessionId` | GET | Get call session status |
| `/api/quotations/:sessionId` | GET | Get collected quotations |
| `/api/book-appointment` | POST | Book appointment at shop |
| `/api/booking-status/:bookingId` | GET | Get booking status |

---

## 🤝 Team

Built with ❤️ at **CloudCon Hackathon 2024**

---

## 📄 License

MIT License - feel free to use this project for your own hackathons!

---

<div align="center">

**⭐ Star this repo if you found it helpful!**

</div>
