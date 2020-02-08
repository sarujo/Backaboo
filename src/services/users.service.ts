import userModel from "../models/user.model";

const user = userModel;

export default function getAllUsers() {
  console.log("hit getAllUsers");
  return user.find();
}
