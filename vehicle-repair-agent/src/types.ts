// Yutori API Types

export interface TaskSpec {
  output_schema: {
    json_schema: object;
    type: "json";
  };
}

// Research API Types
export interface ResearchCreateRequest {
  query: string;
  user_timezone?: string;
  user_location?: string;
  task_spec?: TaskSpec;
  webhook_url?: string;
  webhook_format?: "scout" | "slack" | "zapier";
}

export interface ResearchCreateResponse {
  task_id: string;
  view_url: string;
  status: "queued" | "running" | "succeeded" | "failed";
  webhook_url?: string;
}

export interface ResearchStatusResponse {
  task_id: string;
  view_url: string;
  status: "queued" | "running" | "succeeded" | "failed";
  result?: string;
  structured_result?: object;
  created_at?: string;
  updates?: Array<{
    id: string;
    timestamp: number;
    content: string;
    citations?: Array<{
      id: string;
      url: string;
      preview_data?: object;
    }>;
    structured_result?: object;
  }>;
}

// Browsing API Types
export interface BrowsingCreateRequest {
  task: string;
  start_url: string;
  max_steps?: number;
  agent?: "navigator-n1-preview-2025-11" | "claude-sonnet-4-5-computer-use-2025-01-24" | "yutori_navigator" | "anthropic_computer_use";
  require_auth?: boolean;
  task_spec?: TaskSpec;
  webhook_url?: string;
  webhook_format?: "scout" | "slack" | "zapier";
}

export interface BrowsingCreateResponse {
  task_id: string;
  view_url: string;
  status: "queued" | "running" | "succeeded" | "failed";
  result?: string;
  paused?: boolean;
  structured_result?: object;
  webhook_url?: string;
}

export interface BrowsingStatusResponse {
  task_id: string;
  view_url: string;
  status: "queued" | "running" | "succeeded" | "failed";
  result?: string;
  paused?: boolean;
  structured_result?: object;
  webhook_url?: string;
}

// Vehicle Repair Shop Types
export interface VehicleRepairShop {
  shop_name: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  phone_number: string;
  email?: string;
  website?: string;
  rating?: number;
  review_count?: number;
  reviews?: string[];
  services?: string[];
  hours_of_operation?: string;
  distance_miles?: number;
}

export interface VehicleRepairShopResults {
  shops: VehicleRepairShop[];
  search_location: string;
  search_radius_miles: number;
  total_found: number;
}
