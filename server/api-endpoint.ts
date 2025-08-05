import { serve } from "bun";
import { generateUserSignature } from "./signature-workflow.js";

const server = serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    
    // Enable CORS for frontend
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Generate signature endpoint
    if (url.pathname === "/generate-signature" && req.method === "GET") {
      try {
        const address = url.searchParams.get("address");
        
        if (!address) {
          return new Response(
            JSON.stringify({ error: "Address parameter required" }),
            { 
              status: 400, 
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            }
          );
        }

        console.log(`🔄 Generating signature for: ${address}`);
        const signatureData = await generateUserSignature(address);

        return new Response(
          JSON.stringify({
            success: true,
            signature: signatureData.signature,
            nonce: signatureData.nonce,
            userAddress: signatureData.userAddress,
            tokenPrice: signatureData.tokenPrice,
            timestamp: signatureData.timestamp
          }),
          { 
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
        
      } catch (error) {
        console.error("❌ Signature generation failed:", error);
        return new Response(
          JSON.stringify({ 
            error: error instanceof Error ? error.message : "Unknown error" 
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }
    }

    // Default 404
    return new Response("Not Found", { 
      status: 404, 
      headers: corsHeaders 
    });
  },
});

console.log(`🚀 Signature API server running on http://localhost:${server.port}`);
console.log("📡 Endpoints:");
console.log("  GET /generate-signature?address=<user_address>");
console.log("");
console.log("Example:");
console.log("  http://localhost:3000/generate-signature?address=0x78C80D61acC3BD220e0561904835CB9ba825CfC8"); 