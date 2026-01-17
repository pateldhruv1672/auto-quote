import axios from 'axios';

const VAPI_BASE_URL = 'https://api.vapi.ai';

export interface VapiCallRequest {
  phoneNumber: string;
  shopName: string;
  shopAddress: string;
  damageDescription: string;
  customerName?: string;
}

export interface BookingCallRequest {
  phoneNumber: string;
  shopName: string;
  shopAddress: string;
  damageDescription: string;
  customerName: string;
  customerPhone: string;
  vehicleInfo?: string;
  appointmentDate?: string; // e.g., "tomorrow", "January 17, 2026"
  preferredTime?: string; // e.g., "morning", "afternoon", "10:00 AM"
}

export interface VapiCallResponse {
  id: string;
  status: string;
  shopName: string;
  phoneNumber: string;
  createdAt?: string;
}

export interface VapiCallResult {
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
  endedReason?: string;
  recordingUrl?: string;
}

export interface BookingCallResult {
  callId: string;
  shopName: string;
  phoneNumber: string;
  status: string;
  transcript?: string;
  summary?: string;
  appointmentBooked: boolean;
  appointmentDate?: string;
  appointmentTime?: string;
  confirmationNumber?: string;
  specialInstructions?: string;
  estimatedCompletion?: string;
  alternativeDateOffered?: string;
  duration?: number;
  endedReason?: string;
}

export class VapiClient {
  private apiKey: string;
  private phoneNumberId: string;

  constructor(apiKey: string, phoneNumberId: string) {
    this.apiKey = apiKey;
    this.phoneNumberId = phoneNumberId;
  }

  /**
   * Create an outbound call to a repair shop
   */
  async createCall(request: VapiCallRequest): Promise<VapiCallResponse> {
    const systemPrompt = this.buildAssistantPrompt(request);

    const payload = {
      phoneNumberId: this.phoneNumberId,
      customer: {
        number: request.phoneNumber,
        name: request.shopName,
      },
      assistant: {
        name: 'AutoQuote AI Assistant',
        firstMessage: `Hello! I'm calling on behalf of a customer who needs vehicle repair services. Am I speaking with someone from ${request.shopName}?`,
        model: {
          provider: 'openai',
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
          ],
        },
        voice: {
          provider: '11labs',
          voiceId: 'pFZP5JQG7iQjIQuC4Bku', // Lily - Professional voice
        },
        transcriber: {
          provider: 'deepgram',
          model: 'nova-2',
          language: 'en',
        },
        maxDurationSeconds: 180, // 3 minute max call duration
        endCallMessage: 'Thank you for your time. Have a great day!',
        endCallPhrases: ['goodbye', 'bye', 'thank you bye', 'thanks bye'],
        analysisPlan: {
          summaryPlan: {
            enabled: true,
            messages: [
              {
                role: 'system',
                content: `Summarize this call with a focus on:
1. The quoted price for repairs (if provided)
2. Estimated time for repairs
3. Any additional services mentioned
4. Overall impression of the shop's responsiveness`,
              },
            ],
          },
          structuredDataPlan: {
            enabled: true,
            schema: {
              type: 'object',
              properties: {
                quotation_provided: { type: 'boolean' },
                quoted_price: { type: 'number' },
                currency: { type: 'string' },
                estimated_days: { type: 'number' },
                services_offered: { type: 'array', items: { type: 'string' } },
                additional_notes: { type: 'string' },
                shop_available: { type: 'boolean' },
                callback_requested: { type: 'boolean' },
              },
              required: ['quotation_provided', 'shop_available'],
            },
          },
        },
      },
      metadata: {
        shopName: request.shopName,
        shopAddress: request.shopAddress,
        damageDescription: request.damageDescription,
      },
    };

