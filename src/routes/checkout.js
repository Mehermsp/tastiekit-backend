import { Router } from "express";
import { ROLES } from "../constants/index.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { getCheckoutSummary } from "../controllers/checkoutController.js";

const router = Router();

router.use(authenticate);
router.use(authorize(ROLES.CUSTOMER));
router.get("/summary", getCheckoutSummary);

export default router;
