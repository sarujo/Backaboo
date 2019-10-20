import * as mongoose from "mongoose";
import VerificationToken from "./verificationToken.interface";

const tokenSchema = new mongoose.Schema({
  _userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "User"
  },
  token: { type: String, required: true },
  createdAt: { type: Date, required: true, default: Date.now, expires: 43200 }
});

const verificationTokenModel = mongoose.model<
  VerificationToken & mongoose.Document
>("VerificationToken", tokenSchema);

export default verificationTokenModel;
