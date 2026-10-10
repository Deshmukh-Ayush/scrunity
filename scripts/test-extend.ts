import { auth } from "@/lib/auth";

async function main() {
  const cookie = "cKX8istUwdSJdnSLMzbkkagMoau22waR.JR8jZwe-7bPXiqq4U_md17W3omgO0QxLCeC3j8-OVU4";
  const headers = new Headers();
  headers.set("cookie", `better-auth.session_token=${cookie}`);
  try {
    const session = await auth.api.getSession({ headers });
    console.log("getSession returned:", session);
  } catch (e) {
    console.error("getSession error:", e);
  }
  process.exit(0);
}
main();
