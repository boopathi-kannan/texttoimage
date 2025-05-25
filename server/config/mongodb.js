import mongoose from "mongoose";

const connectDB=async()=>{
  mongoose.connection.on('connected',()=>{
    console.log("Database Connected")
    console.log(process.env.MONGODB_URL)
  })
  await mongoose.connect(`${process.env.MONGODB_URL}/imagify`)

}

export default connectDB