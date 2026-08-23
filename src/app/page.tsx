import { redirect } from "next/navigation";

/** With a server process again, a real redirect is possible. */
export default function Root() {
  redirect("/login");
}
