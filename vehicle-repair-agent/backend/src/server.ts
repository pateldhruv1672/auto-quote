import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { VapiClient, VapiCallResult, BookingCallResult, analyzeAndRankQuotes } from './vapi-client';

dotenv.config({ path: '../.env' });

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// API Keys
const YUTORI_API_KEY = process.env.YUTORI_API_KEY;
const FREEPIK_API_KEY = process.env.FREEPIK_API_KEY;
const VAPI_API_KEY = process.env.VAPI_API_KEY;
const VAPI_PHONE_NUMBER_ID = process.env.VAPI_PHONE_NUMBER_ID;

// Demo phone numbers for testing
const DEMO_PHONES = [
  process.env.DEMO_PHONE_1 || '+14155551234',
  process.env.DEMO_PHONE_2 || '+14155555678',
];

// Initialize VAPI client
let vapiClient: VapiClient | null = null;
if (VAPI_API_KEY && VAPI_PHONE_NUMBER_ID) {
  vapiClient = new VapiClient(VAPI_API_KEY, VAPI_PHONE_NUMBER_ID);
  console.log('✅ VAPI client initialized');
} else {
  console.log('⚠️ VAPI credentials not set - calling feature disabled');
}

// Store active call sessions
interface CallSession {
  sessionId: string;
  callIds: string[];
  shops: Array<{ name: string; phone: string; address: string }>;
  damageDescription: string;
  status: 'calling' | 'completed' | 'failed';
  startTime: number;
  results?: VapiCallResult[];
  analysis?: ReturnType<typeof analyzeAndRankQuotes>;
}
const activeSessions: Map<string, CallSession> = new Map();

// Store active booking sessions
interface BookingSession {
  bookingId: string;
  callId: string;
  shopName: string;
  shopPhone: string;
  shopAddress: string;
  customerName: string;
  customerPhone: string;
  damageDescription: string;
  requestedDate: string;
  status: 'calling' | 'completed' | 'failed';
  startTime: number;
  result?: BookingCallResult;
}
const activeBookings: Map<string, BookingSession> = new Map();

// Booking sessions JSON file for persistence
const BOOKING_SESSIONS_FILE = path.join(__dirname, '..', 'cache', 'booking_sessions.json');

// Call sessions JSON file for persistence
const CALL_SESSIONS_FILE = path.join(__dirname, '..', 'cache', 'call_sessions.json');

// Load call sessions from JSON file on startup
function loadCallSessions(): Record<string, CallSession> {
  try {
    if (fs.existsSync(CALL_SESSIONS_FILE)) {
      const data = fs.readFileSync(CALL_SESSIONS_FILE, 'utf-8');
      const sessions = JSON.parse(data) as Record<string, CallSession>;
      return sessions;
    }
  } catch (error) {
    console.error('Error loading call sessions:', error);
  }
  return {};
}

// Initialize activeSessions from file on startup
function initSessionsFromFile(): void {
  const sessions = loadCallSessions();
  Object.entries(sessions).forEach(([id, session]) => {
    activeSessions.set(id, session);
  });
  if (Object.keys(sessions).length > 0) {
    console.log(`📂 Loaded ${Object.keys(sessions).length} call sessions from file`);
  }
}

