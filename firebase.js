import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  projectId: 'by0-crm',
  appId: '1:913097673123:web:1ed1cd73553aa1c289f216',
  storageBucket: 'by0-crm.firebasestorage.app',
  apiKey: 'AIzaSyCwWARSw5wmkCbEiBL3IqsYy8PuxK5pQWw',
  authDomain: 'by0-crm.firebaseapp.com',
  messagingSenderId: '913097673123',
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const auth = getAuth(app)
