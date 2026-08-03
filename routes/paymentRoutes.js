const router = require("express").Router();
const { verificarToken } = require("../middleware/authMiddleware");
const controller = require("../controllers/paymentController");

router.get("/config", verificarToken, controller.configuracion);
router.post("/intents", verificarToken, controller.crearIntento);

module.exports = router;
