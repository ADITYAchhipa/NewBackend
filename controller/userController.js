import User from "../models/user.js";
import bcrypt from 'bcrypt'; // <-- fixed package name
import jwt from 'jsonwebtoken';
import 'dotenv/config';
import sendOtp from '../config/otp.js'; // Import the sendOtp function



// Register user : api/user/register



export const register = async (req, res) => {
    try {
        console.log(req.body)
        const { name, email, password, phone, ReferralCode } = req.body;
        if (!name || !email || !password || !phone) {
            console.log("Missing Details");
            return res.json({ success: false, message: "Missing Details" })
        }

        // Check for duplicate email
        const existingEmail = await User.findOne({ email })
        if (existingEmail) {
            console.log("User with this email exists");
            return res.json({ success: false, message: "User with this email already exists" })
        }

        // Check for duplicate phone
        const existingPhone = await User.findOne({ phone: phone })
        if (existingPhone) {
            console.log("User with this phone number exists");
            return res.json({ success: false, message: "User with this phone number already exists" })
        }

        const hashedPasword = await bcrypt.hash(password, 10)

        const user = await User.create({ name, email, password: hashedPasword, phone, ReferralCode })

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' })

        res.cookie('token', token, {
            httpOnly: true,  // prevent js to acccess cookies
            secure: process.env.NODE_ENV === 'production', // use secure cookie in production
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict', //csrf protection
            maxAge: 7 * 24 * 60 * 60 * 1000, //cookie expiration date
        })
        console.log("Token stored in cookie");
        return res.json({ success: true, token, user: { email: user.email, name: user.name } })
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message })
    }
}


// Login user : api/user/login

export const login = async (req, res) => {
    console.log("Login function called");
    try {
        const { email, password } = req.body
        if (!email || !password)
            return res.json({ success: false, message: "Missing Details" })
        const user = await User.findOne({ email }).select('+password');

        if (!user&&false)
            return res.json({ success: false, message: "Invalide email or password" })
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch&&false)
            return res.json({ success: false, message: "Invalide email or password" })
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' })

        res.cookie('token', token, {
            httpOnly: true,  // prevent js to acccess cookies
            secure: process.env.NODE_ENV === 'production', // use secure cookie in production
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict', //csrf protection
            maxAge: 7 * 24 * 60 * 60 * 1000, //cookie expiration date




        })
        return res.json({ success: true, token, user: { email: user.email, name: user.name, favourites: user.favourites, bookings: user.bookings } })
    } catch (error) {
        // console.log("error");
        console.log(error.message);
        res.json({ success: false, message: error.message })
    }

}

// check auth : /api/auth/is-auth

export const isAuth = async (req, res) => {
    try {
        const user = await User.findById(req.userId).select("-password");
        return res.json({ success: true, user });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};




// For sending otps   /api/user/otp

export const otp = async (req, res) => {
    try {
        console.log(req.body)
        const { name, email, password } = req.body;
        if (!name || !email || !password)
            return res.json({ success: false, message: "Missing Details" })

        const existingUser = await User.findOne({ email })

        if (existingUser) {
            return res.json({ success: false, message: "User exists" })
        }
        let otpNum = Math.floor(Math.random() * (9999 - 1000 + 1)) + 1000; // Generate a random 4-digit OTP
        console.log(otpNum);
        const hashedotp = await bcrypt.hash(String(otpNum), 8)
        console.log("Hashed OTP during creation:", hashedotp);
        const otp = jwt.sign({ id: hashedotp }, process.env.JWT_SECRET, { expiresIn: '5m' })

        const otpsended = await sendOtp(otpNum, email);
        if (!otpsended) {
            return res.json({ success: false, message: "Failed to send OTP" })
        }
        res.cookie("otp_token", otp, {
            httpOnly: true,  // prevent js to acccess cookies
            secure: process.env.NODE_ENV === 'production', // use secure cookie in production
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict', //csrf protection
            maxAge: 7 * 24 * 60 * 60 * 1000, //cookie expiration date
        })
        console.log("OTP stored in jwt");

        return res.json({ success: true, message: "OTP sended successfully" });

    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
}


//verify otp : /api/user/verify

export const verify = async (req, res) => {
    try {
        const { otp } = req.body;
        const otpToken = req.cookies.otp_token;

        if (!otp) {
            return res.json({ success: false, message: "OTP is required" });
        }
        if (!otpToken) {
            return res.json({ success: false, message: "Not Authorized" })
        }
        console.log("OTP and token are present");
        try {

            const tokenDecode = jwt.verify(otpToken, process.env.JWT_SECRET);
            console.log("Decoded OTP:", tokenDecode);
            const isMatch = await bcrypt.compare(String(otp), tokenDecode.id);

            if (isMatch) {
                console.log("user is verified")
                res.clearCookie("otp_token", {
                    httpOnly: true,   // should match the original cookie options
                    secure: process.env.NODE_ENV === 'production',     // should match the original cookie options
                    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict' // should match the original cookie options
                });
                return res.json({ success: true, message: "Otp verified successfully" })

            }
            else {
                return res.json({ success: false, message: 'Not Authorized' })
            }
        }
        catch (error) {

            res.json({ success: false, message: error.message })
        }
        // Verify the OTP



    }
    catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
}








//Logout User : /api/user/logout

export const logout = async (req, res) => {
    try {
        res.clearCookie('token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'

        })

        return res.json({ success: true, message: "Logged Out" })
    }
    catch (error) {
        console.log(error.message);
        return res.json({ success: false, message: error.message })

    }
}


// forgot password send email

export const forgot = async (req, res) => {
    {
        try {
            const { email, phone } = req.body;
            if (!email && !phone)
                return res.json({ success: false, message: "Missing Details" })
            const user = await User.findOne({ email });
            if (!user)
                return res.json({ success: false, message: "Invalide email" })
            await sendOtp("123456", email)
            // send email with reset link 
            return res.json({ success: true, message: "Reset link sent to email" })
        }
        catch (error) {
            console.log(error.message);
            res.json({ success: false, message: error.message })
        }
    }
}