// Save call sessions to JSON file
function saveCallSessions(): void {
  try {
    const sessions: Record<string, CallSession> = {};
    activeSessions.forEach((session, id) => {
      sessions[id] = session;
    });
    fs.writeFileSync(CALL_SESSIONS_FILE, JSON.stringify(sessions, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving call sessions:', error);
  }
}

// Save a single session (call after any update)
function persistSession(sessionId: string, session: CallSession): void {
  activeSessions.set(sessionId, session);
  saveCallSessions();
}

// Load booking sessions from JSON file
function loadBookingSessions(): Record<string, BookingSession> {
  try {
    if (fs.existsSync(BOOKING_SESSIONS_FILE)) {
      const data = fs.readFileSync(BOOKING_SESSIONS_FILE, 'utf-8');
      const bookings = JSON.parse(data) as Record<string, BookingSession>;
      return bookings;
    }
  } catch (error) {
    console.error('Error loading booking sessions:', error);
  }
  return {};
}

// Save booking sessions to JSON file
function saveBookingSessions(): void {
  try {
    const bookings: Record<string, BookingSession> = {};
    activeBookings.forEach((booking, id) => {
      bookings[id] = booking;
    });
    fs.writeFileSync(BOOKING_SESSIONS_FILE, JSON.stringify(bookings, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving booking sessions:', error);
  }
}

// Save a single booking (call after any update)
function persistBooking(bookingId: string, booking: BookingSession): void {
  activeBookings.set(bookingId, booking);
  saveBookingSessions();
}

// Initialize booking sessions from file on startup
function initBookingsFromFile(): void {
  const bookings = loadBookingSessions();
  Object.entries(bookings).forEach(([id, booking]) => {
    activeBookings.set(id, booking);
  });
  if (Object.keys(bookings).length > 0) {
    console.log(`📂 Loaded ${Object.keys(bookings).length} booking sessions from file`);
  }
}

// Load sessions on startup
initSessionsFromFile();
initBookingsFromFile();

// AWS DynamoDB Configuration
const AWS_REGION = process.env.AWS_REGION || 'us-west-2';
const DYNAMODB_TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'RepairShopsCache';

// Initialize DynamoDB client
let dynamoDbClient: DynamoDBDocumentClient | null = null;

if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  const client = new DynamoDBClient({
    region: AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
  dynamoDbClient = DynamoDBDocumentClient.from(client);
  console.log('✅ DynamoDB client initialized');
} else {
  console.log('⚠️ AWS credentials not set - DynamoDB disabled');
}

// DynamoDB helper functions
async function saveToDynamoDB(location: string, shops: any[], damageDescription?: string): Promise<void> {
  if (!dynamoDbClient) return;

  try {
    const cacheKey = getCacheKey(location);
    const item = {
      pk: cacheKey,
      location,
      shops,
      timestamp: Date.now(),
      damage_description: damageDescription || '',
      ttl: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days TTL
    };

    await dynamoDbClient.send(new PutCommand({
      TableName: DYNAMODB_TABLE_NAME,
      Item: item,
    }));

    console.log(`☁️ DynamoDB: Saved ${shops.length} shops for ${location}`);
  } catch (error) {
    console.error('DynamoDB save error:', error);
  }
}

async function getFromDynamoDB(location: string): Promise<any | null> {
  if (!dynamoDbClient) return null;

  try {
    const cacheKey = getCacheKey(location);
    const result = await dynamoDbClient.send(new GetCommand({
      TableName: DYNAMODB_TABLE_NAME,
      Key: { pk: cacheKey },
    }));

    if (result.Item) {
      console.log(`☁️ DynamoDB: Found cached data for ${location}`);
      return result.Item;
    }
  } catch (error) {
    console.error('DynamoDB get error:', error);
  }

  return null;
}

async function getAllFromDynamoDB(): Promise<any[]> {
  if (!dynamoDbClient) return [];

  try {
    const result = await dynamoDbClient.send(new ScanCommand({
      TableName: DYNAMODB_TABLE_NAME,
    }));

    return result.Items || [];
  } catch (error) {
    console.error('DynamoDB scan error:', error);
    return [];
  }
}

// Cache configuration (local file cache as backup)
const CACHE_DIR = path.join(__dirname, '..', 'cache');
const CACHE_FILE = path.join(CACHE_DIR, 'repair_shops_cache.json');
const API_TIMEOUT_MS = 15000; // 15 seconds timeout

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Cache helper functions
interface CacheEntry {
  location: string;
  shops: any[];
  timestamp: number;
  damage_description?: string;
}

interface CacheData {
  entries: { [key: string]: CacheEntry };
}

function getCacheKey(location: string): string {
  // Normalize location string for cache key
  return location.toLowerCase().replace(/[^a-z0-9]/g, '_');
}

function loadCache(): CacheData {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading cache:', error);
  }
  return { entries: {} };
}

function saveCache(cache: CacheData): void {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
    console.log('💾 Cache saved successfully');
  } catch (error) {
    console.error('Error saving cache:', error);
  }
}

function getCachedResults(location: string): CacheEntry | null {
  const cache = loadCache();
  const key = getCacheKey(location);
  return cache.entries[key] || null;
}

// Async version that also checks DynamoDB
async function getCachedResultsAsync(location: string): Promise<CacheEntry | null> {
  // First check local cache
  const localCache = getCachedResults(location);
  if (localCache) {
    return localCache;
  }

  // Then check DynamoDB
  const dynamoData = await getFromDynamoDB(location);
  if (dynamoData) {
    return {
      location: dynamoData.location,
      shops: dynamoData.shops,
      timestamp: dynamoData.timestamp,
      damage_description: dynamoData.damage_description,
    };
  }

  return null;
}

function updateCache(location: string, shops: any[], damageDescription?: string): void {
  const cache = loadCache();
  const key = getCacheKey(location);
  cache.entries[key] = {
    location,
    shops,
    timestamp: Date.now(),
    damage_description: damageDescription,
  };
  saveCache(cache);

  // Also save to DynamoDB asynchronously
  saveToDynamoDB(location, shops, damageDescription).catch(err => {
    console.error('Failed to save to DynamoDB:', err);
  });
}

// Async version that waits for both local and DynamoDB to complete
async function updateCacheAsync(location: string, shops: any[], damageDescription?: string): Promise<void> {
  const cache = loadCache();
  const key = getCacheKey(location);
  cache.entries[key] = {
    location,
    shops,
    timestamp: Date.now(),
    damage_description: damageDescription,
  };
  saveCache(cache);

  // Also save to DynamoDB and wait for completion
  try {
    await saveToDynamoDB(location, shops, damageDescription);
    console.log('✅ DynamoDB cache updated successfully');
  } catch (err) {
    console.error('Failed to save to DynamoDB:', err);
  }
}

// Helper: Poll for Freepik task completion
async function pollFreepikTask(taskId: string, maxAttempts = 30): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    const response = await axios.get(
      `https://api.freepik.com/v1/ai/image-to-prompt/${taskId}`,
      {
        headers: {
          'x-freepik-api-key': FREEPIK_API_KEY,
        },
      }
    );

    const data = response.data.data;
    if (data.status === 'COMPLETED' && data.generated && data.generated.length > 0) {
      return data.generated[0];
    } else if (data.status === 'FAILED') {
      throw new Error('Image analysis failed');
    }
  }
  throw new Error('Timeout waiting for image analysis');
}

// Helper: Poll for Yutori research completion
async function pollYutoriResearch(taskId: string, maxAttempts = 60): Promise<any> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const response = await axios.get(
      `https://api.yutori.com/v1/research/tasks/${taskId}`,
      {
        headers: {
          'X-API-Key': YUTORI_API_KEY,
        },
      }
    );

    const data = response.data;
    if (data.status === 'succeeded') {
      return data;
    } else if (data.status === 'failed') {
      throw new Error('Research task failed');
    }
    
    console.log(`Research task ${taskId} status: ${data.status}`);
  }
  throw new Error('Timeout waiting for research');
}

