import * as fs from "fs";
import * as path from "path";
import { YutoriClient } from "./yutori-client";
import {
  VehicleRepairShop,
  VehicleRepairShopResults,
  TaskSpec,
} from "./types";

export class VehicleRepairAgent {
  private client: YutoriClient;
  private userLocation: string;
  private userTimezone: string;

  constructor(
    apiKey: string,
    userLocation: string = "San Jose, CA, US",
    userTimezone: string = "America/Los_Angeles"
  ) {
    this.client = new YutoriClient(apiKey);
    this.userLocation = userLocation;
    this.userTimezone = userTimezone;
  }

  /**
   * Get the JSON schema for vehicle repair shop output
   */
  private getRepairShopSchema(): TaskSpec {
    return {
      output_schema: {
        json_schema: {
          type: "object",
          properties: {
            shops: {
              type: "array",
              description: "List of vehicle repair shops found",
              items: {
                type: "object",
                properties: {
                  shop_name: {
                    type: "string",
                    description: "Name of the repair shop",
                  },
                  address: {
                    type: "string",
                    description: "Street address of the shop",
                  },
                  city: {
                    type: "string",
                    description: "City where the shop is located",
                  },
                  state: {
                    type: "string",
                    description: "State where the shop is located",
                  },
                  zip_code: {
                    type: "string",
                    description: "ZIP code of the shop",
                  },
                  phone_number: {
                    type: "string",
                    description: "Contact phone number",
                  },
                  email: {
                    type: "string",
                    description: "Contact email address if available",
                  },
                  website: {
                    type: "string",
                    description: "Website URL if available",
                  },
                  rating: {
                    type: "number",
                    description: "Average rating (1-5 scale)",
                  },
                  review_count: {
                    type: "number",
                    description: "Total number of reviews",
                  },
                  reviews: {
                    type: "array",
                    description: "Sample customer reviews",
                    items: {
                      type: "string",
                    },
                  },
                  services: {
                    type: "array",
                    description: "List of services offered",
                    items: {
                      type: "string",
                    },
                  },
                  hours_of_operation: {
                    type: "string",
                    description: "Business hours",
                  },
                  distance_miles: {
                    type: "number",
                    description: "Distance from search location in miles",
                  },
                },
                required: ["shop_name", "address", "city", "state", "phone_number"],
              },
            },
            search_location: {
              type: "string",
              description: "The location that was searched",
            },
            search_radius_miles: {
              type: "number",
              description: "The search radius in miles",
            },
            total_found: {
              type: "number",
              description: "Total number of shops found",
            },
          },
          required: ["shops", "search_location", "search_radius_miles", "total_found"],
        },
        type: "json",
      },
    };
  }

  /**
   * Find vehicle repair shops using the Research API
   * This performs a deep web search to find repair shops
   */
  async findRepairShopsWithResearch(
    radiusMiles: number = 5
  ): Promise<VehicleRepairShopResults> {
    console.log(`\n🔍 Starting research to find vehicle repair shops within ${radiusMiles} miles of ${this.userLocation}...\n`);

    const query = `Find all vehicle repair shops, auto mechanics, and car service centers within ${radiusMiles} miles of ${this.userLocation}. 
    For each shop, provide:
    - Shop name
    - Full address (street, city, state, zip code)
    - Phone number
    - Email (if available)
    - Website (if available)
    - Rating and number of reviews
    - Sample customer reviews (2-3 reviews)
    - Services offered
    - Hours of operation
    - Approximate distance from ${this.userLocation}
    
    Focus on finding highly-rated shops with good customer reviews. Include both chain shops and independent mechanics.`;

    // Create the research task
    const createResponse = await this.client.createResearchTask({
      query,
      user_location: this.userLocation,
      user_timezone: this.userTimezone,
      task_spec: this.getRepairShopSchema(),
    });

    console.log(`📋 Research task created: ${createResponse.task_id}`);
    console.log(`🔗 View progress at: ${createResponse.view_url}`);

    // Wait for completion
    const result = await this.client.waitForResearchCompletion(
      createResponse.task_id,
      5000, // Poll every 5 seconds
      600000 // Max wait 10 minutes
    );

    if (result.status === "failed") {
      throw new Error(`Research task failed: ${result.result}`);
    }

    console.log(`\n✅ Research completed successfully!\n`);

    // Parse and return structured results
    if (result.structured_result) {
      return result.structured_result as VehicleRepairShopResults;
    }

    // If no structured result, create a basic response
    return {
      shops: [],
      search_location: this.userLocation,
      search_radius_miles: radiusMiles,
      total_found: 0,
    };
  }

