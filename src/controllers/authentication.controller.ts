import * as bcrypt from "bcrypt";
import * as express from "express";
import * as jwt from "jsonwebtoken";
import WrongCredentialsException from "../exceptions/WrongCredentialsException";
import Controller from "../interfaces/controller.interface";
import DataStoredInToken from "../interfaces/dataStoredInToken";
import TokenData from "../interfaces/tokenData.interface";
import validationMiddleware from "../middleware/validation.middleware";
import CreateUserDto from "../dto/user.dto";
import User from "../interfaces/user.interface";
import userModel from "../models/user.model";
import AuthenticationService from "../services/authentication.service";
import LogInDto from "../dto/logIn.dto";
import UnverifiedEmailException from "../exceptions/UnverifiedEmailException";
import * as crypto from "crypto";
import * as nodemailer from "nodemailer";
import verificationTokenModel from "../models/verificationToken.model";
import {
  emailValidation,
  loginValidation,
  registrationValidation
} from "../validations/authentication.validations";
import { validateRequest } from "../middleware/requestValidator.middleware";
import * as uuid from "uuid/v4";
import refreshTokenModel from "../models/refreshToken.model";

class AuthenticationController implements Controller {
  public path = "/auth";
  public router = express.Router();
  public authenticationService = new AuthenticationService();
  private user = userModel;
  private verificationToken = verificationTokenModel;
  private refreshToken = refreshTokenModel;

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // Register a new user
    this.router.post(
      `${this.path}/register`,
      validateRequest(registrationValidation),
      validationMiddleware(CreateUserDto),
      this.registration
    );

    // Verify user and enable login
    this.router.get(
      `${this.path}/confirmation/:verificationToken`,
      this.confirmingEmail
    );

    // Send verification token in case initial one expired
    this.router.post(
      `${this.path}/resendVerificationToken`,
      validateRequest(emailValidation),
      this.resendingVerificationToken
    );

    // Login an existing user
    this.router.post(
      `${this.path}/login`,
      validateRequest(loginValidation),
      validationMiddleware(LogInDto),
      this.loggingIn
    );

    // Refresh Tokens
    this.router.post(`${this.path}/refreshToken`, this.refreshingTokens);