// Endpoint: Analyze car damage image
app.post('/api/analyze-image', async (req: Request, res: Response) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'Image is required' });
    }

    if (!FREEPIK_API_KEY) {
      // Return mock description if no API key
      console.log('No FREEPIK_API_KEY, returning mock description');
      return res.json({
        description: 'Car with visible damage including dents, scratches, and potential body work needed. The damage appears to require professional auto body repair services.',
      });
    }

    // Call Freepik Image-to-Prompt API
    const response = await axios.post(
      'https://api.freepik.com/v1/ai/image-to-prompt',
      {
        image: `data:image/jpeg;base64,${image}`,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-freepik-api-key': FREEPIK_API_KEY,
        },
      }
    );

    const taskId = response.data.data.task_id;
    console.log(`Freepik task created: ${taskId}`);

    // Poll for completion
    const description = await pollFreepikTask(taskId);

    // Enhance description for car damage context
    const enhancedDescription = `Car damage analysis: ${description}. This vehicle requires repair services for the visible damage.`;

    res.json({ description: enhancedDescription });
  } catch (error: any) {
    console.error('Image analysis error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to analyze image',
      description: 'Car with visible damage requiring professional auto body repair.',
    });
  }
});

// Endpoint: Search for repair shops
app.post('/api/search-shops', async (req: Request, res: Response) => {
  try {
    const { location, latitude, longitude, damageDescription, radiusMiles = 5 } = req.body;

    if (!location) {
      return res.status(400).json({ error: 'Location is required' });
    }

    console.log(`Searching for repair shops near ${location}, damage: ${damageDescription}`);

    // Check for cached results first (from local file and DynamoDB)
    const cachedResults = await getCachedResultsAsync(location);
    
    if (!YUTORI_API_KEY) {
      // Return mock data if no API key
      console.log('No YUTORI_API_KEY, returning mock data');
      return res.json({
        shops: generateMockShops(latitude, longitude),
        search_location: location,
        search_radius_miles: radiusMiles,
        total_found: 5,
        damage_description: damageDescription,
        cached: false,
      });
    }

    // Function to fetch from Yutori API and update cache
    const fetchFromYutori = async (): Promise<any[]> => {
      // Build enhanced query based on damage description
      const query = `Find all vehicle repair shops, auto body shops, and car service centers within ${radiusMiles} miles of ${location}.
      
      The customer needs repairs for: ${damageDescription || 'general vehicle damage'}
      
      For each shop, provide:
      - Shop name
      - Full address (street, city, state, zip code)  
      - Phone number
      - Website (if available)
      - Rating and number of reviews
      - Sample customer reviews (2-3 reviews)
      - Services offered (especially those relevant to the damage described)
      - Hours of operation
      - Approximate latitude and longitude coordinates
      - Distance from ${location}
      
      Focus on highly-rated shops that specialize in the type of repair needed.`;

      // Create Yutori research task
      const createResponse = await axios.post(
        'https://api.yutori.com/v1/research/tasks',
        {
          query,
          user_location: location,
          user_timezone: 'America/Los_Angeles',
          task_spec: {
            output_schema: {
              type: 'json',
              json_schema: {
                type: 'object',
                properties: {
                  shops: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        shop_name: { type: 'string' },
                        address: { type: 'string' },
                        city: { type: 'string' },
                        state: { type: 'string' },
                        zip_code: { type: 'string' },
                        phone_number: { type: 'string' },
                        website: { type: 'string' },
                        rating: { type: 'number' },
                        review_count: { type: 'number' },
                        reviews: { type: 'array', items: { type: 'string' } },
                        services: { type: 'array', items: { type: 'string' } },
                        hours_of_operation: { type: 'string' },
                        latitude: { type: 'number' },
                        longitude: { type: 'number' },
                        distance_miles: { type: 'number' },
                      },
                      required: ['shop_name', 'address', 'city', 'state', 'phone_number'],
                    },
                  },
                },
                required: ['shops'],
              },
            },
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': YUTORI_API_KEY,
          },
        }
      );

      const taskId = createResponse.data.task_id;
      console.log(`Yutori research task created: ${taskId}`);
      console.log(`View at: ${createResponse.data.view_url}`);

      // Poll for completion
      const result = await pollYutoriResearch(taskId);

      // Parse results
      let shops: any[] = [];
      if (result.structured_result?.shops) {
        shops = result.structured_result.shops;
      }

      // Add coordinates if missing (geocode addresses)
      for (const shop of shops) {
        if (!shop.latitude || !shop.longitude) {
          try {
            const geoResponse = await axios.get(
              `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
                `${shop.address}, ${shop.city}, ${shop.state}`
              )}&format=json&limit=1`
            );
            if (geoResponse.data.length > 0) {
              shop.latitude = parseFloat(geoResponse.data[0].lat);
              shop.longitude = parseFloat(geoResponse.data[0].lon);
            }
          } catch (geoError) {
            console.error('Geocoding error:', geoError);
          }
        }
      }

      // Update cache with new results (local file and DynamoDB)
      await updateCacheAsync(location, shops, damageDescription);
      console.log(`✅ Cache updated with ${shops.length} shops for ${location}`);

      return shops;
    };

    // Create a timeout promise
    const timeoutPromise = new Promise<'timeout'>((resolve) => {
      setTimeout(() => resolve('timeout'), API_TIMEOUT_MS);
    });

    // Start fetching from Yutori
    const fetchPromise = fetchFromYutori();

    // Race between API call and timeout
    const raceResult = await Promise.race([
      fetchPromise.then(shops => ({ type: 'success' as const, shops })),
      timeoutPromise.then(() => ({ type: 'timeout' as const }))
    ]);

    if (raceResult.type === 'success') {
      // API responded in time
      console.log('✅ Yutori API responded within timeout');
      return res.json({
        shops: raceResult.shops,
        search_location: location,
        search_radius_miles: radiusMiles,
        total_found: raceResult.shops.length,
        damage_description: damageDescription,
        cached: false,
      });
    } else {
      // Timeout - return cached results and continue updating in background
      console.log('⏱️ API timeout - returning cached results');

      // Continue fetching in background (don't await)
      fetchPromise
        .then(shops => {
          console.log(`🔄 Background fetch completed with ${shops.length} shops`);
        })
        .catch(err => {
          console.error('Background fetch error:', err.message);
        });

      // Return cached results or mock data
      if (cachedResults && cachedResults.shops.length > 0) {
        console.log(`📦 Returning ${cachedResults.shops.length} cached shops`);
        return res.json({
          shops: cachedResults.shops,
          search_location: location,
          search_radius_miles: radiusMiles,
          total_found: cachedResults.shops.length,
          damage_description: damageDescription,
          cached: true,
          cache_timestamp: cachedResults.timestamp,
          message: 'Showing cached results. Fresh data is being fetched in the background.',
        });
      } else {
        // No cache, return mock data
        console.log('📦 No cache available, returning mock data');
        const mockShops = generateMockShops(latitude, longitude);
        return res.json({
          shops: mockShops,
          search_location: location,
          search_radius_miles: radiusMiles,
          total_found: mockShops.length,
          damage_description: damageDescription,
          cached: true,
          message: 'Showing sample results. Fresh data is being fetched in the background.',
        });
      }
    }
  } catch (error: any) {
    console.error('Search error:', error.response?.data || error.message);
    
    // Return mock data on error
    res.json({
      shops: generateMockShops(req.body.latitude, req.body.longitude),
      search_location: req.body.location,
      search_radius_miles: req.body.radiusMiles || 5,
      total_found: 5,
      damage_description: req.body.damageDescription,
      error: 'Using mock data due to API error',
    });
  }
});

