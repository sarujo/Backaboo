import * as express from "express";
import Controller from "../interfaces/controller.interface";
import userModel from "../models/user.model";
import UsersService from "../services/users.service";

class UserController implements Controller {
  public path = "/users";
  public router = express.Router();
  private user = userModel;
  static userService = new UsersService();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // List all registered users. Test route (no auth middleware)
    this.router.get(
      "/usersRegistered",
      // authMiddleware,
      UserController.getUsers
    );
  }

  public static getUsers = async (
    request: express.Request,
    response: express.Response
  ) => {
    console.log('hit getUsers');
    const users = await UserController.userService.getAllUsers();
    response.send(users);
  };
}

export default UserController;
