import * as express from "express";
import NotAuthorizedException from "../exceptions/NotAuthorizedException";
import Controller from "../interfaces/controller.interface";
import RequestWithUser from "../interfaces/requestWithUser.interface";
import authMiddleware from "../middleware/auth.middleware";
import userModel from "../models/user.model";

class UserController implements Controller {
  public path = "/users";
  public router = express.Router();
  private user = userModel;

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // List all registered users. Test route (no auth middleware)
    this.router.get(
      "/usersRegistered",
      authMiddleware,
      async (request, response) => {
        const users = await this.user.find();
        response.send(users);
      }
    );
  }
}

export default UserController;
