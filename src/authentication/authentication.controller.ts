import * as bcrypt from "bcrypt";
import * as express from "express";
import * as jwt from "jsonwebtoken";
import WrongCredentialsException from "../exceptions/WrongCredentialsException";
import Controller from "../interfaces/controller.interface";
import DataStoredInToken from "../interfaces/dataStoredInToken";
import TokenData from "../interfaces/tokenData.interface";
import validationMiddleware from "../middleware/validation.middleware";
import CreateUserDto from "../user/user.dto";
import User from "../user/user.interface";
import userModel from "./../user/user.model";
import AuthenticationService from "./authentication.service";
import LogInDto from "./logIn.dto";
import UnverifiedEmailException from "../exceptions/UnverifiedEmailException";
import * as crypto from "crypto";
import * as nodemailer from "nodemailer";
import verificationTokenModel from "../verificationToken/verificationToken.model";
import {
  emailValidation,
  loginValidation,
  registrationValidation
} from "../validations/authentication.validations";
import { validateRequest } from "../middleware/requestValidator.middleware";

class AuthenticationController implements Controller {
  public path = "/auth";
  public router = express.Router();
  public authenticationService = new AuthenticationService();
  private user = userModel;
  private verificationToken = verificationTokenModel;

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // List all registered users. Test route (no auth middleware)
    this.router.get("/usersRegistered", async (request, response) => {
      const users = await this.user.find();
      response.send(users);
    });

    // Verify user and enable login
    this.router.get(
      `${this.path}/confirmation/:verifyUser`,
      this.confirmingEmail
    );

    // Send verification token in case initial one expired
    this.router.post(
      `${this.path}/resendVerificationToken`,
      validateRequest(emailValidation),
      this.resendingVerificationToken
    );

    // Register a new user
    this.router.post(
      `${this.path}/register`,
      validateRequest(registrationValidation),
      validationMiddleware(CreateUserDto),
      this.registration
    );

    // Login an existing user
    this.router.post(
      `${this.path}/login`,
      validateRequest(loginValidation),
      validationMiddleware(LogInDto),
      this.loggingIn
    );

    // Logout user
    this.router.post(`${this.path}/logout`, this.loggingOut);
  }

  private registration = async (
    request: express.Request,
    response: express.Response,
    next: express.NextFunction
  ) => {
    const userData: CreateUserDto = request.body;
    try {
      const { user } = await this.authenticationService.register(userData);

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
    } catch (error) {
      next(error);
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

    const verificationToken = await this.verificationToken.create({
      _userId: user._id,
      token: crypto.randomBytes(16).toString("hex")
    });

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
        response
          .status(200)
          .send("A verification email has been sent to " + user.email + ".");
      });
    });
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
          response.setHeader("Set-Cookie", [
            AuthenticationController.createCookie(tokenData)
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
    const expiresIn = 60 * 60; // an hour
    const secret = process.env.JWT_SECRET;
    const dataStoredInToken: DataStoredInToken = {
      _id: user._id
    };
    return {
      expiresIn,
      token: jwt.sign(dataStoredInToken, secret, { expiresIn })
    };
  }
}

export default AuthenticationController;
