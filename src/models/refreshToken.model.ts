import * as mongoose from "mongoose";
import RefreshToken from "../interfaces/refreshToken.interface";

const tokenSchema = new mongoose.Schema({
  _userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "User"
  },
  token: { type: String, required: true },
  createdAt: { type: Date, required: true, default: Date.now, expires: 180 }
});

const refreshTokenModel = mongoose.model<RefreshToken & mongoose.Document>(
  "RefreshToken",
  tokenSchema
);

export default refreshTokenModel;
