import * as functions from "firebase-functions";
import { createApp } from "./server";

const app = createApp();
export const api = functions.https.onRequest(app);

