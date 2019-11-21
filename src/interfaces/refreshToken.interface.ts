interface RefreshToken {
  _id: string;
  _userId: string;
  token: string;
  createdAt: Date;
}

export default RefreshToken;
