import mongoose from "mongoose";
import authUser from "../middleware/authUser.js";
import { updateCart } from "../controller/cartController.js";
import express from "express"

const cartRouter = express.Router();
cartRouter.post('/update',authUser,updateCart)

export default cartRouter