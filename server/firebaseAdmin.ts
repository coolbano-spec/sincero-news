import admin from "firebase-admin";
import { getApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

let initialized = false;
let firestoreDbId = "(default)";

export function getFirebaseAdmin() {
  if (!initialized) {
    try {
      // Prioritize Service Account JSON from env var for non-GCP environments like Railway
      const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      const configPath = path.join(process.cwd(), "firebase-applet-config.json");
      let config: any = null;
      
      if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        if (config.firestoreDatabaseId) {
          firestoreDbId = config.firestoreDatabaseId;
        }
      }

      if (serviceAccountVar) {
        const serviceAccount = JSON.parse(serviceAccountVar);
        admin.initializeApp({
          credential: cert(serviceAccount),
          projectId: serviceAccount.project_id || (config ? config.projectId : "sinceronewsapp")
        });
        console.log(`[Firebase Admin] Initialized with Service Account JSON from environment variable. Database ID: ${firestoreDbId}`);
      } else if (config) {
        admin.initializeApp({
          projectId: config.projectId,
        });
        console.log(`[Firebase Admin] Initialized with local config. Project ID: ${config.projectId}, Database ID: ${firestoreDbId}`);
      } else {
        // Fallback to default initialization
        admin.initializeApp({
          projectId: "sinceronewsapp"
        });
        console.log("[Firebase Admin] Initialized with default fallback credentials.");
      }
      initialized = true;
    } catch (error) {
      console.error("[Firebase Admin] Failed to initialize Firebase Admin:", error);
      // Fallback initialize
      try {
        admin.initializeApp({
          projectId: "sinceronewsapp"
        });
        initialized = true;
        console.log("[Firebase Admin] Initialized with fallback project ID.");
      } catch (err) {
        console.error("[Firebase Admin] Critical: Fallback initialization failed:", err);
      }
    }
  }
  return admin;
}

// Call initialization initially
getFirebaseAdmin();

export const adminAuth = () => getAuth();
export const adminDb = () => {
  if (!firestoreDbId || firestoreDbId === "(default)") {
    return getFirestore(getApp());
  }
  return getFirestore(getApp(), firestoreDbId);
};
