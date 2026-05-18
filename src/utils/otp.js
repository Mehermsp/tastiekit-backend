import { env } from "../config/env.js";
import crypto from "crypto";

export const generateOtp = () => crypto.randomInt(100000, 999999).toString();

export const buildOtpExpiry = () =>
    new Date(Date.now() + env.otpTtlMinutes * 60 * 1000);

export const exposeDevOtp = (otp) =>
    env.nodeEnv === "production" ? undefined : otp;
