import axios from "axios";

const GEOAPIFY_API_KEY = process.env.GEOAPIFY_API_KEY;

export const getAddressCoordinates = async (address) => {
  try {
    const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(
      address
    )}&apiKey=${GEOAPIFY_API_KEY}`;

    const { data } = await axios.get(url);

    if (!data.features || data.features.length === 0) {
      throw new Error("Invalid address");
    }

    const { lat, lon } = data.features[0].properties;

    return {
      lat,
      lng: lon,
    };
  } catch (error) {
    console.error("Error fetching coordinates:", error.message);
    throw new Error("Error fetching coordinates");
  }
};
