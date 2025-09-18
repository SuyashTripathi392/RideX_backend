
import crypto from "crypto";
import { supabase } from "../config/supabaseClient.js";
import { razorpay } from "../config/razorpayClient.js";


// Create Razorpay order
export const createPaymentOrder = async (req, res) => {
  try {
    const { ride_id, currency } = req.body;
    const user_id = req.user.id; // auth se aayega

    // Ride ka fare nikal lo DB se
    const { data: ride, error: rideError } = await supabase
      .from("rides")
      .select("fare")
      .eq("id", ride_id)
      .single();

    console.log("Ride Error:", rideError);
    console.log("Ride Data:", ride);

    if (rideError) throw rideError;
    if (!ride) {
      return res.status(404).json({
        success: false,
        message: "Ride not found",
      });
    }

    const amount = ride.fare; // DB se liya hua

    // Razorpay order create
    const options = {
      amount: amount * 100, // convert to paisa
      currency: currency || "INR",
      receipt: ride_id,

    };

    const order = await razorpay.orders.create(options);

    // DB me entry
    const { data, error } = await supabase
      .from("payments")
      .insert([
        {
          ride_id,
          user_id,
          amount,
          currency: order.currency,
          order_id: order.id,
          status: "created",
        },
      ])
      .select()
      .single();

    if (error) throw error;

    console.log("Order:", order);
    console.log("Insert Error:", error);


    res.status(201).json({
      success: true,
      order,
      payment: data,
    });
  } catch (err) {
    console.error("Payment Order Error:", err);
    res.status(500).json({
      success: false,
      message: err.message,

    });
  }
};



export const verifyPayment = async (req, res) => {
  try {
    const { order_id, payment_id, signature } = req.body;

    console.log("===== Payment verification started =====");
    console.log("Received body:", req.body);

    if (!order_id || !payment_id || !signature) {
      console.error("Missing fields in request body");
      return res.status(400).json({
        success: false,
        message: "order_id, payment_id, and signature are required",
      });
    }

    // Signature generate karna
    const body = order_id + "|" + payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    console.log("Expected Signature:", expectedSignature);
    console.log("Received Signature:", signature);

    if (expectedSignature !== signature) {
      console.error("Signature mismatch!");
      // DB update failed
      await supabase
        .from("payments")
        .update({ status: "failed", payment_id, signature })
        .eq("order_id", order_id);

      return res.status(400).json({
        success: false,
        message: "Payment verification failed (signature mismatch)",
      });
    }

    // ✅ Signature correct hai → payments update
    const { data: paymentData, error: paymentError } = await supabase
      .from("payments")
      .update({
        status: "paid",
        payment_id,
        signature,
        updated_at: new Date(),
      })
      .eq("order_id", order_id)
      .select()
      .single();

    if (paymentError) {
      console.error("Supabase update error:", paymentError);
      throw paymentError;
    }

    // ✅ Ride status bhi update karo (pending_payment → requested)
    const { data: rideData, error: rideError } = await supabase
      .from("rides")
      .update({ status: "requested" })
      .eq("id", paymentData.ride_id) // ride_id payment table me already hai
      .select()
      .single();

    if (rideError) {
      console.error("Ride update error:", rideError);
      throw rideError;
    }

    console.log("Payment verified successfully:", paymentData);

    res.status(200).json({
      success: true,
      message: "Payment verified successfully, ride confirmed",
      payment: paymentData,
      ride: rideData,
    });
  } catch (err) {
    console.error("Payment verification error:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};



export const getPaymentStatus = async (req, res) => {
  try {
    const { ride_id } = req.params;

    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("ride_id", ride_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") throw error;
    // PGRST116 => no rows found (supabase ka code)

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "No payment found for this ride",
      });
    }

    res.json({
      success: true,
      payment: data,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};



// Cancel Ride + Refund Payment
export const cancelRide = async (req, res) => {
  try {
    const { ride_id } = req.body;

    // Ride fetch
    const { data: ride } = await supabase
      .from("rides")
      .select("id, status")
      .eq("id", ride_id)
      .single();

    if (!ride) {
      return res.status(404).json({ success: false, message: "Ride not found" });
    }

    // Payment fetch
    const { data: payment } = await supabase
      .from("payments")
      .select("*")
      .eq("ride_id", ride_id)
      .eq("status", "paid")
      .single();

    if (!payment) {
      return res.status(400).json({
        success: false,
        message: "No successful payment found for this ride",
      });
    }

    let refund = null;

    // 🚧 Development: Dummy refund object
    refund = {
      id: `refund_test_${Date.now()}`,
      status: "processed",
      amount: payment.amount * 100,
    };

    // ✅ Production: Actual refund call Razorpay pe
    /*
    refund = await razorpay.payments.refund(payment.payment_id, {
      amount: payment.amount * 100,
      speed: "normal",
    });
    */

    // DB update payments table
    await supabase
      .from("payments")
      .update({ status: "refunded", refund_id: refund.id })
      .eq("id", payment.id);

    // DB update rides table
    await supabase
      .from("rides")
      .update({ status: "cancelled" })
      .eq("id", ride_id);

    return res.json({
      success: true,
      message: "Ride cancelled and refund processed",
      refund,
    });
  } catch (err) {
    console.error("Cancel ride error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
