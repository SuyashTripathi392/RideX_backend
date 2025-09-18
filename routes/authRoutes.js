import express from "express";
import { signup,login, getProfile, logout, sendResetPassword, updateProfile  } from "../controllers/authController.js";
import { verifyToken } from "../middleware/verifyToken.js";


const authRoutes = express.Router();

authRoutes.post("/signup", signup);
authRoutes.post("/login", login);
authRoutes.get("/me",verifyToken, getProfile);
authRoutes.post("/profile",verifyToken,  updateProfile);
authRoutes.post("/logout", logout);
authRoutes.post("/reset-password", sendResetPassword);



export default authRoutes;