// Generate mock shops for testing
function generateMockShops(centerLat: number, centerLon: number) {
  const shops = [
    {
      shop_name: 'Elite Auto Body & Repair',
      address: '1234 Main Street',
      city: 'San Jose',
      state: 'CA',
      zip_code: '95112',
      phone_number: '(408) 555-1234',
      website: 'https://eliteautobody.com',
      rating: 4.8,
      review_count: 256,
      reviews: ['Excellent service!', 'Fixed my car perfectly.'],
      services: ['Collision Repair', 'Dent Removal', 'Paint Work', 'Frame Straightening'],
      hours_of_operation: 'Mon-Fri 8am-6pm, Sat 9am-4pm',
      latitude: centerLat + 0.01,
      longitude: centerLon + 0.01,
      distance_miles: 0.8,
    },
    {
      shop_name: 'Pacific Coast Auto Care',
      address: '567 Oak Avenue',
      city: 'San Jose',
      state: 'CA',
      zip_code: '95113',
      phone_number: '(408) 555-5678',
      website: 'https://pacificcoastauto.com',
      rating: 4.6,
      review_count: 189,
      reviews: ['Great prices and quick turnaround.', 'Very professional team.'],
      services: ['Body Repair', 'Bumper Repair', 'Scratch Removal', 'Insurance Claims'],
      hours_of_operation: 'Mon-Fri 7:30am-5:30pm',
      latitude: centerLat - 0.015,
      longitude: centerLon + 0.02,
      distance_miles: 1.2,
    },
    {
      shop_name: 'Bay Area Collision Center',
      address: '890 Tech Drive',
      city: 'San Jose',
      state: 'CA',
      zip_code: '95110',
      phone_number: '(408) 555-8901',
      website: 'https://bayareacollision.com',
      rating: 4.9,
      review_count: 412,
      reviews: ['Best collision repair in the area!', 'They made my car look brand new.'],
      services: ['Complete Collision Repair', 'Paintless Dent Repair', 'Auto Glass', 'Detailing'],
      hours_of_operation: 'Mon-Sat 8am-6pm',
      latitude: centerLat + 0.02,
      longitude: centerLon - 0.015,
      distance_miles: 1.8,
    },
    {
      shop_name: 'QuickFix Auto Body',
      address: '321 Industrial Blvd',
      city: 'San Jose',
      state: 'CA',
      zip_code: '95111',
      phone_number: '(408) 555-3210',
      rating: 4.4,
      review_count: 98,
      reviews: ['Fast and affordable!', 'Good quality work.'],
      services: ['Minor Repairs', 'Dent Removal', 'Touch-up Paint', 'Bumper Replacement'],
      hours_of_operation: 'Mon-Fri 9am-5pm',
      latitude: centerLat - 0.008,
      longitude: centerLon - 0.025,
      distance_miles: 2.1,
    },
    {
      shop_name: 'Premium Auto Restoration',
      address: '456 Luxury Lane',
      city: 'San Jose',
      state: 'CA',
      zip_code: '95125',
      phone_number: '(408) 555-4567',
      website: 'https://premiumautorestore.com',
      rating: 4.7,
      review_count: 167,
      reviews: ['Premium quality service.', 'Expensive but worth it.'],
      services: ['Full Restoration', 'Custom Paint', 'Classic Car Repair', 'Luxury Vehicle Specialist'],
      hours_of_operation: 'Mon-Fri 8am-5pm',
      latitude: centerLat + 0.025,
      longitude: centerLon + 0.018,
      distance_miles: 2.5,
    },
  ];

  return shops;
}

