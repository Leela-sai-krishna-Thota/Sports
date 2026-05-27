/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

// Lazy initialize Firebase Admin to check project environment variable safety
let adminAppInstance: any = null;

// Load config to specify custom database
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const DB_ID = firebaseConfig.firestoreDatabaseId;

export function getAdminApp() {
  if (!adminAppInstance) {
    try {
      // Initialize with application default credentials, matching our temporal cloud context
      adminAppInstance = admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId
      });
    } catch (error) {
      console.warn('Firebase Admin SDK could not auto-initialize. Falling back to keyless mode...', error);
      try {
        adminAppInstance = admin.app();
      } catch (appErr) {
        console.error('Failed to get fallback default app:', appErr);
      }
    }
  }
  return adminAppInstance;
}

export function getFirestoreDb() {
  const adminApp = getAdminApp();
  return getFirestore(adminApp, DB_ID);
}

export interface AuthRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    role?: string;
  };
}

export async function verifyFirebaseToken(req: AuthRequest, res: Response, next: NextFunction): Promise<any> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or malformed authentication header' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const adminApp = getAdminApp();
    const decodedToken = await adminApp.auth().verifyIdToken(token);
    
    // Check role in users collection with correct database ID
    let userRole = 'Player';
    try {
      const userSnap = await getFirestoreDb()
        .collection('users')
        .doc(decodedToken.uid)
        .get();
      userRole = userSnap.exists ? (userSnap.data()?.role || 'Player') : 'Player';
    } catch (dbErr) {
      console.warn('Backend DB auth role lookup failed. Resolving from verified ID token email details:', dbErr);
      const email = decodedToken.email || '';
      if (email === 'thotaleelasaikrishna@gmail.com' || email.toLowerCase().includes('admin')) {
        userRole = 'Admin';
      } else {
        userRole = 'Player';
      }
    }

    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      role: userRole
    };
    next();
  } catch (error) {
    console.error('JWT Token Verification Failed:', error);
    return res.status(403).json({ error: 'Forbidden: Invalid or expired access token' });
  }
}
