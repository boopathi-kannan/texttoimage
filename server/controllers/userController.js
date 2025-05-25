import userModel from "../models/userModel.js";

import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
import Razorpay from 'razorpay'
import transactionModel from "../models/transactionModel.js";

dotenv.config()



export const registerUser=async(req,res)=>{

  try {
    const{name,email,password}=req.body; 

    if(!name || !email || !password){
      return res.json({success:false,message:'Missing Details'})
    }

    const salt=await bcrypt.genSalt(10)
    const hashedPassword=await bcrypt.hash(password,salt)

    const userData={
      name,email,password:hashedPassword
    }

    const newUser=new userModel(userData)
    const user=await newUser.save()

    const token=jwt.sign({id:user._id},process.env.JWT_SECRET)

    res.json({success:true,token,user:{name:user.name}})
    
  } catch (error) {
    res.json({success:false,message:error.message})
    
  }

}

export const loginUser=async(req,res)=>{

  try {

    const{email,password}=req.body; 
    const user=await userModel.findOne({email})

    if(!user)
    {

    res.json({success:false,message:'User does not exist'})  
    }

    const isMatch=await bcrypt.compare(password,user.password)

    if(isMatch)
    {
       const token=jwt.sign({id:user._id},process.env.JWT_SECRET)

    res.json({success:true,token,user:{name:user.name}})

    }
    else{
       return res.json({success:false,message:'Invalid password'})
    }
    
  } catch (error) {

     res.json({success:false,message:error.message})
    
  }

}

export const userCredits = async (req, res) => {
  try {
    const userId = req.userId;

    const user = await userModel.findById(userId);

    if (!user) {
      return res.json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      credits: user.creditBalance,
      user: { name: user.name },
    });

  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};


const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
})

// Payment controller
export const paymentRazorpay = async (req, res) => {
  try {
    const { planId } = req.body
    const userId = req.userId

    // Debug logs (remove in production)
    console.log("User ID:", userId)
    console.log("Plan ID:", planId)
    console.log("Razorpay Key:", process.env.RAZORPAY_KEY_ID)
    console.log("Razorpay Secret:", process.env.RAZORPAY_KEY_SECRET)

    // Validate inputs
    if (!userId || !planId) {
      return res.status(400).json({ success: false, message: 'Missing details' })
    }

    const userData = await userModel.findById(userId)
    if (!userData) {
      return res.status(404).json({ success: false, message: 'User not found' })
    }

    // Define plan details
    let plan, credits, amount
    switch (planId) {
      case 'Basic':
        plan = 'Basic'
        credits = 100
        amount = 10
        break
      case 'Advance':
        plan = 'Advance'
        credits = 500
        amount = 50
        break
      case 'Business':
        plan = 'Business'
        credits = 5000
        amount = 250
        break
      default:
        return res.status(400).json({ success: false, message: 'Plan not found' })
    }

    const date = Date.now()

    // Save transaction in DB
    const transactionData = { userId, plan, amount, credits, date }
    const newTransaction = await transactionModel.create(transactionData)

    // Razorpay order options
    const options = {
      amount: amount * 100, // in paise
      currency: process.env.CURRENCY || 'INR',
      receipt: newTransaction._id.toString(),
    }

    // Create Razorpay order
    const order = await razorpayInstance.orders.create(options)

    res.status(200).json({ success: true, order })

  } catch (error) {
    console.error("Payment error:", error)
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message })
  }
}

export const verifyRazorpay=async(req,res)=>{
  try {

    const{razorpay_order_id}=req.body 

    const orderInfo=await razorpayInstance.order.fetch(razorpay_order_id)

    if(orderInfo.status==='paid')
    {
      const transactionData=await transactionModel.findById(orderInfo.receipt)
      if(transactionData.payment){

        return res.json({success:false,message:'Payment Failed'})

      }

      const userData=await userModel.findById(transactionData.userId)

      const creditBalance=userData.creditBalance+transactionData.credits

      await userModel.findByIdAndUpdate(userData._id,{creditBalance})

      await transactionModel.findByIdAndUpdate(transactionData._id,{payment:true})

      res.json({success:true,message:"Credits Added"})

    }
    else{
      res.json({success:false,message:"payemnt Failed"})
    }

    
  } catch (error) {

    console.log(error);
    res.json({success:false,message:error.message})
    
  }
}