    // Logout user
    this.router.post(`${this.path}/logout`, this.loggingOut);
  }

  private registration = async (
    // FIX REGISTRATION USER PASSING TO generatingAndSendingToken f()
    request: express.Request,
    response: express.Response,
    next: express.NextFunction
  ) => {
    const userData: CreateUserDto = request.body;
    let user: User;
    try {
      user = await this.authenticationService.register(userData);
    } catch (error) {
      next(error);
    }
    this.generatingAndSendingToken(user, request, response);
  };

  private refreshingTokens = async (
    request: express.Request,
    response: express.Response
  ) => {
    const requestBody = request.body;
    const refreshToken = requestBody.refreshToken;

    const refreshTokenFound = await this.refreshToken.findOne({
      token: refreshToken
    });

    if (!refreshTokenFound)
      return response.status(400).send({
        type: "not-verified",
        msg:
          "We were unable to find a valid refresh token. Your refresh token my have expired."
      });

    const user = await this.user.findOne({ _id: refreshTokenFound._userId });
    if (!user)
      return response
        .status(400)
        .send({ msg: "We were unable to find a user for this refresh token." });

    const refreshTokenData = uuid();

    const refreshTokenUpdated = await this.refreshToken.findByIdAndUpdate(
      refreshTokenFound._id,
      {
        token: refreshTokenData
      },
      { new: true }
    );

    if (refreshTokenUpdated) {
      const tokenData = AuthenticationController.createToken(user);
      response.setHeader("Set-Cookie", [
        AuthenticationController.createCookie(tokenData),
        `RefreshToken=${refreshTokenData}; HttpOnly`
      ]);
      response.status(200).send("The refresh token has been updated!");
    } else {
      response.status(500).send({ msg: "Failed to update tokens!" });
    }
  };

  private confirmingEmail = async (
    request: express.Request,
    response: express.Response
  ) => {
    const verificationToken = request.params.verificationToken;
    const tokenFound = await this.verificationToken.findOne({
      token: verificationToken
    });
    if (!tokenFound)
      return response.status(400).send({
        type: "not-verified",
        msg: "We were unable to find a valid token. Your token my have expired."
      });

    const user = await this.user.findOne({ _id: tokenFound._userId });
    if (!user)
      return response
        .status(400)
        .send({ msg: "We were unable to find a user for this token." });
    if (user.isVerified)
      return response.status(400).send({
        type: "already-verified",
        msg: "This user has already been verified."
      });

    const userUpdated = await this.user.findByIdAndUpdate(
      tokenFound._userId,
      {
        isVerified: true
      },
      { new: true }
    );

    if (userUpdated) {
      response
        .status(200)
        .send("The account has been verified. Please log in.");
    } else {
      response.status(500).send({ msg: "Failed to update user as verified." });
    }
  };

  private resendingVerificationToken = async (
    request: express.Request,
    response: express.Response
  ) => {
    const user = await this.user.findOne({ email: request.body.email });
    if (!user) {
      return response
        .status(400)
        .send({ msg: "We were unable to find a user with that email." });
    }
    if (user.isVerified)
      return response.status(400).send({
        msg: "This account has already been verified. Please log in."
      });
    this.generatingAndSendingToken(user, request, response);
  };

  private loggingIn = async (
    request: express.Request,
    response: express.Response,
    next: express.NextFunction
  ) => {
    const logInData: LogInDto = request.body;
    const user = await this.user.findOne({ email: logInData.email });
    if (user) {
      const isPasswordMatching = await bcrypt.compare(
        logInData.password,
        user.password
      );
      if (isPasswordMatching) {
        if (user.isVerified) {
          user.password = undefined;
          const tokenData = AuthenticationController.createToken(user);
          const refreshTokenData = uuid();

          // SAVE REFRESH TOKEN
          const refreshToken = await this.refreshToken.create({
            _userId: user._id,
            token: refreshTokenData
          });

          await refreshToken.save();

          response.setHeader("Set-Cookie", [
            AuthenticationController.createCookie(tokenData),
            `RefreshToken=${refreshTokenData}; HttpOnly`
          ]);
          response.send(user);
        } else {
          next(new UnverifiedEmailException());
        }
      } else {
        next(new WrongCredentialsException());
      }
    } else {
      next(new WrongCredentialsException());
    }
  };

  private loggingOut = (
    request: express.Request,
    response: express.Response
  ) => {
    response.setHeader("Set-Cookie", ["Authorization=;Max-age=0"]);
    response.send(200);
  };

  private static createCookie(tokenData: TokenData) {
    return `Authorization=${tokenData.token}; HttpOnly; Max-Age=${tokenData.expiresIn}`;
  }

  private static createToken(user: User): TokenData {
    const expiresIn = 60; // 1 minute
    const secret = process.env.JWT_SECRET;
    const dataStoredInToken: DataStoredInToken = {
      _id: user._id
    };
    return {
      expiresIn,
      token: jwt.sign(dataStoredInToken, secret, { expiresIn })
    };
  }

  private generatingAndSendingToken = async (
    user: User,
    request: express.Request,
    response: express.Response
  ) => {
    const verificationToken = await this.verificationToken.create({
      _userId: user._id,
      token: crypto.randomBytes(16).toString("hex")
    });

    // Save the verification token
    await verificationToken.save(function(err) {
      if (err) {
        return response.status(500).send({ msg: err.message });
      }

      // Send the email
      const transporter = nodemailer.createTransport({
        service: "Sendgrid",
        auth: {
          user: process.env.SENDGRID_USERNAME,
          pass: process.env.SENDGRID_PASSWORD
        }
      });
      const mailOptions = {
        from: "no-reply@mockaboo.com",
        to: user.email,
        subject: "Account Verification Token",
        text:
          "Hello,\n\n" +
          "Please verify your account by clicking the link: \nhttp://" +
          "localhost:5000/auth" +
          "/confirmation/" +
          verificationToken.token +
          ".\n"
      };
      transporter.sendMail(mailOptions, function(err) {
        if (err) {
          return response.status(500).send({ msg: err.message });
        }
        response.status(200).send({
          userRegistered: user,
          message: "A verification email has been sent to " + user.email + "."
        });
      });
    });
  };
}

export default AuthenticationController;
