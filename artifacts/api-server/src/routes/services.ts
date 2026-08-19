import { Router, type IRouter } from "express";
import { db, servicesTable } from "@workspace/db";
import { ListServicesResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/services", async (_req, res): Promise<void> => {
  const services = await db.select().from(servicesTable).orderBy(servicesTable.id);
  res.json(ListServicesResponse.parse(services));
});

export default router;
