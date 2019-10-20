import * as bcrypt from "bcrypt";
import UserWithThatEmailAlreadyExistsException from "../exceptions/UserWithThatEmailAlreadyExistsException";
import CreateUserDto from "../user/user.dto";
import userModel from "./../user/user.model";

class AuthenticationService {
  public user = userModel;

  public async register(userData: CreateUserDto) {
    if (await this.user.findOne({ email: userData.email })) {
      throw new UserWithThatEmailAlreadyExistsException(userData.email);
    }
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const user = await this.user.create({
      ...userData,
      password: hashedPassword
    });

    user.password = undefined;
    return {
      user
    };
  }
}

export default AuthenticationService;