// ==================== VAPI CALLING ENDPOINTS ====================

// Endpoint: Initiate parallel calls to repair shops
app.post('/api/call-shops', async (req: Request, res: Response) => {
  try {
    const { shops, damageDescription, limit = 2 } = req.body;

    if (!shops || !Array.isArray(shops) || shops.length === 0) {
      return res.status(400).json({ error: 'Shops array is required' });
    }

    if (!damageDescription) {
      return res.status(400).json({ error: 'Damage description is required' });
    }

    // For demo, use only the first 2 shops (or specified limit)
    const shopsToCall = shops.slice(0, Math.min(limit, 2)).map((shop: any, index: number) => ({
      name: shop.shop_name || shop.name,
      phone: DEMO_PHONES[index] || shop.phone_number || shop.phone,
      address: `${shop.address}, ${shop.city}, ${shop.state}`,
    }));

    console.log(`📞 Initiating calls to ${shopsToCall.length} shops...`);
    shopsToCall.forEach((s: any) => console.log(`   - ${s.name}: ${s.phone}`));

    if (!vapiClient) {
      // Mock mode - simulate calling
      const sessionId = `mock-${Date.now()}`;
      const mockSession: CallSession = {
        sessionId,
        callIds: ['mock-call-1', 'mock-call-2'],
        shops: shopsToCall,
        damageDescription,
        status: 'calling',
        startTime: Date.now(),
      };
      persistSession(sessionId, mockSession);

      // Simulate call completion after 10 seconds
      setTimeout(() => {
        const session = activeSessions.get(sessionId);
        if (session) {
          session.status = 'completed';
          session.results = shopsToCall.map((shop: any, i: number) => ({
            callId: `mock-call-${i + 1}`,
            shopName: shop.name,
            phoneNumber: shop.phone,
            status: 'ended',
            transcript: `Mock transcript for ${shop.name}`,
            summary: `Called ${shop.name} about vehicle damage. They quoted $${500 + i * 200} for repairs, estimated ${3 + i} days.`,
            quotation: {
              price: 500 + i * 200,
              currency: 'USD',
              estimatedDays: 3 + i,
              notes: `Standard repair service at ${shop.name}`,
            },
            duration: 120 + i * 30,
          }));
          session.analysis = analyzeAndRankQuotes(session.results);
          persistSession(sessionId, session);
        }
      }, 10000);

      return res.json({
        sessionId,
        status: 'calling',
        message: 'AI agent is calling repair shops...',
        shopsBeingCalled: shopsToCall.map((s: any) => s.name),
      });
    }

    // Real VAPI calls
    const callResponses = await vapiClient.callMultipleShops(
      shopsToCall,
      damageDescription,
      Math.min(limit, 2)
    );

    const sessionId = `session-${Date.now()}`;
    const session: CallSession = {
      sessionId,
      callIds: callResponses.map((r) => r.id),
      shops: shopsToCall,
      damageDescription,
      status: 'calling',
      startTime: Date.now(),
    };
    persistSession(sessionId, session);

    // Start polling for call completion in background
    pollCallsForCompletion(sessionId);

    res.json({
      sessionId,
      status: 'calling',
      message: 'AI agent is calling repair shops...',
      callIds: callResponses.map((r) => r.id),
      shopsBeingCalled: callResponses.map((r) => r.shopName),
    });
  } catch (error: any) {
    console.error('Call shops error:', error.message);
    res.status(500).json({ error: 'Failed to initiate calls', details: error.message });
  }
});

