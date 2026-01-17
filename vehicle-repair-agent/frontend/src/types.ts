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
  latitude?: number;
  longitude?: number;
}

export interface SearchResults {
  shops: VehicleRepairShop[];
  search_location: string;
  search_radius_miles: number;
  total_found: number;
  damage_description?: string;
}

export interface Location {
  latitude: number;
  longitude: number;
  city?: string;
  state?: string;
  country?: string;
  formatted?: string;
}

export interface ImageAnalysisResult {
  task_id: string;
  status: string;
  description?: string;
}
