import "dotenv/config";
import { createApp } from "./app.js";

const app = createApp();
const port = Number(process.env.PORT ?? 4040);
app.listen(port, () => {
  console.log(`Section Timeline API listening on http://localhost:${port}`);
});
