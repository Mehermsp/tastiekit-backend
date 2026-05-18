export const sanitizeUser = (user) => {
    if (!user) return null;

    const {
        password,
        email_otp_code,
        email_otp_expires,
        reset_token,
        ...safeUser
    } = user;

    return safeUser;
};
