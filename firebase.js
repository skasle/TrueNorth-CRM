import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

// TrueNorth CRM — replace with values from new Firebase project
// Firebase Console → Project Settings → General → Your apps → SDK setup
const firebaseConfig = {
  apiKey: 'REPLACE_ME',
  authDomain: 'truenorth-crm.firebaseapp.com',
  projectId: 'truenorth-crm',
  storageBucket: 'truenorth-crm.appspot.com',
  messagingSenderId: 'REPLACE_ME',
  appId: 'REPLACE_ME',
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const auth = getAuth(app)
