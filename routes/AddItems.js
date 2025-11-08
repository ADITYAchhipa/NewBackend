import express from 'express';
import { upload } from '../config/multer.js';
import authSeller from '../middleware/authSeller.js';
import { addProperty ,addVechile } from '../controller/productController.js';


const productRouter = express.Router();


productRouter.post('/Vechile/add',upload.array(["images"]),authSeller,addVechile);
productRouter.post('/Property/add',upload.array(["images"]),authSeller,addProperty );

export default productRouter
