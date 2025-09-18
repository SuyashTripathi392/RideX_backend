import express from "express";
import { createPaymentOrder, verifyPayment, getPaymentStatus, cancelRide } from "../controllers/paymentController.js";
import { verifyToken } from "../middleware/verifyToken.js";  // auth ke liye

const paymentRoutes = express.Router();

// 1. Order create karna (auth required)
paymentRoutes.post("/create-order", verifyToken, createPaymentOrder);

// 2. Payment verify karna (auth required)
paymentRoutes.post("/verify", verifyToken, verifyPayment);

// 3. Payment status dekhna (auth required)
paymentRoutes.get("/status/:ride_id", verifyToken, getPaymentStatus);

// 4. Cancel Ride + Refund Payment (auth required)
paymentRoutes.post("/cancel", verifyToken, cancelRide);


export default paymentRoutes;
