import dotenv from "dotenv";
import { VehicleRepairAgent } from "./vehicle-repair-agent";
import { VehicleRepairShopResults } from "./types";

// Load environment variables
dotenv.config();

async function main(): Promise<void> {
  // Get configuration from environment
  const apiKey = process.env.YUTORI_API_KEY;
  const userLocation = process.env.USER_LOCATION || "San Jose, CA, US";
  const searchRadiusMiles = 5;

  if (!apiKey) {
    console.error("❌ Error: YUTORI_API_KEY environment variable is not set.");
    console.error("Please create a .env file with your Yutori API key.");
    console.error("Example: YUTORI_API_KEY=your_api_key_here");
    process.exit(1);
  }

  console.log("🚗 Vehicle Repair Shop Finder Agent");
  console.log("====================================\n");
  console.log(`📍 Searching near: ${userLocation}`);
  console.log(`📏 Search radius: ${searchRadiusMiles} miles\n`);

  // Create the agent
  const agent = new VehicleRepairAgent(apiKey, userLocation);

  try {
    // Use Research API to find repair shops (recommended for comprehensive results)
    const results: VehicleRepairShopResults = await agent.findRepairShopsWithResearch(
      searchRadiusMiles
    );

    // Print summary to console
    agent.printSummary(results);

    // Save results to file
    const savedPath = agent.saveResults(results);
    console.log(`\n📁 Data stored at: ${savedPath}`);

    // Output full JSON results
    console.log("\n📄 Full JSON Results:");
    console.log("=".repeat(60));
    console.log(agent.formatResults(results));

    // Return the results
    return;
  } catch (error) {
    if (error instanceof Error) {
      console.error(`❌ Error: ${error.message}`);
    } else {
      console.error("❌ An unexpected error occurred");
    }
    process.exit(1);
  }
}

// Alternative function to use Browsing API
async function findWithBrowsing(): Promise<void> {
  const apiKey = process.env.YUTORI_API_KEY;
  const userLocation = process.env.USER_LOCATION || "San Jose, CA, US";

  if (!apiKey) {
    console.error("❌ Error: YUTORI_API_KEY is not set");
    process.exit(1);
  }

  const agent = new VehicleRepairAgent(apiKey, userLocation);

  try {
    // Use Browsing API with Yelp
    const results = await agent.findRepairShopsWithBrowsing(5, "https://www.yelp.com");
    agent.printSummary(results);
    console.log(agent.formatResults(results));
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

// Alternative function to use both APIs for comprehensive results
async function findComprehensive(): Promise<void> {
  const apiKey = process.env.YUTORI_API_KEY;
  const userLocation = process.env.USER_LOCATION || "San Jose, CA, US";

  if (!apiKey) {
    console.error("❌ Error: YUTORI_API_KEY is not set");
    process.exit(1);
  }

  const agent = new VehicleRepairAgent(apiKey, userLocation);

  try {
    // Use both Research and Browsing APIs
    const results = await agent.findRepairShopsComprehensive(5);
    agent.printSummary(results);
    console.log(agent.formatResults(results));
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

// Export functions for programmatic use
export { VehicleRepairAgent };
export * from "./types";
export * from "./yutori-client";

// Run main function
main();
