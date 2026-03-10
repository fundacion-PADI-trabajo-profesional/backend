import * as dotenv from "dotenv";
dotenv.config(); // Carga las variables del archivo .env
import * as functions from "firebase-functions";
import { createApp } from "./server";

const app = createApp();
export const api = functions.https.onRequest(app);

