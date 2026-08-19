import { Router, type IRouter } from "express";
import healthRouter from "./health";
import servicesRouter from "./services";
import availableDaysRouter from "./available-days";
import appointmentsRouter from "./appointments";
import dashboardRouter from "./dashboard";
import botRouter from "./bot";

const router: IRouter = Router();

router.use(healthRouter);
router.use(servicesRouter);
router.use(availableDaysRouter);
router.use(appointmentsRouter);
router.use(dashboardRouter);
router.use(botRouter);

export default router;
