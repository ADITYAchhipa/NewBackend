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

        const user = await User.create({ name, email, password: hashedPasword, phone, ReferralCode: referralCode })

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' })

        res.cookie('token', token, {
            httpOnly: true,  // prevent js to acccess cookies
            secure: process.env.NODE_ENV === 'production', // use secure cookie in production
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict', //csrf protection
            maxAge: 7 * 24 * 60 * 60 * 1000, //cookie expiration date
        })
        console.log("Token stored in cookie");
        return res.json({ success: true, token, user: { email: user.email, name: user.name, phone: user.phone, country: user.Country } })
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message })
    }
}

export const updatecountry = async (req, res) => {
    try {
        const { country } = req.body
        const user = await User.findById(req.userId)
        if (!user)
            return res.json({ success: false, message: "User not found" })
        user.Country = country
        await user.save()
        return res.json({ success: true, user })
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
        console.log("Login function called");
        const user = await User.findOne({ email }).select('+password');
        if (!user)
            return res.json({ success: false, message: "Invalid email or password" })
        console.log(password+" "+user.password+" "+(await bcrypt.compare(password, user.password)));
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch && false)
            return res.json({ success: false, message: "Invalid email or password" })
        console.log("Login function called");
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' })

        res.cookie('token', token, {
            httpOnly: true,  // prevent js to acccess cookies
            secure: process.env.NODE_ENV === 'production', // use secure cookie in production
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict', //csrf protection
            maxAge: 7 * 24 * 60 * 60 * 1000, //cookie expiration date
        })
        return res.json({ success: true, token, user: { email: user.email, name: user.name, phone: user.phone, favourites: user.favourites, bookings: user.bookings, country: user.Country } })
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

export const changePasswordProfile = async (req, res) => {
    console.log("inside change password")
    try {
        const { password } = req.body;
        if (!password) {
            return res.json({ success: false, message: "Missing Details" })
        }
        const user = await User.findById(req.userId);
        if (!user) {
            return res.json({ success: false, message: "User not found" })
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        user.password = hashedPassword;
        await user.save();
        console.log(" password changed")
        return res.json({ success: true, message: "Password changed successfully" })
    } catch (error) {
        console.log(error.message);
        return res.json({ success: false, message: error.message })
    }
}


// forgot password send email

export const forgot = async (req, res) => {
    try {
        const { email, phone } = req.body;
        if (!email && !phone)
            return res.json({ success: false, message: "Missing Details" })
        const user = await User.findOne({ email });
        if (!user)
            return res.json({ success: false, message: "Invalid email" })
        // Generate a random 6-digit OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000);
        const hashedOtp = await bcrypt.hash(String(otpCode), 10);
        // Create a short-lived reset token embedding user id and hashed OTP
        const resetToken = jwt.sign(
            { id: user._id, otp: hashedOtp },
            process.env.JWT_SECRET,
            { expiresIn: '10m' }
        );
        await sendOtp(otpCode, email)
        // send email with reset link 
        return res.json({ success: true, message: "Reset code sent to email", resetToken })
    }
    catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message })
    }
}

export const resetPasswordN = async (req, res) => {
    try {
        const { email, otp, newPassword, resetToken } = req.body;
        if (!email || !otp || !newPassword || !resetToken) {
            return res.json({ success: false, message: "Missing Details" });
        }

        let decoded;
        try {
            decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
        } catch (error) {
            return res.json({ success: false, message: "Reset token is invalid or expired" });
        }

        const user = await User.findById(decoded.id).select('+password');
        if (!user || user.email !== email) {
            return res.json({ success: false, message: "Invalid email" });
        }

        const isMatch = await bcrypt.compare(String(otp), decoded.otp);
        if (!isMatch) {
            return res.json({ success: false, message: "Invalid OTP" });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        return res.json({ success: true, message: "Password reset successful" });
    } catch (error) {
        console.log(error.message);
        return res.json({ success: false, message: error.message });
    }
}

export const resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword, resetToken } = req.body;
        if (!email || !otp || !newPassword || !resetToken) {
            return res.json({ success: false, message: "Missing Details" });
        }

        let decoded;
        try {
            decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
        } catch (error) {
            return res.json({ success: false, message: "Reset token is invalid or expired" });
        }

        const user = await User.findById(decoded.id).select('+password');
        if (!user || user.email !== email) {
            return res.json({ success: false, message: "Invalid email" });
        }

        const isMatch = await bcrypt.compare(String(otp), decoded.otp);
        if (!isMatch) {
            return res.json({ success: false, message: "Invalid OTP" });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        return res.json({ success: true, message: "Password reset successful" });
    } catch (error) {
        console.log(error.message);
        return res.json({ success: false, message: error.message });
    }
}
// Update user country : /api/user/updatecountry
export const updateCountry = async (req, res) => {
    try {
        const { country } = req.body;
        if (!country) {
            return res.json({ success: false, message: "Country is required" });
        }

        const user = await User.findById(req.userId);
        if (!user) {
            return res.json({ success: false, message: "User not found" });
        }

        user.Country = country;
        await user.save();

        console.log('Country updated to ' + country + ' for user ' + user.email);
        return res.json({
            success: true,
            message: "Country updated successfully",
            user: {
                email: user.email,
                name: user.name,
                phone: user.phone,
                country: user.Country
            }
        });
    } catch (error) {
        console.log(error.message);
        return res.json({ success: false, message: error.message });
    }
}

