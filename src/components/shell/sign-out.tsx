import { signOut } from "@/auth";
import { LogOut } from "lucide-react";

/**
 * Sign-out has to be a server action - clearing a signed session cookie is not
 * something the client can be trusted to do on its own.
 */
export function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    >
      <button
        type="submit"
        title="Sign out"
        aria-label="Sign out"
        className="text-3 hover:text-[var(--text)] transition-colors p-2 rounded-md hover:surface-3 flex items-center"
      >
        <LogOut size={16} />
      </button>
    </form>
  );
}
