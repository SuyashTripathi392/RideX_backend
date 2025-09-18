import { supabase } from "../config/supabaseClient.js";
import { getAddressCoordinates } from "../utils/getAddressCoordinates.js";

import {  calculateFare, getRouteDistance } from "../utils/rideUtils.js";

export const createRide = async (req, res) => {
  try {
    const { pickup, dropoff } = req.body;
    const rider_id = req.user.id;

    if (!pickup || !dropoff) {
      return res.status(400).json({
        success: false,
        message: "Pickup and dropoff location required",
      });
    }

    // 1️⃣ Get rider name + phone from users table
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("name, phone")
      .eq("id", rider_id)
      .single();

    if (userError || !userData) {
      return res.status(400).json({
        success: false,
        message: "Rider not found",
      });
    }

    const rider_name = userData.name;
    const rider_phone = userData.phone;

    // Pickup coordinates
    const pickupCoords = await getAddressCoordinates(pickup);

    // Dropoff coordinates
    const dropoffCoords = await getAddressCoordinates(dropoff);

    // Distance & duration from Geoapify
    const route = await getRouteDistance(pickupCoords, dropoffCoords);
    const distance = route.distance; // km
    const duration = Math.round(route.duration); // minutes

    // Fare calculation
    const fare = calculateFare(distance);

    // 2️⃣ Insert ride with rider_name + rider_phone
    const { data, error } = await supabase
      .from("rides")
      .insert([
        {
          pickup,
          dropoff,
          rider_id,
          rider_name,    // ✅ added
          rider_phone,   // ✅ added
          pickup_location: pickupCoords,
          dropoff_location: dropoffCoords,
          status: "pending_payment",
          distance: distance.toFixed(2),
          duration,
          fare,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      ride: data,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};




export const acceptRide = async (req, res) => {
    try {
        const driver_id = req.user.id
        const { ride_id } = req.params

        // check if driver  is active
        const { data: driver, error: driverError } = await supabase
            .from("drivers")
            .select('*')
            .eq("id", driver_id)
            .single()

        if (driverError || !driver.is_active) {
            return res.status(400).json({
                success: false,
                message: "Driver not active or not found"
            })
        }

        // Get ride
        const { data: ride, error: rideError } = await supabase
            .from("rides")
            .select("*")
            .eq("id", ride_id).single()

        if (rideError) throw rideError

        console.log(ride)

        if (ride.status !== "requested") {
            return res.status(400).json({
                success: false,
                message: "Ride already assigned"
            })
        }

        // Assign driver and update status 
        const { data, error } = await supabase
            .from("rides")
            .update({ driver_id, status: "accepted" })
            .eq("id", ride_id)
            .select()
            .single()

        if (error) throw error

        res.json({
            success: true,
            ride: data
        })
    } catch (err) {
        return res.json({
            success: false,
            message: err.message
        })
    }

}

export const startRide = async (req, res) => {
    try {
        const { ride_id } = req.params
        const driver_id = req.user.id

        const { data: ride, error: rideError } = await supabase
            .from("rides")
            .select("*")
            .eq("id", ride_id)
            .single()

        if (rideError) throw rideError

        if (ride.status !== "accepted") {
            res.status(400).json({
                success: false,
                message: "Ride not accepted yet"
            })
        }

        if (ride.driver_id !== driver_id) {
            return res.status(400).json({
                success: false,
                message: "Not authorized  to start this ride"
            })
        }

        const { data, error } = await supabase
            .from("rides")
            .update({
                status: "in_progress",
                start_time: new Date()
            }).eq("id", ride_id)
            .select().single()

        if (error) throw error

        return res.json({
            success: true,
            message: "Ride start successfully"
        })

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message
        })
    }
}



export const completeRide = async (req, res) => {
  try {
    const { ride_id } = req.params;
    const driver_id = req.user.id;

    // Ride find karo
    const { data: ride, error: rideError } = await supabase
      .from("rides")
      .select("*")
      .eq("id", ride_id)
      .single();

    if (rideError) throw rideError;

    if (!ride) {
      return res
        .status(404)
        .json({ success: false, message: "Ride not found" });
    }

    if (ride.driver_id !== driver_id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to complete this ride",
      });
    }

    // Geoapify se actual route distance nikaalo
    const route = await getRouteDistance(
      ride.pickup_location,
      ride.dropoff_location
    );

    const distance = route.distance; // km
    const duration = Math.round(route.duration); // minutes

    // Fare calculate
    const fare = calculateFare(distance);

    // Ride update
    const { data: updatedRide, error: updateError } = await supabase
      .from("rides")
      .update({
        status: "completed",
        completed_at: new Date(),
        fare: fare,
        distance: distance.toFixed(2),
        duration: duration, // yeh bhi save kar lo
      })
      .eq("id", ride_id)
      .select()
      .single();

    if (updateError) throw updateError;

    res.status(200).json({
      success: true,
      message: "Ride completed successfully",
      ride: updatedRide,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};


// Available rides
export const getAvailableRides = async (req, res) => {
  try {
    const driverId = req.user.id;

    // Driver ka status check karo
    const { data: driver, error: driverError } = await supabase
      .from("drivers") // ya driver table
      .select("is_active")
      .eq("id", driverId)
      .single();

    if (driverError || !driver) {
      return res.status(404).json({ success: false, message: "Driver not found" });
    }

    if (!driver.is_active) {
      return res.json({ success: true, rides: [] }); // inactive driver ke liye koi ride nahi
    }

    // Active driver ke liye available rides fetch karo
    const { data: rides, error } = await supabase
      .from("rides")
      .select("*")
      .eq("status", "requested");

    if (error) throw error;

    return res.json({ success: true, rides });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};



// Driver's current ride
export const getCurrentRide = async (req, res) => {
  try {
    const driver_id = req.user.id;

    const { data: ride, error } = await supabase
      .from("rides")
      .select("*")
      .eq("driver_id", driver_id)
      .in("status", ["accepted", "in_progress"])
      .single();

    if (error && error.code !== "PGRST116") throw error; // no rows found error ignore

    return res.json({ success: true, ride: ride || null });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// User ke rides (ongoing + completed)
export const getUserRides = async (req, res) => {
  try {
    const rider_id = req.user.id;

    // Ongoing rides
    const { data: ongoingRides, error: ongoingError } = await supabase
      .from("rides")
      .select("*")
      .eq("rider_id", rider_id)
      .in("status", ["pending_payment", "requested", "accepted", "in_progress"])
      .order("created_at", { ascending: false });

    if (ongoingError) throw ongoingError;

    // Completed rides
    const { data: completedRides, error: completedError } = await supabase
      .from("rides")
      .select("*")
      .eq("rider_id", rider_id)
      .eq("status", "completed")
      .order("completed_at", { ascending: false });

    if (completedError) throw completedError;

    return res.json({
      success: true,
      ongoing: ongoingRides,
      completed: completedRides,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};



export const getDriverStats = async (req, res) => {
  try {
    const driverId = req.user.id; // verifyToken middleware se milta hai

    // Supabase query example (rides table assume kiya hai)
    const { data: rides, error } = await supabase
      .from("rides")
      .select("*")
      .eq("driver_id", driverId)
      .eq("status", "completed");

    if (error) throw error;

    const completedRides = rides.length;
    const todayEarnings = rides
      .filter((r) => {
        const rideDate = new Date(r.completed_at); // completed_at column
        const today = new Date();
        return (
          rideDate.getDate() === today.getDate() &&
          rideDate.getMonth() === today.getMonth() &&
          rideDate.getFullYear() === today.getFullYear()
        );
      })
      .reduce((sum, r) => sum + (r.fare || 0), 0);

    // example rating (agar user rating table hai to use fetch karo)
    const rating = 4.8;

    res.status(200).json({
      success: true,
      completed_rides: completedRides,
      today_earnings: todayEarnings,
      rating,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};




export const getUserDashboard = async (req, res) => {
  try {
    const userId = req.user.id; // token se mila

    // ✅ Recent rides (last 5)
    const { data: rides, error: ridesError } = await supabase
      .from("rides")
      .select("*")
      .eq("rider_id", userId)
      .order("created_at", { ascending: false })
      .limit(5);

    if (ridesError) throw ridesError;

    // ✅ Stats
    const { data: allRides, error: allError } = await supabase
      .from("rides")
      .select("fare, status")
      .eq("rider_id", userId);

    if (allError) throw allError;

    const totalRides = allRides.length;
    const completedRides = allRides.filter(r => r.status === "completed").length;
    const totalSpent = allRides
      .filter(r => r.status === "completed")
      .reduce((sum, r) => sum + (r.fare || 0), 0);

    res.json({
      success: true,
      recentRides: rides,
      stats: { totalRides, completedRides, totalSpent }
    });
  } catch (err) {
    console.error("Dashboard fetch error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};


// ✅ Get driver details for a ride
export const getDriverDetails = async (req, res) => {
  try {
    const { ride_id } = req.params;

    // 1️⃣ Ride fetch karo
    const { data: ride, error: rideError } = await supabase
      .from("rides")
      .select("driver_id")
      .eq("id", ride_id)
      .single();

    if (rideError || !ride) {
      return res.status(404).json({
        success: false,
        message: "Ride not found",
      });
    }

    if (!ride.driver_id) {
      return res.status(400).json({
        success: false,
        message: "No driver assigned yet",
      });
    }

    // 2️⃣ Driver ki details fetch karo (name, phone, vehicle, etc.)
    const { data: driver, error: driverError } = await supabase
      .from("drivers")
      .select("name, phone, vehicle_no, vehicle_model")
      .eq("id", ride.driver_id)
      .single();

    if (driverError || !driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found",
      });
    }

    // 3️⃣ Completed rides calculate karo
    const { count: completedRidesCount, error: countError } = await supabase
      .from("rides")
      .select("*", { count: "exact", head: true })
      .eq("driver_id", ride.driver_id)
      .eq("status", "completed");

    if (countError) {
      return res.status(500).json({
        success: false,
        message: "Error fetching completed rides",
      });
    }

    // 4️⃣ Driver object me add karo
    const driverWithRides = {
      ...driver,
      completed_rides: completedRidesCount || 0,
    };

    // 5️⃣ Response bhejo
    return res.json({
      success: true,
      driver: driverWithRides,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};


// example Express + Supabase
export const getCompletedRides= async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("rides")
      .select("*")
      .eq("driver_id", req.user.id)
      .eq("status", "completed")
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({ success: true, rides: data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};





// POST /ride/cancel/:rideId
export const cancelRide = async (req, res) => {
  try {
    const rideId = req.params.rideId;
    const driverId = req.user.id; // middleware should set req.user

    // 1️⃣ Fetch the ride to verify
    const { data: ride, error: fetchError } = await supabase
      .from("rides")
      .select("*")
      .eq("id", rideId)
      .single();

    if (fetchError || !ride) {
      return res.status(404).json({ success: false, message: "Ride not found" });
    }

    // 2️⃣ Check if this driver owns the ride
    if (ride.driver_id !== driverId) {
      return res.status(403).json({ success: false, message: "Not authorized to cancel this ride" });
    }

    // 3️⃣ Check if ride is already completed or canceled
    if (ride.status === "completed" || ride.status.includes("canceled")) {
      return res.status(400).json({ success: false, message: "Cannot cancel this ride" });
    }

    // 4️⃣ Update ride status to canceled_by_driver
    const { error: updateError } = await supabase
      .from("rides")
      .update({ status: "canceled_by_driver" })
      .eq("id", rideId);

    if (updateError) {
      throw updateError;
    }

    return res.json({ success: true, message: "Ride canceled successfully" });
  } catch (err) {
    console.error("Cancel ride error:", err.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
