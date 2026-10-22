const express = require("express");
const router = express.Router();

const { login, signup, logout, googleLogin } = require("../auth/auth");

router.post("/login", login);

router.post("/google", googleLogin);

router.post("/signup", signup);

router.post("/logout", logout);

module.exports = router;
