export const EMAIL_MAX_LENGTH = 255;
// bcrypt (bcryptjs) only hashes the first 72 bytes of the input — anything
// longer is silently ignored, so allowing more here would be misleading.
export const PASSWORD_MAX_LENGTH = 72;
export const FULL_NAME_MAX_LENGTH = 100;
// Matches PHONE_PATTERN's own {9,15} upper bound in RegisterPage.
export const PHONE_NUMBER_MAX_LENGTH = 15;
