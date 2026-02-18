const express = require("express");
const path = require("path");

const app = express();
app.use(express.static(path.join(__dirname)));

const PORT = process.env.WEB_PORT || 3000;
app.listen(PORT, () => console.log(`Web running on http://localhost:${PORT}`));
