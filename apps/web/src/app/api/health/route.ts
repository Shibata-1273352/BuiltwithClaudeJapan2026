import { connection } from "next/server";
import { getHealth } from "@/lib/health";

export async function GET() {
  await connection();
  return Response.json(await getHealth());
}
