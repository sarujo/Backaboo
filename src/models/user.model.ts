import * as mongoose from "mongoose";
import User from "../interfaces/user.interface";

const addressSchema = new mongoose.Schema({
  city: String,
  country: String,
  street: String
});

const userSchema = new mongoose.Schema({
  address: addressSchema,
  email: String,
  name: String,
  password: String,
  isVerified: { type: Boolean, default: false }
});

const userModel = mongoose.model<User & mongoose.Document>("User", userSchema);

export default userModel;
