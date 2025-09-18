import { supabase } from "../config/supabaseClient.js"


export const signup = async (req, res) => {
  try {
    const { name, email, phone, role, password } = req.body

    // supabase auth signup
    const { data, error } = await supabase.auth.signUp({
      email, password
    })

    if (error) throw error

    if (role === "rider") {
      const { data: userData, error: userError } = await supabase.from('users').insert([{
        id: data.user.id,
        name,
        role,
        email,
        phone
      }]).select().single()

      if (userError) throw userError

    } else {
      const { data: userData, error: userError } = await supabase.from('drivers').insert([{
        id: data.user.id,
        name,
        role,
        email,
        phone
      }]).select().single()

      if (userError) throw userError

    }



    return res.json({
      success: true,
      message: "Signup Successfull"
    })

  } catch (error) {
    return res.json({
      success: false,
      message: error.message
    })
  }
}

export const login = async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.json({
        success: false,
        message: "Email and Password are required"
      })
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email, password
    })

    if (error) throw error

    const token = data.session?.access_token;//data ke ander ek session object hota hai useke ander access_token hota hai to wha se token nikal lo


    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // deploy pe true, localhost pe false
      sameSite: "lax", // cross-origin ke liye
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    return res.status(200).json({
      message: "Login successful",
      user: data.user,
      session: data.session,  
    });

  } catch (error) {
    return res.json({
      success: false,
      message: error.message
    })
  }
}

export const getProfile = async (req, res) => {
  try {
    const userId = req.user.id; // JWT ka sub

    // Users ya drivers dono me check karo
    let { data, error } = await supabase
      .from("users")
      .select("id, email, name, role, is_active,phone,created_at")
      .eq("id", userId)
      .single();

    if (!data) {
      // Users me nahi mila, drivers table check karo
      const driverRes = await supabase
        .from("drivers")
        .select("id, email, name, role, is_active,phone,created_at")
        .eq("id", userId)
        .single();
      data = driverRes.data;
    }

    if (!data) throw new Error("User not found");
    
    res.json({ success: true, user: data });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


export const logout = async (req, res) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });

    return res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    return res.json({
      success: false,
      message: error.message,
    });
  }
};

export const sendResetPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.FRONTEND_URL}/update-password`, // frontend link yha frontend link dalna hai baad mein 
    });

    if (error) throw error;

    return res.json({
      success: true,
      message: "Reset password link sent to your email",
      link: "http://localhost:8000/api/auth/update-password"
    });
  } catch (error) {
    return res.json({
      success: false,
      message: error.message,
    });
  }
};



export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, phone, is_active, vehicle_no, vehicle_model } = req.body;

    // Users table update (sirf non-driver users ke liye)
    let { data, error } = await supabase
      .from("users")
      .update({ 
        name, 
        phone, 
        ...(is_active !== undefined && { is_active }) 
      })
      .eq("id", userId)
      .select()
      .single();

    // Agar data null hai to matlab driver hai
    if (!data) {
      const { data: driverData, error: driverError } = await supabase
        .from("drivers")
        .update({ 
          name, 
          phone, 
          ...(is_active !== undefined && { is_active }),
          ...(vehicle_no !== undefined && { vehicle_no }),
          ...(vehicle_model !== undefined && { vehicle_model })
        })
        .eq("id", userId)
        .select()
        .single();

      if (driverError) throw driverError;
      data = driverData;
    }

    if (!data) throw new Error("User not found");

    res.json({ success: true, user: data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};