// Background polling for call completion
async function pollCallsForCompletion(sessionId: string): Promise<void> {
  const session = activeSessions.get(sessionId);
  if (!session || !vapiClient) return;

  const maxWaitTime = 5 * 60 * 1000; // 5 minutes
  const pollInterval = 5000; // 5 seconds
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    await new Promise((resolve) => setTimeout(resolve, pollInterval));

    try {
      const results: VapiCallResult[] = [];
      let allCompleted = true;

      for (const callId of session.callIds) {
        const result = await vapiClient.getCall(callId);
        results.push(result);
        if (result.status !== 'ended' && result.status !== 'failed') {
          allCompleted = false;
        }
      }

      session.results = results;
      // Persist intermediate results
      persistSession(sessionId, session);

      if (allCompleted) {
        session.status = 'completed';
        session.analysis = analyzeAndRankQuotes(results);
        persistSession(sessionId, session);
        console.log(`✅ Session ${sessionId} completed. ${results.length} calls finished.`);
        return;
      }
    } catch (error: any) {
      console.error(`Error polling session ${sessionId}:`, error.message);
    }
  }

  // Timeout
  session.status = 'failed';
  persistSession(sessionId, session);
  console.log(`⏱️ Session ${sessionId} timed out.`);
}

// Endpoint: Get call session status and results
app.get('/api/call-status/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const session = activeSessions.get(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const response: any = {
      sessionId,
      status: session.status,
      shopsBeingCalled: session.shops.map((s) => s.name),
      elapsedSeconds: Math.round((Date.now() - session.startTime) / 1000),
    };

    if (session.status === 'completed' || session.results) {
      response.results = session.results;
      response.analysis = session.analysis;
    }

    res.json(response);
  } catch (error: any) {
    console.error('Get call status error:', error.message);
    res.status(500).json({ error: 'Failed to get call status', details: error.message });
  }
});

