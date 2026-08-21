/**
 * The root route renders the sign-in screen rather than redirecting to /login.
 * A static export has no server to issue a 307, so the redirect has to not exist.
 */
export { default } from "./login/page";
