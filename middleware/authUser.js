import jwt from 'jsonwebtoken';
import 'dotenv/config';

const authUser = async (req,res,next)=>{
    // Support JWT from either cookie or Authorization header (Bearer)
    let token = req.cookies?.token;
    const authHeader = req.headers?.authorization || req.headers?.Authorization;
    if(!token && authHeader && authHeader.startsWith('Bearer ')){
        token = authHeader.slice(7);
    }
    if(!token){
        return res.json({success:false,message:"Not Authorized"})
    }
    try{
        const tokenDecode = jwt.verify(token,process.env.JWT_SECRET);
        if(tokenDecode.id){
            
            req.userId=tokenDecode.id;
        }
        else{
            return res.json({success:false,message:'Not Authorized'})
        }
        next()
    }
    catch(error){
        console.log("error")
     res.json({success:false,message:error.message})   
    }
}

export default authUser;