import * as bodyParser from "body-parser";
import * as cookieParser from "cookie-parser";
import * as express from "express";
import * as mongoose from "mongoose";
import Controller from "./interfaces/controller.interface";
import errorMiddleware from "./middleware/error.middleware";
import * as cors from "cors";
import * as graphqlHTTP from "express-graphql";
import { makeExecutableSchema } from "graphql-tools";
import getAllUsers from "./services/users.service";

class App {
  public app: express.Application;

  constructor(controllers: Controller[]) {
    this.app = express();

    let typeDefs: any = [
      `
  type Query {
    hello: String
    users: [User]
  }
  
  type User {
    isVerified: Boolean
    _id: String
    name: String
    password: String
    email: String
  }
     
  type Mutation {
    hello(message: String) : String
  }
`
    ];

    let helloMessage: String = "World!";

    let resolvers = {
      Query: {
        hello: () => helloMessage,
        users: () => getAllUsers()
      },
      Mutation: {
        hello: (_: any, helloData: any) => {
          helloMessage = helloData.message;
          return helloMessage;
        }
      }
    };
    this.app.use(cors());
    this.app.use(
      "/graphql",
      graphqlHTTP({
        schema: makeExecutableSchema({ typeDefs, resolvers }),
        graphiql: true
      })
    );

    this.connectToTheDatabase();
    this.initializeMiddlewares();
    this.initializeControllers(controllers);
    this.initializeErrorHandling();
  }

  public listen() {
    this.app.listen(process.env.PORT, () => {
      console.log(`App listening on the port ${process.env.PORT}`);
    });
  }

  public getServer() {
    return this.app;
  }

  private initializeMiddlewares() {
    this.app.use(bodyParser.json());
    this.app.use(cookieParser());
    this.app.use(cors());
  }

  private initializeErrorHandling() {
    this.app.use(errorMiddleware);
  }

  private initializeControllers(controllers: Controller[]) {
    controllers.forEach(controller => {
      this.app.use("/", controller.router);
    });
  }

  private connectToTheDatabase() {
    const { MONGO_USER, MONGO_PASSWORD, MONGO_PATH } = process.env;
    mongoose.connect("mongodb://localhost:27017/myapp", {
      useNewUrlParser: true,
      useCreateIndex: true,
      useFindAndModify: false
    });
  }
}

export default App;
