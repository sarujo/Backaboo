import HttpException from './HttpException';

class UnverifiedEmailException extends HttpException {
  constructor() {
    super(401, 'Account has not been verified yet!');
  }
}

export default UnverifiedEmailException;