// Endpoint: Get call transcript and details
app.get('/api/call-details/:callId', async (req: Request, res: Response) => {
  try {
    const { callId } = req.params;

    if (!vapiClient) {
      // Mock response
      return res.json({
        callId,
        shopName: 'Mock Auto Shop',
        status: 'ended',
        transcript: 'This is a mock transcript for demo purposes.',
        summary: 'Called about vehicle damage. Quote: $700 for repairs, 3-5 days estimated.',
        quotation: {
          price: 700,
          currency: 'USD',
          estimatedDays: 4,
        },
      });
    }

    const result = await vapiClient.getCall(callId);
    res.json(result);
  } catch (error: any) {
    console.error('Get call details error:', error.message);
    res.status(500).json({ error: 'Failed to get call details', details: error.message });
  }
});

// Endpoint: List all saved sessions (from JSON file)
app.get('/api/call-sessions', (_req: Request, res: Response) => {
  try {
    const sessions = loadCallSessions();
    const sessionList = Object.entries(sessions).map(([id, session]) => ({
      sessionId: id,
      status: session.status,
      startTime: session.startTime,
      shopsCount: session.shops.length,
      hasResults: !!session.results,
    }));
    res.json({ sessions: sessionList });
  } catch (error: any) {
    console.error('List sessions error:', error.message);
    res.status(500).json({ error: 'Failed to list sessions', details: error.message });
  }
});

// Endpoint: Get a specific saved session by ID (from JSON file)
app.get('/api/call-sessions/:sessionId', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const sessions = loadCallSessions();
    const session = sessions[sessionId];

    if (!session) {
      return res.status(404).json({ error: 'Session not found in saved sessions' });
    }

    res.json({
      sessionId,
      status: session.status,
      shopsBeingCalled: session.shops.map((s) => s.name),
      elapsedSeconds: Math.round((Date.now() - session.startTime) / 1000),
      results: session.results,
      analysis: session.analysis,
    });
  } catch (error: any) {
    console.error('Get saved session error:', error.message);
    res.status(500).json({ error: 'Failed to get saved session', details: error.message });
  }
});

// ==================== BOOKING ENDPOINTS ====================

