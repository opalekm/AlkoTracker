export interface UserProfile {
  weight: number; // in kg
  gender: 'male' | 'female';
  age: number;
}

export interface DrinkType {
  id: string;
  name: string;
  volume: number; // in liters
  abv: number; // alcohol by volume percentage (e.g., 5 for 5%)
  icon: string;
}

export interface BeerEntry {
  id: string;
  timestamp: number;
  type: string; // Display name
  volume: number;
  abv: number;
}

export interface Session {
  id: string;
  startTime: number;
  endTime?: number;
  beers: BeerEntry[];
}
