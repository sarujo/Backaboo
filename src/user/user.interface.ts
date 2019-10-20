interface User {
  _id: string;
  name: string;
  email: string;
  password: string;
  isVerified: boolean;
  address?: {
    street: string,
    city: string,
  };
}

export default User;