// Endpoint: Book an appointment at a selected shop
app.post('/api/book-appointment', async (req: Request, res: Response) => {
  try {
    const {
      shop,
      damageDescription,
      customerName,
      customerPhone,
      vehicleInfo,
      preferredTime,
    } = req.body;

    if (!shop || !shop.shop_name) {
      return res.status(400).json({ error: 'Shop information is required' });
    }

    if (!customerName || !customerPhone) {
      return res.status(400).json({ error: 'Customer name and phone are required' });
    }

    // Calculate tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const appointmentDate = tomorrow.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const shopPhone = shop.phone_number || DEMO_PHONES[0];
    const bookingId = `booking-${Date.now()}`;

    // Mock mode if VAPI not configured
    if (!vapiClient) {
      console.log('📞 [MOCK] Booking call to:', shop.shop_name);
      
      const mockBooking: BookingSession = {
        bookingId,
        callId: `mock-call-${Date.now()}`,
        shopName: shop.shop_name,
        shopPhone,
        shopAddress: `${shop.address}, ${shop.city}, ${shop.state}`,
        customerName,
        customerPhone,
        damageDescription: damageDescription || 'Vehicle repair',
        requestedDate: appointmentDate,
        status: 'calling',
        startTime: Date.now(),
      };
      persistBooking(bookingId, mockBooking);

      // Simulate call completion
      setTimeout(() => {
        const booking = activeBookings.get(bookingId);
        if (booking) {
          booking.status = 'completed';
          booking.result = {
            callId: booking.callId,
            shopName: booking.shopName,
            phoneNumber: booking.shopPhone,
            status: 'ended',
            appointmentBooked: true,
            appointmentDate: appointmentDate,
            appointmentTime: preferredTime || '10:00 AM',
            confirmationNumber: `CONF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
            specialInstructions: 'Please bring your insurance information and vehicle registration.',
            estimatedCompletion: '2-3 business days',
            summary: `Successfully booked appointment at ${shop.shop_name} for ${appointmentDate}. The shop confirmed they can accommodate the repair and provided a confirmation number.`,
          };
          persistBooking(bookingId, booking);
          console.log(`✅ [MOCK] Booking ${bookingId} completed`);
        }
      }, 8000); // Simulate 8 second call

      return res.json({
        bookingId,
        status: 'calling',
        shopName: shop.shop_name,
        requestedDate: appointmentDate,
        message: 'Booking call initiated (mock mode)',
      });
    }

    // Real VAPI booking call
    const callResponse = await vapiClient.createBookingCall({
      phoneNumber: shopPhone,
      shopName: shop.shop_name,
      shopAddress: `${shop.address}, ${shop.city}, ${shop.state}`,
      damageDescription: damageDescription || 'Vehicle repair needed',
      customerName,
      customerPhone,
      vehicleInfo,
      appointmentDate,
      preferredTime,
    });

    const booking: BookingSession = {
      bookingId,
      callId: callResponse.id,
      shopName: shop.shop_name,
      shopPhone,
      shopAddress: `${shop.address}, ${shop.city}, ${shop.state}`,
      customerName,
      customerPhone,
      damageDescription: damageDescription || 'Vehicle repair',
      requestedDate: appointmentDate,
      status: 'calling',
      startTime: Date.now(),
    };
    persistBooking(bookingId, booking);

    // Start polling for booking completion in background
    pollBookingForCompletion(bookingId);

    res.json({
      bookingId,
      status: 'calling',
      shopName: shop.shop_name,
      requestedDate: appointmentDate,
      message: 'AI is calling to book your appointment...',
    });
  } catch (error: any) {
    console.error('Book appointment error:', error.message);
    res.status(500).json({ error: 'Failed to book appointment', details: error.message });
  }
});

// Background polling for booking call completion
async function pollBookingForCompletion(bookingId: string): Promise<void> {
  const booking = activeBookings.get(bookingId);
  if (!booking || !vapiClient) return;

  const maxWaitTime = 5 * 60 * 1000; // 5 minutes
  const pollInterval = 5000; // 5 seconds
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    await new Promise((resolve) => setTimeout(resolve, pollInterval));

    try {
      const result = await vapiClient.getBookingResult(booking.callId);
      booking.result = result;
      persistBooking(bookingId, booking);

      if (result.status === 'ended' || result.status === 'failed') {
        booking.status = result.appointmentBooked ? 'completed' : 'failed';
        persistBooking(bookingId, booking);
        console.log(`✅ Booking ${bookingId} ${booking.status}. Appointment: ${result.appointmentBooked ? 'Confirmed' : 'Not confirmed'}`);
        return;
      }
    } catch (error: any) {
      console.error(`Error polling booking ${bookingId}:`, error.message);
    }
  }

  // Timeout
  booking.status = 'failed';
  persistBooking(bookingId, booking);
  console.log(`⏱️ Booking ${bookingId} timed out.`);
}

// Endpoint: Get booking status
app.get('/api/booking-status/:bookingId', async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    const booking = activeBookings.get(bookingId);

    if (!booking) {
      // Try loading from file
      const bookings = loadBookingSessions();
      const savedBooking = bookings[bookingId];
      if (!savedBooking) {
        return res.status(404).json({ error: 'Booking not found' });
      }
      return res.json({
        bookingId,
        status: savedBooking.status,
        shopName: savedBooking.shopName,
        requestedDate: savedBooking.requestedDate,
        elapsedSeconds: Math.round((Date.now() - savedBooking.startTime) / 1000),
        result: savedBooking.result,
      });
    }

    res.json({
      bookingId,
      status: booking.status,
      shopName: booking.shopName,
      requestedDate: booking.requestedDate,
      elapsedSeconds: Math.round((Date.now() - booking.startTime) / 1000),
      result: booking.result,
    });
  } catch (error: any) {
    console.error('Get booking status error:', error.message);
    res.status(500).json({ error: 'Failed to get booking status', details: error.message });
  }
});

// Endpoint: List all bookings
app.get('/api/bookings', (_req: Request, res: Response) => {
  try {
    const bookings = loadBookingSessions();
    const bookingList = Object.entries(bookings).map(([id, booking]) => ({
      bookingId: id,
      shopName: booking.shopName,
      requestedDate: booking.requestedDate,
      status: booking.status,
      appointmentBooked: booking.result?.appointmentBooked,
      appointmentTime: booking.result?.appointmentTime,
      confirmationNumber: booking.result?.confirmationNumber,
    }));
    res.json({ bookings: bookingList });
  } catch (error: any) {
    console.error('List bookings error:', error.message);
    res.status(500).json({ error: 'Failed to list bookings', details: error.message });
  }
});

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`   YUTORI_API_KEY: ${YUTORI_API_KEY ? '✓ Set' : '✗ Not set (using mock data)'}`);
  console.log(`   FREEPIK_API_KEY: ${FREEPIK_API_KEY ? '✓ Set' : '✗ Not set (using mock data)'}`);
  console.log(`   VAPI_API_KEY: ${VAPI_API_KEY ? '✓ Set' : '✗ Not set (using mock calls)'}`);
});
