import * as bcrypt from "bcrypt";
import UserWithThatEmailAlreadyExistsException from "../exceptions/UserWithThatEmailAlreadyExistsException";
import CreateUserDto from "../dto/user.dto";
import userModel from "../models/user.model";
import TokenData from "../interfaces/tokenData.interface";
import SimpleCrypto from "simple-crypto-js/build/SimpleCrypto";
import LogInDto from "../dto/logIn.dto";
import * as uuid from "uuid/v4";
import UnverifiedEmailException from "../exceptions/UnverifiedEmailException";
import WrongCredentialsException from "../exceptions/WrongCredentialsException";
import refreshTokenModel from "../models/refreshToken.model";
import User from "../interfaces/user.interface";
import DataStoredInToken from "../interfaces/dataStoredInToken";
import * as jwt from "jsonwebtoken";

class AuthenticationService {
  public user = userModel;
  private refreshToken = refreshTokenModel;

  public async register(userData: CreateUserDto) {
    if (await this.user.findOne({ email: userData.email })) {
      throw new UserWithThatEmailAlreadyExistsException(userData.email);
    }
    const _secretKey = process.env.SECRET_PSW_KEY;
    const simpleCrypto = new SimpleCrypto(_secretKey);
    const decryptedPassword = simpleCrypto.decrypt(userData.password);

    const hashedPassword = await bcrypt.hash(decryptedPassword, 10);
    const user = await this.user.create({
      ...userData,
      password: hashedPassword
    });

    user.password = undefined;
    return user;
  }

  public async login(loginData: LogInDto) {
    const user = await this.user.findOne({ email: loginData.email });

    const _secretKey = process.env.SECRET_PSW_KEY;
    const simpleCrypto = new SimpleCrypto(_secretKey);
    const decryptedPassword = simpleCrypto.decrypt(loginData.password);

    if (user) {
      const isPasswordMatching = await bcrypt.compare(
        decryptedPassword,
        user.password
      );
      if (isPasswordMatching) {
        if (user.isVerified) {
          user.password = undefined;
          return user;
        } else {
          throw new UnverifiedEmailException();
        }
      } else {
        throw new WrongCredentialsException();
      }
    } else {
      throw new WrongCredentialsException();
    }
  }

  public async generateTokenData(user: User) {
    const tokenData = this.createToken(user);
    return this.createCookie(tokenData);
  }

  public async generateRefreshToken(user: User) {
    const refreshTokenData = uuid();
    const refreshToken = await this.refreshToken.create({
      _userId: user._id,
      token: refreshTokenData
    });

    await refreshToken.save();
    return refreshTokenData;
  }

  public createCookie(tokenData: TokenData) {
    return `Authorization=${tokenData.token}; HttpOnly; Max-Age=${tokenData.expiresIn}`;
  }

  public createToken(user: User): TokenData {
    const expiresIn = 60; // 1 minute
    const secret = process.env.JWT_SECRET;
    const dataStoredInToken: DataStoredInToken = {
      _id: user._id
    };
    return {
      token: jwt.sign(dataStoredInToken, secret, { expiresIn }),
      expiresIn
    };
  }
}

export default AuthenticationService;
