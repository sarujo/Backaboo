import * as express from "express";
import { validationResult } from "express-validator";

export const validateRequest = (validations: any) => {
  return async (
    request: express.Request,
    response: express.Response,
    next: express.NextFunction
  ) => {
    await Promise.all(
      validations.map((validation: any) => validation.run(request))
    );

    const errors = validationResult(request);
    if (errors.isEmpty()) {
      return next();
    }

    response.status(422).json({ errors: errors.array() });
  };
};
