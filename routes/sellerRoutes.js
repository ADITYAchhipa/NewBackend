import express from 'express';
import { sellerLogin, sellerLogout, isSellerAuth } from '../controller/sellerController.js';
import authSeller from '../middleware/authSeller.js';

const sellerRouter = express.Router();

sellerRouter.post('/login',sellerLogin)
sellerRouter.get('/is-auth',authSeller,isSellerAuth)
sellerRouter.get('/logout',authSeller,sellerLogout)


export default sellerRouter;