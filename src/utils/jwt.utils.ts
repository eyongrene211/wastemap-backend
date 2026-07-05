import jwt             from "jsonwebtoken";
import { SignOptions } from "jsonwebtoken";
import { env }         from "../config/env";

export const generateTokens = (userId: string, role: string) => {
  const payload = { userId, role };

  const accessOptions: SignOptions = {
    expiresIn: env.JWT_ACCESS_EXPIRY as SignOptions["expiresIn"],
  };

  const refreshOptions: SignOptions = {
    expiresIn: env.JWT_REFRESH_EXPIRY as SignOptions["expiresIn"],
  };

  const accessToken = jwt.sign(
    payload,
    env.JWT_ACCESS_SECRET as string,
    accessOptions
  );

  const refreshToken = jwt.sign(
    payload,
    env.JWT_REFRESH_SECRET as string,
    refreshOptions
  );

  return { accessToken, refreshToken };
};

export const verifyAccessToken = (token: string) => {
  return jwt.verify(token, env.JWT_ACCESS_SECRET as string);
};

export const verifyRefreshToken = (token: string) => {
  return jwt.verify(token, env.JWT_REFRESH_SECRET as string);
};