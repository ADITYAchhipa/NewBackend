import {v2 as cloudinary} from 'cloudinary';    
import Property from '../models/property.js';
import Vehicle from '../models/vehicle.js';
//ad product : /api/product/add

export const addProperty = async (req,res)=>{
    try{
        let productData= JSON.parse(req.body.productData);

        const images = req.files;

        let imagesUrl = await Promise.all(
            images.map(async (image) => {
                let result=await cloudinary.uploader.upload(image.path, {
                    resource_type:'image',
                })
                return result.secure_url;
            })
        );
        await Property.create({...productData,images:imagesUrl});
        res.json({success:true,message:"Product Added Successfully"});
    }catch(error){
        res.json({success:false,message: error.message});
    }
}


export const addVechile = async (req,res)=>{
    try{
        let productData= JSON.parse(req.body.productData);

        const images = req.files;

        let imagesUrl = await Promise.all(
            images.map(async (image) => {
                let result=await cloudinary.uploader.upload(image.path, {
                    resource_type:'image',
                })
                return result.secure_url;
            })
        );
        await  Vehicle.create({...productData,photos:imagesUrl});
        res.json({success:true,message:"Product Added Successfully"});
    }catch(error){
        res.json({success:false,message: error.message});
    }
}

