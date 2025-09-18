import axios from "axios";

const GEOAPIFY_API_KEY = process.env.GEOAPIFY_API_KEY;

export const getRouteDistance = async (pickup, dropoff) => {
  const url = `https://api.geoapify.com/v1/routing?waypoints=${pickup.lat},${pickup.lng}|${dropoff.lat},${dropoff.lng}&mode=drive&apiKey=${GEOAPIFY_API_KEY}`;

  const { data } = await axios.get(url);

  if (!data.features || data.features.length === 0) {
    throw new Error("No route found");
  }

  const route = data.features[0].properties;

  return {
    distance: route.distance / 1000, // meters → km
    duration: route.time / 60, // seconds → minutes
  };
};


// Fare calculate karne ka logic
export const calculateFare = (distance, baseFare = 50, perKmRate = 10) => {
  return Math.round(baseFare + distance * perKmRate);
};