// Update user banner : /api/user/updateBanner
export const updateBanner = async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) {
            return res.json({ success: false, message: "User not found" });
        }

        // Check if file is uploaded
        if (!req.file) {
            return res.json({ success: false, message: "Banner image is required" });
        }

        // Upload to Cloudinary
        const { v2: cloudinary } = await import('cloudinary');
        const uploadResult = await cloudinary.uploader.upload(req.file.path, {
            folder: 'user_banners',
            resource_type: 'image'
        });

        // Update user banner URL
        user.banner = uploadResult.secure_url;
        await user.save();

        console.log('Banner updated for user ' + user.email);
        return res.json({
            success: true,
            message: "Banner updated successfully",
            user: {
                email: user.email,
                name: user.name,
                phone: user.phone,
                banner: user.banner,
                avatar: user.avatar
            }
        });
    } catch (error) {
        console.log(error.message);
        return res.json({ success: false, message: error.message });
    }
}

// Update user profile image : /api/user/updateProfileImage
export const updateProfileImage = async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) {
            return res.json({ success: false, message: "User not found" });
        }

        // Check if file is uploaded
        if (!req.file) {
            return res.json({ success: false, message: "Profile image is required" });
        }

        // Upload to Cloudinary
        const { v2: cloudinary } = await import('cloudinary');
        const uploadResult = await cloudinary.uploader.upload(req.file.path, {
            folder: 'user_profiles',
            resource_type: 'image'
        });

        // Update user avatar URL
        user.avatar = uploadResult.secure_url;
        await user.save();

        console.log('Profile image updated for user ' + user.email);
        return res.json({
            success: true,
            message: "Profile image updated successfully",
            user: {
                email: user.email,
                name: user.name,
                phone: user.phone,
                avatar: user.avatar,
                banner: user.banner
            }
        });
    } catch (error) {
        console.log(error.message);
        return res.json({ success: false, message: error.message });
    }
}

// Update user details : /api/user/updateDetails
export const updateDetails = async (req, res) => {
    try {
        const { name, email, phone, bio } = req.body;

        // Check if all details are provided
        if (!name || !email || !phone || bio === undefined) {
            return res.json({ success: false, message: "All details (name, email, phone, bio) are required" });
        }

        const user = await User.findById(req.userId);
        if (!user) {
            return res.json({ success: false, message: "User not found" });
        }

        // Check if all details are the same
        const isNameSame = user.name === name;
        const isEmailSame = user.email === email;
        const isPhoneSame = user.phone === phone;
        const isBioSame = user.bio === bio;

        if (isNameSame && isEmailSame && isPhoneSame && isBioSame) {
            return res.json({ success: true, message: "No changes detected" });
        }

        // Check if email is being changed and if it's already taken by another user
        if (!isEmailSame) {
            const existingUser = await User.findOne({ email, _id: { $ne: req.userId } });
            if (existingUser) {
                return res.json({ success: false, message: "Email is already in use by another user" });
            }
        }

        // Check if phone is being changed and if it's already taken by another user
        if (!isPhoneSame) {
            const existingUser = await User.findOne({ phone, _id: { $ne: req.userId } });
            if (existingUser) {
                return res.json({ success: false, message: "Phone number is already in use by another user" });
            }
        }

        // Update user details
        user.name = name;
        user.email = email;
        user.phone = phone;
        user.bio = bio;
        await user.save();

        console.log('Details updated for user ' + user.email);
        return res.json({
            success: true,
            message: "Details updated successfully",
            user: {
                email: user.email,
                name: user.name,
                phone: user.phone,
                bio: user.bio,
                avatar: user.avatar,
                banner: user.banner
            }
        });
    } catch (error) {
        console.log(error.message);
        return res.json({ success: false, message: error.message });
    }
}
