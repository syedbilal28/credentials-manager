import { logout } from "@/actions/auth";

/** Signs out, then reloads the whole page so no client state is kept. */
export async function signOut(): Promise<void> {
  try {
    await logout();
  } finally {
    // A full page load on purpose (recommended by Next.js for logout): a
    // client-side navigation would keep hidden pages and their state alive.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/login");
  }
}
