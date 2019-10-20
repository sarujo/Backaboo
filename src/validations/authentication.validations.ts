import { check } from "express-validator";

export const emailValidation = [
  check("email")
    .isEmail()
    .withMessage("Email must be valid!")
];

export const registrationValidation = [
  check("email")
    .isEmail()
    .withMessage("Email must be valid!"),
  check("name")
    .isLength({ min: 3 })
    .withMessage("Name length has to be at least 3 characters!"),
  check("password")
    .isLength({ min: 8 })
    .withMessage("Password length has to be at least 8 characters!")
];

export const loginValidation = [
  check("password")
    .not()
    .isEmpty()
    .withMessage("Password is not provided!")
];
