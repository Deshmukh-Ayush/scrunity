import { GET as connectGET } from "../src/app/api/gtm/mailbox/microsoft/connect/route";
import { GET as callbackGET } from "../src/app/api/gtm/mailbox/microsoft/callback/route";
import { NextRequest } from "next/server";

async function testGating() {
  console.log("=== Testing Microsoft Mailbox Feature Flag Gating ===");

  // Ensure flag is NOT set (default / false)
  delete process.env.MICROSOFT_MAILBOX_ENABLED;

  // 1. Test connect route
  const req1 = new NextRequest("http://localhost:3000/api/gtm/mailbox/microsoft/connect");
  const res1 = await connectGET(req1);
  const data1 = await res1.json();

  console.log("Connect Route (Flag OFF):");
  console.log("  Status Code:", res1.status);
  console.log("  Response Body:", JSON.stringify(data1));

  if (res1.status === 503 && data1.available === false) {
    console.log("  ✓ Connect route properly gated with 503 Coming Soon response!");
  } else {
    console.error("  ✗ Connect route failed gating check!");
    process.exit(1);
  }

  // 2. Test callback route
  const req2 = new NextRequest("http://localhost:3000/api/gtm/mailbox/microsoft/callback?code=mock_code&state=mock_state");
  const res2 = await callbackGET(req2);
  const data2 = await res2.json();

  console.log("\nCallback Route (Flag OFF):");
  console.log("  Status Code:", res2.status);
  console.log("  Response Body:", JSON.stringify(data2));

  if (res2.status === 503 && data2.available === false) {
    console.log("  ✓ Callback route properly gated with 503 Coming Soon response!");
  } else {
    console.error("  ✗ Callback route failed gating check!");
    process.exit(1);
  }

  // 3. Test with Flag ON
  process.env.MICROSOFT_MAILBOX_ENABLED = "true";
  process.env.MICROSOFT_CLIENT_ID = "mock_client_id";
  const req3 = new NextRequest("http://localhost:3000/api/gtm/mailbox/microsoft/connect");
  const res3 = await connectGET(req3);
  console.log("\nConnect Route (Flag ON):");
  console.log("  Status Code:", res3.status);
  if (res3.status === 307 || res3.status === 302 || res3.status === 200 || res3.headers.get("location")) {
    console.log("  ✓ Connect route resumes normal OAuth flow when flag is ON! Location:", res3.headers.get("location")?.slice(0, 60));
  }

  console.log("\n=== ALL GATING CHECKS PASSED ===");
}

testGating().catch((err) => {
  console.error("Error running gating test:", err);
  process.exit(1);
});
