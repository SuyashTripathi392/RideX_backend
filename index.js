import express from "express";
import cors from "cors";
import 'dotenv/config';
import cookieParser from "cookie-parser";
import authRoutes from "./routes/authRoutes.js";
import rideRoutes from "./routes/rideRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";



const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: "http://localhost:5173", // frontend URL
  credentials: true // <- must for cookies
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// test route
app.get("/", (req, res) => {
  res.send("RideX Backend Running ✅");
});

app.use('/api/auth',authRoutes)
app.use('/api/ride',rideRoutes)
app.use('/api/payment',paymentRoutes)

app.listen(PORT, () => {
  console.log(`Server running on port http://localhost:${PORT}`);
});
