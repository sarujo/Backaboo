interface VerificationToken {
  _id: string;
  _userId: string;
  token: string;
  createdAt: Date;
}

export default VerificationToken;
