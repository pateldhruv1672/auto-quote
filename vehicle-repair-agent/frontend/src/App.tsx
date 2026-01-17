import { useState, useCallback, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';
import { VehicleRepairShop, Location } from './types';

// Fix Leaflet marker icons
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// @ts-expect-error - Leaflet icon fix
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Custom marker for repair shops
const shopIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Custom marker for user location
const userIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Quotation result type
interface QuotationResult {
  callId: string;
  shopName: string;
  phoneNumber: string;
  status: string;
  transcript?: string;
  summary?: string;
  quotation?: {
    price: number;
    currency: string;
    estimatedDays?: number;
    notes?: string;
  };
  duration?: number;
}

interface CallAnalysis {
  ranked: QuotationResult[];
  bestOption?: QuotationResult;
  summary: string;
}

// Component to recenter map
function MapRecenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], 12);
  }, [lat, lng, map]);
  return null;
}

function App() {
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [location, setLocation] = useState<Location | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [damageDescription, setDamageDescription] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [shops, setShops] = useState<VehicleRepairShop[]>([]);
  const [statusMessage, setStatusMessage] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [_callSessionId, setCallSessionId] = useState<string | null>(null);
  const [callResults, setCallResults] = useState<QuotationResult[] | null>(null);
  const [callAnalysis, setCallAnalysis] = useState<CallAnalysis | null>(null);
  const [shopsBeingCalled, setShopsBeingCalled] = useState<string[]>([]);
  const [callElapsedSeconds, setCallElapsedSeconds] = useState(0);
  const [showQuotationModal, setShowQuotationModal] = useState(false);
  
  // Booking state
  const [isBooking, setIsBooking] = useState(false);
  const [bookingShop, setBookingShop] = useState<VehicleRepairShop | null>(null);
  const [bookingResult, setBookingResult] = useState<{
    appointmentBooked: boolean;
    appointmentDate?: string;
    appointmentTime?: string;
    confirmationNumber?: string;
    specialInstructions?: string;
    summary?: string;
  } | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // Get user's location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          
          // Reverse geocode to get city/state
          try {
            const response = await axios.get(
              `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
            );
            const address = response.data.address;
            setLocation({
              latitude,
              longitude,
              city: address.city || address.town || address.village,
              state: address.state,
              country: address.country,
              formatted: `${address.city || address.town || address.village}, ${address.state}, ${address.country}`,
            });
          } catch {
            setLocation({ latitude, longitude });
          }
        },
        (error) => {
          setLocationError(error.message);
          // Default to San Jose, CA
          setLocation({
            latitude: 37.3382,
            longitude: -121.8863,
            city: 'San Jose',
            state: 'CA',
            country: 'US',
            formatted: 'San Jose, CA, US',
          });
        }
      );
    }
  }, []);

  // Handle image upload
  const handleImageUpload = useCallback((file: File) => {
    setImage(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
    setDamageDescription(null);
    setStatusMessage({ type: 'info', message: 'Image uploaded! Click "Analyze & Find Repair Shops" to continue.' });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleImageUpload(file);
    }
  }, [handleImageUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Analyze image and search for repair shops
  const handleSearch = async () => {
    if (!image || !location) return;

    setIsAnalyzing(true);
    setStatusMessage({ type: 'info', message: '🔍 Analyzing car damage using AI...' });
    setCallResults(null);
    setCallAnalysis(null);

    try {
      // Convert image to base64
      const base64 = imagePreview?.split(',')[1];

      // Step 1: Analyze image with Freepik API
      const analyzeResponse = await axios.post('/api/analyze-image', {
        image: base64,
      });

      const description = analyzeResponse.data.description;
      setDamageDescription(description);
      setIsAnalyzing(false);

      // Step 2: Search for repair shops
      setIsSearching(true);
      setStatusMessage({ type: 'info', message: '🔎 Searching for nearby repair shops...' });

      const searchResponse = await axios.post('/api/search-shops', {
        location: location.formatted || `${location.latitude}, ${location.longitude}`,
        latitude: location.latitude,
        longitude: location.longitude,
        damageDescription: description,
        radiusMiles: 5,
      });

      const results = searchResponse.data;
      setShops(results.shops);
      setIsSearching(false);

      // Step 3: Start AI calling to repair shops
      if (results.shops.length > 0) {
        await startCallingShops(results.shops, description);
      } else {
        setStatusMessage({ type: 'info', message: 'No repair shops found in your area.' });
      }
    } catch (error) {
      console.error('Error:', error);
      setIsAnalyzing(false);
      setIsSearching(false);
      setStatusMessage({ type: 'error', message: 'An error occurred. Please try again.' });
    }
  };

  // Start VAPI calls to repair shops
  const startCallingShops = async (shopList: VehicleRepairShop[], damage: string) => {
    setIsCalling(true);
    setStatusMessage({ type: 'info', message: '📞 AI agent is calling repair shops for quotes...' });

    try {
      // Initiate calls
      const callResponse = await axios.post('/api/call-shops', {
        shops: shopList,
        damageDescription: damage,
        limit: 2, // Demo: only call 2 shops
      });

      const sessionId = callResponse.data.sessionId;
      setCallSessionId(sessionId);
      setShopsBeingCalled(callResponse.data.shopsBeingCalled || []);

      // Poll for call completion
      let elapsed = 0;
      const pollInterval = 3000;
      const maxWait = 120000; // 2 minutes max

      while (elapsed < maxWait) {
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
        elapsed += pollInterval;
        setCallElapsedSeconds(Math.round(elapsed / 1000));

        const statusResponse = await axios.get(`/api/call-status/${sessionId}`);
        const status = statusResponse.data;

        if (status.status === 'completed') {
          setCallResults(status.results || []);
          setCallAnalysis(status.analysis || null);
          setIsCalling(false);
          setShowQuotationModal(true);
          setStatusMessage({ 
            type: 'success', 
            message: `✅ Received ${status.results?.length || 0} quotes from repair shops!` 
          });
          return;
        } else if (status.status === 'failed') {
          throw new Error('Call session failed');
        }
      }

      // Timeout
      setIsCalling(false);
      setStatusMessage({ type: 'error', message: 'Call session timed out. Please try again.' });
    } catch (error) {
      console.error('Calling error:', error);
      setIsCalling(false);
      setStatusMessage({ type: 'error', message: 'Failed to get quotes. Please try again.' });
    }
  };

  // Book appointment at selected shop
  const handleBookAppointment = async (shop: VehicleRepairShop) => {
    if (!customerName || !customerPhone) {
      setShowBookingModal(true);
      setBookingShop(shop);
      return;
    }

    setIsBooking(true);
    setBookingShop(shop);
    setShowQuotationModal(false);
    setStatusMessage({ type: 'info', message: `📞 AI is calling ${shop.shop_name} to book your appointment...` });

    try {
      const response = await axios.post('/api/book-appointment', {
        shop,
        damageDescription,
        customerName,
        customerPhone,
      });

      const bookingId = response.data.bookingId;

      // Poll for booking completion
      let elapsed = 0;
      const pollInterval = 3000;
      const maxWait = 120000;

      while (elapsed < maxWait) {
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
        elapsed += pollInterval;

        const statusResponse = await axios.get(`/api/booking-status/${bookingId}`);
        const status = statusResponse.data;

        if (status.status === 'completed') {
          setBookingResult(status.result);
          setIsBooking(false);
          setShowBookingModal(true);
          setStatusMessage({ 
            type: 'success', 
            message: status.result?.appointmentBooked 
              ? `✅ Appointment booked at ${shop.shop_name}!` 
              : `⚠️ Could not confirm appointment at ${shop.shop_name}` 
          });
          return;
        } else if (status.status === 'failed') {
          throw new Error('Booking call failed');
        }
      }

      setIsBooking(false);
      setStatusMessage({ type: 'error', message: 'Booking call timed out. Please try again.' });
    } catch (error) {
      console.error('Booking error:', error);
      setIsBooking(false);
      setStatusMessage({ type: 'error', message: 'Failed to book appointment. Please try again.' });
    }
  };

  // Submit booking with customer info
  const submitBooking = () => {
    if (bookingShop && customerName && customerPhone) {
      setShowBookingModal(false);
      handleBookAppointment(bookingShop);
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>🚗 Car Damage Repair Finder</h1>
        <p>Upload a photo of your car damage and we'll find the best repair shops near you</p>
      </header>

      <div className="main-content">
        {/* Left Panel - Upload & Analysis */}
        <div className="upload-section">
          <div
            className={`upload-zone ${isDragging ? 'dragging' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <input
              id="file-input"
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
            />
            {imagePreview ? (
              <img src={imagePreview} alt="Car damage" className="preview-image" />
            ) : (
              <>
                <div className="upload-icon">📷</div>
                <h3>Upload Car Damage Photo</h3>
                <p>Drag & drop or click to upload</p>
              </>
            )}
          </div>

          {/* Location Section */}
          <div className="location-section">
            <div className="location-header">
              <span>📍</span>
              <h4>Your Location</h4>
            </div>
            <div className={`location-status ${location ? 'active' : ''}`}>
              {location ? (
                <>
                  <span>✓</span>
                  <span>{location.formatted || `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`}</span>
                </>
              ) : locationError ? (
                <span>❌ {locationError}</span>
              ) : (
                <>
                  <div className="loading-spinner"></div>
                  <span>Getting your location...</span>
                </>
              )}
            </div>
          </div>

          {/* Damage Analysis */}
          {damageDescription && (
            <div className="damage-analysis">
              <h4>
                <span>🔧</span>
                AI Damage Analysis
              </h4>
              <p className="damage-description">{damageDescription}</p>
            </div>
          )}

          {/* Status Message */}
          {statusMessage && (
            <div className={`status-message ${statusMessage.type}`}>
              <span>{statusMessage.message}</span>
            </div>
          )}

          {/* Search Button */}
          <button
            className="search-button"
            onClick={handleSearch}
            disabled={!image || !location || isAnalyzing || isSearching}
          >
            {isAnalyzing ? (
              <>
                <div className="loading-spinner"></div>
                Analyzing damage...
              </>
            ) : isSearching ? (
              <>
                <div className="loading-spinner"></div>
                Searching for shops...
              </>
            ) : (
              <>
                <span>🔍</span>
                Analyze & Find Repair Shops
              </>
            )}
          </button>
        </div>

        {/* Right Panel - Map & Results */}
        <div className="map-section">
          <div className="map-header">
            <h3>🗺️ Nearby Repair Shops</h3>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {callResults && callResults.length > 0 && (
                <button 
                  className="view-quotations-button" 
                  onClick={() => setShowQuotationModal(true)}
                >
                  📊 View Quotations
                </button>
              )}
              {shops.length > 0 && (
                <span className="shop-count">{shops.length} shops found</span>
              )}
            </div>
          </div>

          <div className="map-container">
            <MapContainer
              center={[location?.latitude || 37.3382, location?.longitude || -121.8863]}
              zoom={12}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              
              {location && <MapRecenter lat={location.latitude} lng={location.longitude} />}
              
              {/* User location marker */}
              {location && (
                <Marker position={[location.latitude, location.longitude]} icon={userIcon}>
                  <Popup>
                    <strong>📍 Your Location</strong>
                    <br />
                    {location.formatted}
                  </Popup>
                </Marker>
              )}

              {/* Shop markers */}
              {shops.map((shop, index) => (
                shop.latitude && shop.longitude && (
                  <Marker
                    key={index}
                    position={[shop.latitude, shop.longitude]}
                    icon={shopIcon}
                  >
                    <Popup>
                      <strong>🔧 {shop.shop_name}</strong>
                      <br />
                      {shop.address}, {shop.city}
                      <br />
                      📞 {shop.phone_number}
                      {shop.rating && (
                        <>
                          <br />
                          ⭐ {shop.rating}/5 ({shop.review_count} reviews)
                        </>
                      )}
                    </Popup>
                  </Marker>
                )
              ))}
            </MapContainer>
          </div>

          {/* Shop List */}
          {shops.length > 0 && (
            <div className="shop-list">
              {shops.map((shop, index) => (
                <div key={index} className="shop-card">
                  <h4>🔧 {shop.shop_name}</h4>
                  <p>📍 {shop.address}, {shop.city}, {shop.state} {shop.zip_code}</p>
                  <p>📞 {shop.phone_number}</p>
                  {shop.rating && (
                    <div className="shop-rating">
                      ⭐ {shop.rating}/5 ({shop.review_count || 0} reviews)
                    </div>
                  )}
                  {shop.distance_miles && (
                    <p>📏 {shop.distance_miles.toFixed(1)} miles away</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* AI Calling Overlay */}
      {isCalling && (
        <div className="ai-calling-overlay">
          <div className="ai-calling-content">
            <h2>🤖 AI Agent is Calling Repair Shops</h2>
            <div className="calling-animation">
              <div className="phone-icon">📞</div>
              <div className="phone-icon">📞</div>
              <div className="phone-icon">📞</div>
            </div>
            <p className="calling-status">
              Contacting {shopsBeingCalled.length || 2} repair shops for quotations...
            </p>
            <div className="calling-shops">
              {shopsBeingCalled.map((shopName, index) => (
                <span key={index} className="shop-chip calling" style={{ animationDelay: `${index * 0.2}s` }}>
                  📞 {shopName}
                </span>
              ))}
            </div>
            <p className="elapsed-time">⏱️ {callElapsedSeconds} seconds elapsed</p>
          </div>
        </div>
      )}

      {/* Quotation Results Modal */}
      {showQuotationModal && callResults && callResults.length > 0 && (
        <div className="quotation-modal-overlay" onClick={() => setShowQuotationModal(false)}>
          <div className="quotation-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowQuotationModal(false)}>×</button>
            
            <h2>📊 Quotation Results</h2>
            <p className="modal-subtitle">Select a shop to book your appointment for tomorrow</p>
            
            {/* Best Option Highlight */}
            {callAnalysis?.bestOption && (
              <div className="best-option">
                <div className="best-badge">✅ RECOMMENDED</div>
                <h3>{callAnalysis.bestOption.shopName}</h3>
                <div className="best-price">
                  ${callAnalysis.bestOption.quotation?.price?.toFixed(2)}
                </div>
                {callAnalysis.bestOption.quotation?.estimatedDays && (
                  <p>Estimated {callAnalysis.bestOption.quotation.estimatedDays} days</p>
                )}
                <p className="best-phone">📞 {callAnalysis.bestOption.phoneNumber}</p>
                <button 
                  className="book-button primary"
                  onClick={() => {
                    const shop = shops.find(s => s.shop_name === callAnalysis.bestOption?.shopName);
                    if (shop) handleBookAppointment(shop);
                  }}
                  disabled={isBooking}
                >
                  📅 Book Appointment for Tomorrow
                </button>
              </div>
            )}

            {/* All Quotes */}
            <div className="all-quotes">
              <h4>All Quotations Received:</h4>
              {callResults.map((result, index) => {
                const shop = shops.find(s => s.shop_name === result.shopName);
                return (
                  <div key={index} className={`quote-card ${callAnalysis?.bestOption?.callId === result.callId ? 'best' : ''}`}>
                    <div className="quote-header">
                      <h5>{result.shopName}</h5>
                      {result.quotation && (
                        <span className="quote-price">${result.quotation.price?.toFixed(2)}</span>
                      )}
                    </div>
                    <p className="quote-phone">📞 {result.phoneNumber}</p>
                    {result.quotation?.estimatedDays && (
                      <p>🕐 Est. {result.quotation.estimatedDays} days</p>
                    )}
                    {result.summary && (
                      <p className="quote-summary">{result.summary}</p>
                    )}
                    {result.duration && (
                      <p className="call-duration">Call duration: {result.duration}s</p>
                    )}
                    {shop && callAnalysis?.bestOption?.callId !== result.callId && (
                      <button 
                        className="book-button secondary"
                        onClick={() => handleBookAppointment(shop)}
                        disabled={isBooking}
                      >
                        📅 Book This Shop
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <button className="close-button" onClick={() => setShowQuotationModal(false)}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* Customer Info Modal (for booking) */}
      {showBookingModal && !bookingResult && (
        <div className="quotation-modal-overlay" onClick={() => setShowBookingModal(false)}>
          <div className="booking-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowBookingModal(false)}>×</button>
            
            <h2>📅 Book Appointment</h2>
            {bookingShop && (
              <p className="booking-shop-name">at {bookingShop.shop_name}</p>
            )}
            
            <div className="booking-form">
              <div className="form-group">
                <label>Your Name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Enter your full name"
                />
              </div>
              <div className="form-group">
                <label>Phone Number</label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Enter your phone number"
                />
              </div>
              <p className="booking-note">
                📞 Our AI will call the shop to book your appointment for tomorrow
              </p>
              <button 
                className="book-button primary"
                onClick={submitBooking}
                disabled={!customerName || !customerPhone}
              >
                📅 Confirm & Book Appointment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Booking Confirmation Modal */}
      {showBookingModal && bookingResult && (
        <div className="quotation-modal-overlay" onClick={() => setShowBookingModal(false)}>
          <div className="booking-modal confirmation" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowBookingModal(false)}>×</button>
            
            {bookingResult.appointmentBooked ? (
              <>
                <div className="booking-success-icon">✅</div>
                <h2>Appointment Confirmed!</h2>
                {bookingShop && (
                  <h3>{bookingShop.shop_name}</h3>
                )}
                <div className="booking-details">
                  {bookingResult.appointmentDate && (
                    <div className="detail-row">
                      <span className="detail-label">📅 Date:</span>
                      <span className="detail-value">{bookingResult.appointmentDate}</span>
                    </div>
                  )}
                  {bookingResult.appointmentTime && (
                    <div className="detail-row">
                      <span className="detail-label">🕐 Time:</span>
                      <span className="detail-value">{bookingResult.appointmentTime}</span>
                    </div>
                  )}
                  {bookingResult.confirmationNumber && (
                    <div className="detail-row">
                      <span className="detail-label">🔢 Confirmation:</span>
                      <span className="detail-value confirmation-number">{bookingResult.confirmationNumber}</span>
                    </div>
                  )}
                  {bookingResult.specialInstructions && (
                    <div className="detail-row instructions">
                      <span className="detail-label">📝 Instructions:</span>
                      <span className="detail-value">{bookingResult.specialInstructions}</span>
                    </div>
                  )}
                </div>
                {bookingResult.summary && (
                  <p className="booking-summary">{bookingResult.summary}</p>
                )}
              </>
            ) : (
              <>
                <div className="booking-failed-icon">⚠️</div>
                <h2>Could Not Confirm Appointment</h2>
                {bookingShop && (
                  <p>We were unable to confirm your appointment at {bookingShop.shop_name}.</p>
                )}
                {bookingResult.summary && (
                  <p className="booking-summary">{bookingResult.summary}</p>
                )}
                <p>Please try calling the shop directly or select another repair shop.</p>
              </>
            )}
            
            <button className="close-button" onClick={() => {
              setShowBookingModal(false);
              setBookingResult(null);
            }}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* Booking In Progress Overlay */}
      {isBooking && (
        <div className="ai-calling-overlay">
          <div className="ai-calling-content">
            <h2>📞 AI is Booking Your Appointment</h2>
            <div className="calling-animation">
              <div className="phone-icon">📅</div>
            </div>
            {bookingShop && (
              <p className="calling-status">
                Calling {bookingShop.shop_name} to schedule for tomorrow...
              </p>
            )}
            <p className="booking-customer">
              Booking for: {customerName}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
