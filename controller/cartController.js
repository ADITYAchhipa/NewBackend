

import User from '../models/user.js'; // ✅ make sure this path is correct

// update user cartData : /api/cart/update

export const updateCart = async (req,res)=>{
    console.log("reached")
    try{
        const {userId,cartItems} =req.body
        await User.findByIdAndUpdate(userId,{cartItems})
        res.json({success:true,message:"cart updated"})
    }
    catch(error){
        console.log(error.message)
        res.json({success:false,message:error.message})

    }
}