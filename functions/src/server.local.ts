import { createApp } from "./server";

/*Entry point standalone: arranca Express sin Firebase Functions para desarrollo local.*/
const PORT = Number(process.env.PORT) || 8080;
const app = createApp();

app.listen(PORT, () => {
    console.log(`[dev] Server running at http://localhost:${PORT}`);
    console.log(`[dev] Docs at http://localhost:${PORT}/docs`);
});