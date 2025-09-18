import { supabase } from "../config/supabaseClient.js";

export const verifyToken = async (req, res, next) => {
    try {
        const token = req.cookies.token;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Token not provided"
            });
        }

        // ✅ Supabase se user verify karo
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error) {
            console.log("Token verification error:", error);
            return res.status(401).json({
                success: false,
                message: "Invalid token"
            });
        }

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User not found"
            });
        }

        console.log("Authenticated user:", user);
        req.user = user;
        next();

    } catch (error) {
        console.error("Auth middleware error:", error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};