    try {
      const response = await axios.post(`${VAPI_BASE_URL}/call`, payload, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      return {
        id: response.data.id,
        status: response.data.status,
        shopName: request.shopName,
        phoneNumber: request.phoneNumber,
        createdAt: response.data.createdAt,
      };
    } catch (error: any) {
      console.error('VAPI call creation error:', error.response?.data || error.message);
      throw new Error(`Failed to create call: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get the status and details of a call
   */
  async getCall(callId: string): Promise<VapiCallResult> {
    try {
      const response = await axios.get(`${VAPI_BASE_URL}/call/${callId}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      const data = response.data;
      const structuredData = data.analysis?.structuredData || {};

      return {
        callId: data.id,
        shopName: data.metadata?.shopName || 'Unknown Shop',
        phoneNumber: data.customer?.number || '',
        status: data.status,
        transcript: data.transcript,
        summary: data.analysis?.summary,
        quotation: structuredData.quotation_provided
          ? {
              price: structuredData.quoted_price || 0,
              currency: structuredData.currency || 'USD',
              estimatedDays: structuredData.estimated_days,
              notes: structuredData.additional_notes,
            }
          : undefined,
        duration: data.costBreakdown?.total ? Math.round(data.costBreakdown.total * 60) : undefined,
        endedReason: data.endedReason,
        recordingUrl: data.recordingUrl,
      };
    } catch (error: any) {
      console.error('VAPI get call error:', error.response?.data || error.message);
      throw new Error(`Failed to get call: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Make parallel calls to multiple repair shops
   */
  async callMultipleShops(
    shops: Array<{ name: string; phone: string; address: string }>,
    damageDescription: string,
    limit: number = 2
  ): Promise<VapiCallResponse[]> {
    const shopsToCall = shops.slice(0, limit);

    const callPromises = shopsToCall.map((shop) =>
      this.createCall({
        phoneNumber: shop.phone,
        shopName: shop.name,
        shopAddress: shop.address,
        damageDescription,
      }).catch((error) => {
        console.error(`Failed to call ${shop.name}:`, error.message);
        return null;
      })
    );

    const results = await Promise.all(callPromises);
    return results.filter((r): r is VapiCallResponse => r !== null);
  }

  /**
   * Poll for call completion and get results
   */
  async waitForCallCompletion(
    callId: string,
    maxWaitMs: number = 300000, // 5 minutes max
    pollIntervalMs: number = 5000
  ): Promise<VapiCallResult> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const result = await this.getCall(callId);

      if (result.status === 'ended' || result.status === 'failed') {
        return result;
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(`Call ${callId} did not complete within ${maxWaitMs / 1000} seconds`);
  }

  /**
   * Build the assistant prompt for repair shop calls
   */
  private buildAssistantPrompt(request: VapiCallRequest): string {
    return `You are a professional AI assistant calling auto repair shops on behalf of a customer who needs vehicle repair services.

YOUR GOAL: Get a price quotation for the vehicle damage described below.

DAMAGE DESCRIPTION:
${request.damageDescription}

SHOP DETAILS:
- Shop Name: ${request.shopName}
- Address: ${request.shopAddress}

CONVERSATION GUIDELINES:
1. Be polite, professional, and efficient
2. Clearly describe the damage and ask for a repair quote
3. Ask about:
   - Estimated cost for the repair
   - How long the repair would take
   - If they can accommodate the customer this week
   - Any additional services they might recommend
4. If they can't provide an immediate quote, ask what information they would need
5. Thank them and end the call professionally

IMPORTANT:
- Keep the call under 3 minutes
- If they put you on hold, wait patiently but suggest you can call back
- If no one answers or it goes to voicemail, leave a brief message with a callback number
- Be understanding if they're busy and offer to call back

Remember: Your goal is to gather pricing information so the customer can make an informed decision about where to get their vehicle repaired.`;
  }

  /**
   * Build the assistant prompt for booking appointment calls
   */
  private buildBookingPrompt(request: BookingCallRequest): string {
    const appointmentDate = request.appointmentDate || 'tomorrow';
    const preferredTime = request.preferredTime || 'morning if possible, but flexible';
    
    return `You are a professional AI assistant calling an auto repair shop to book an appointment for a customer.

YOUR GOAL: Book a repair appointment for ${appointmentDate}.

CUSTOMER DETAILS:
- Name: ${request.customerName}
- Phone: ${request.customerPhone}
- Vehicle: ${request.vehicleInfo || 'Not specified'}

DAMAGE/REPAIR NEEDED:
${request.damageDescription}

SHOP DETAILS:
- Shop Name: ${request.shopName}
- Address: ${request.shopAddress}

APPOINTMENT PREFERENCES:
- Requested Date: ${appointmentDate}
- Preferred Time: ${preferredTime}

CONVERSATION GUIDELINES:
1. Greet them and explain you're calling to book a repair appointment
2. Mention you previously inquired about a quote and now want to schedule the repair
3. Request an appointment for ${appointmentDate}
4. Be flexible with timing - ask what slots are available
5. Confirm the appointment details:
   - Date and time
   - Customer name and contact
   - What to bring or prepare
6. Ask about drop-off procedures and estimated completion time
7. Thank them and confirm you'll be there

IMPORTANT:
- Keep the call professional and efficient
- If ${appointmentDate} is not available, ask for the next available date
- Get a confirmation number if they provide one
- Repeat back the appointment details to confirm

Remember: Your goal is to secure a confirmed appointment for the customer.`;
  }

  /**
   * Create an outbound call to book an appointment
   */
  async createBookingCall(request: BookingCallRequest): Promise<VapiCallResponse> {
    const systemPrompt = this.buildBookingPrompt(request);

    const payload = {
      phoneNumberId: this.phoneNumberId,
      customer: {
        number: request.phoneNumber,
        name: request.shopName,
      },
      assistant: {
        name: 'AutoQuote Booking Assistant',
        firstMessage: `Hello! I'm calling to book a repair appointment at ${request.shopName}. I previously inquired about a repair quote and would like to schedule an appointment for ${request.appointmentDate || 'tomorrow'}. Am I speaking with someone who can help with scheduling?`,
        model: {
          provider: 'openai',
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
          ],
        },
        voice: {
          provider: '11labs',
          voiceId: 'pFZP5JQG7iQjIQuC4Bku', // Lily - Professional voice
        },
        transcriber: {
          provider: 'deepgram',
          model: 'nova-2',
          language: 'en',
        },
        maxDurationSeconds: 180,
        endCallMessage: 'Thank you so much! We look forward to bringing the vehicle in. Have a great day!',
        endCallPhrases: ['goodbye', 'bye', 'thank you bye', 'thanks bye', 'see you tomorrow'],
        analysisPlan: {
          summaryPlan: {
            enabled: true,
            messages: [
              {
                role: 'system',
                content: `Summarize this booking call with a focus on:
1. Whether an appointment was successfully booked
2. The confirmed date and time
3. Any special instructions given
4. Confirmation number if provided`,
              },
            ],
          },
          structuredDataPlan: {
            enabled: true,
            schema: {
              type: 'object',
              properties: {
                appointment_booked: { type: 'boolean' },
                appointment_date: { type: 'string' },
                appointment_time: { type: 'string' },
                confirmation_number: { type: 'string' },
                special_instructions: { type: 'string' },
                estimated_completion: { type: 'string' },
                alternative_date_offered: { type: 'string' },
              },
              required: ['appointment_booked'],
            },
          },
        },
      },
      metadata: {
        type: 'booking',
        shopName: request.shopName,
        shopAddress: request.shopAddress,
        customerName: request.customerName,
        customerPhone: request.customerPhone,
        requestedDate: request.appointmentDate,
      },
    };

    try {
      const response = await axios.post(`${VAPI_BASE_URL}/call`, payload, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      return {
        id: response.data.id,
        status: response.data.status,
        shopName: request.shopName,
        phoneNumber: request.phoneNumber,
        createdAt: response.data.createdAt,
      };
    } catch (error: any) {
      console.error('VAPI booking call creation error:', error.response?.data || error.message);
      throw new Error(`Failed to create booking call: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get booking call result with appointment details
   */
  async getBookingResult(callId: string): Promise<BookingCallResult> {
    try {
      const response = await axios.get(`${VAPI_BASE_URL}/call/${callId}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      const data = response.data;
      const structuredData = data.analysis?.structuredData || {};

      return {
        callId: data.id,
        shopName: data.metadata?.shopName || 'Unknown Shop',
        phoneNumber: data.customer?.number || '',
        status: data.status,
        transcript: data.transcript,
        summary: data.analysis?.summary,
        appointmentBooked: structuredData.appointment_booked || false,
        appointmentDate: structuredData.appointment_date,
        appointmentTime: structuredData.appointment_time,
        confirmationNumber: structuredData.confirmation_number,
        specialInstructions: structuredData.special_instructions,
        estimatedCompletion: structuredData.estimated_completion,
        alternativeDateOffered: structuredData.alternative_date_offered,
        duration: data.costBreakdown?.total ? Math.round(data.costBreakdown.total * 60) : undefined,
        endedReason: data.endedReason,
      };
    } catch (error: any) {
      console.error('VAPI get booking call error:', error.response?.data || error.message);
      throw new Error(`Failed to get booking call: ${error.response?.data?.message || error.message}`);
    }
  }
}

/**
 * Analyze quotes from multiple calls and rank the repair shops
 */
export function analyzeAndRankQuotes(results: VapiCallResult[]): {
  ranked: VapiCallResult[];
  bestOption?: VapiCallResult;
  summary: string;
} {
  // Filter results with valid quotations
  const resultsWithQuotes = results.filter(
    (r) => r.quotation && r.quotation.price > 0
  );

  // Sort by price (lowest first)
  const ranked = [...resultsWithQuotes].sort(
    (a, b) => (a.quotation?.price || Infinity) - (b.quotation?.price || Infinity)
  );

  const bestOption = ranked[0];

  // Build summary
  let summary = `Analyzed ${results.length} repair shop(s).\n`;

  if (resultsWithQuotes.length === 0) {
    summary += 'No quotations were obtained from the calls.';
  } else {
    summary += `Received ${resultsWithQuotes.length} quote(s):\n\n`;
    ranked.forEach((r, i) => {
      summary += `${i + 1}. ${r.shopName}: $${r.quotation?.price?.toFixed(2)}`;
      if (r.quotation?.estimatedDays) {
        summary += ` (${r.quotation.estimatedDays} days)`;
      }
      summary += '\n';
    });

    if (bestOption) {
      summary += `\n✅ RECOMMENDED: ${bestOption.shopName} with the lowest quote of $${bestOption.quotation?.price?.toFixed(2)}`;
    }
  }

  return { ranked, bestOption, summary };
}
