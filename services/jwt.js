import express from 'express';
import jwt from 'jsonwebtoken';
import 'dotenv/config';

export const SetJWT= async(email)=>{

    try{
         const token=jwt.sign({email},process.env.JWT_SECRET,{expiresIn:'7d'})
         return token;

    }
    catch(error){
        console.log(error.message);
        throw new Error('Token generation failed');
    }
}
