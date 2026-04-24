import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: "AIzaSyCrxolUvkmXHvJCdtf_GZxEiwXOafL2k8Y",
  authDomain: "truenorth-crm-c6ac5.firebaseapp.com",
  projectId: "truenorth-crm-c6ac5",
  storageBucket: "truenorth-crm-c6ac5.firebasestorage.app",
  messagingSenderId: "737132504974",
  appId: "1:737132504974:web:d65cc501f859daaecae6df",
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const auth = getAuth(app)
