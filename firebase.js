// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCrxolUvkmXHvJCdtf_GZxEiwXOafL2k8Y",
  authDomain: "truenorth-crm-c6ac5.firebaseapp.com",
  projectId: "truenorth-crm-c6ac5",
  storageBucket: "truenorth-crm-c6ac5.firebasestorage.app",
  messagingSenderId: "737132504974",
  appId: "1:737132504974:web:d65cc501f859daaecae6df",
  measurementId: "G-WLRP9SCBY9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