  /**
   * Find vehicle repair shops using the Browsing API
   * This navigates to specific websites to extract shop information
   */
  async findRepairShopsWithBrowsing(
    radiusMiles: number = 5,
    startUrl: string = "https://www.yelp.com"
  ): Promise<VehicleRepairShopResults> {
    console.log(`\n🌐 Starting browser navigation to find vehicle repair shops within ${radiusMiles} miles of ${this.userLocation}...\n`);

    const task = `Search for "auto repair shops" or "vehicle repair" near "${this.userLocation}" within ${radiusMiles} miles.
    Extract the following information for each shop found:
    - Shop name
    - Full address
    - Phone number
    - Rating and review count
    - Sample reviews (2-3)
    - Services offered
    - Website link if available
    
    Find at least 10 repair shops if available. Sort by highest rating.`;

    // Create the browsing task
    const createResponse = await this.client.createBrowsingTask({
      task,
      start_url: startUrl,
      max_steps: 50,
      agent: "navigator-n1-preview-2025-11",
      task_spec: this.getRepairShopSchema(),
    });

    console.log(`📋 Browsing task created: ${createResponse.task_id}`);
    console.log(`🔗 View progress at: ${createResponse.view_url}`);

    // Wait for completion
    const result = await this.client.waitForBrowsingCompletion(
      createResponse.task_id,
      5000, // Poll every 5 seconds
      600000 // Max wait 10 minutes
    );

    if (result.status === "failed") {
      throw new Error(`Browsing task failed: ${result.result}`);
    }

    console.log(`\n✅ Browsing completed successfully!\n`);

    // Parse and return structured results
    if (result.structured_result) {
      return result.structured_result as VehicleRepairShopResults;
    }

    // If no structured result, create a basic response
    return {
      shops: [],
      search_location: this.userLocation,
      search_radius_miles: radiusMiles,
      total_found: 0,
    };
  }

  /**
   * Find repair shops using both Research and Browsing APIs
   * Combines results for more comprehensive coverage
   */
  async findRepairShopsComprehensive(
    radiusMiles: number = 5
  ): Promise<VehicleRepairShopResults> {
    console.log(`\n🚀 Starting comprehensive search (Research + Browsing) for vehicle repair shops...\n`);

    // Run research first for broad coverage
    const researchResults = await this.findRepairShopsWithResearch(radiusMiles);

    // Then use browsing for specific sites
    const browsingResults = await this.findRepairShopsWithBrowsing(
      radiusMiles,
      "https://www.google.com/maps"
    );

    // Merge results, removing duplicates by shop name
    const shopMap = new Map<string, VehicleRepairShop>();

    for (const shop of researchResults.shops) {
      shopMap.set(shop.shop_name.toLowerCase(), shop);
    }

    for (const shop of browsingResults.shops) {
      const key = shop.shop_name.toLowerCase();
      if (!shopMap.has(key)) {
        shopMap.set(key, shop);
      }
    }

    const mergedShops = Array.from(shopMap.values());

    return {
      shops: mergedShops,
      search_location: this.userLocation,
      search_radius_miles: radiusMiles,
      total_found: mergedShops.length,
    };
  }

  /**
   * Format results as a nice JSON string for output
   */
  formatResults(results: VehicleRepairShopResults): string {
    return JSON.stringify(results, null, 2);
  }

  /**
   * Print a summary of the results
   */
  printSummary(results: VehicleRepairShopResults): void {
    console.log("\n" + "=".repeat(60));
    console.log("📍 VEHICLE REPAIR SHOP SEARCH RESULTS");
    console.log("=".repeat(60));
    console.log(`Location: ${results.search_location}`);
    console.log(`Search Radius: ${results.search_radius_miles} miles`);
    console.log(`Total Shops Found: ${results.total_found}`);
    console.log("=".repeat(60) + "\n");

    for (const shop of results.shops) {
      console.log(`🔧 ${shop.shop_name}`);
      console.log(`   📍 ${shop.address}, ${shop.city}, ${shop.state} ${shop.zip_code}`);
      console.log(`   📞 ${shop.phone_number}`);
      if (shop.website) console.log(`   🌐 ${shop.website}`);
      if (shop.rating) console.log(`   ⭐ ${shop.rating}/5 (${shop.review_count || 0} reviews)`);
      if (shop.distance_miles) console.log(`   📏 ${shop.distance_miles} miles away`);
      if (shop.services && shop.services.length > 0) {
        console.log(`   🛠️  Services: ${shop.services.slice(0, 5).join(", ")}`);
      }
      if (shop.reviews && shop.reviews.length > 0) {
        console.log(`   💬 Sample Review: "${shop.reviews[0].slice(0, 100)}..."`);
      }
      console.log("");
    }
  }

  /**
   * Save results to a JSON file
   * @param results The search results to save
   * @param filePath Optional custom file path (default: ./data/repair_shops_<timestamp>.json)
   * @returns The path where the file was saved
   */
  saveResults(results: VehicleRepairShopResults, filePath?: string): string {
    // Create default path with timestamp if not provided
    if (!filePath) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const dataDir = path.join(process.cwd(), "data");
      
      // Create data directory if it doesn't exist
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      filePath = path.join(dataDir, `repair_shops_${timestamp}.json`);
    }

    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write results to file
    fs.writeFileSync(filePath, this.formatResults(results), "utf-8");
    console.log(`\n💾 Results saved to: ${filePath}`);

    return filePath;
  }

  /**
   * Load previously saved results from a JSON file
   * @param filePath Path to the JSON file
   * @returns The loaded results
   */
  loadResults(filePath: string): VehicleRepairShopResults {
    const data = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(data) as VehicleRepairShopResults;
  }

  /**
   * List all saved result files in the data directory
   * @returns Array of file paths
   */
  listSavedResults(): string[] {
    const dataDir = path.join(process.cwd(), "data");
    
    if (!fs.existsSync(dataDir)) {
      return [];
    }

    return fs.readdirSync(dataDir)
      .filter((file) => file.endsWith(".json"))
      .map((file) => path.join(dataDir, file));
  }
}
