import express from 'express'
import { register,login, isAuth, logout,otp,verify,forgot } from '../controller/userController.js';
import authUser from '../middleware/authUser.js';

const userRouter = express.Router();
console.log("User Routes Loaded");
userRouter.post('/register', register);  //tested
userRouter.post('/ForgotPassword',forgot); //tested
userRouter.post('/forgot', forgot); // alias for lowercase route
userRouter.post('/login', login); //tested

userRouter.post('/otp', otp );
userRouter.post('/verify', verify );
userRouter.post('/logout', logout);
userRouter.get('/is-auth',authUser,isAuth); //
// userRouter.get('/next',authUser, logout);


export default userRouter;