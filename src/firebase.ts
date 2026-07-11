import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyA1i2bi9R24qC3cTR1R4Ov7bsm_7VNGi7w',
  authDomain: 'treinos-281f6.firebaseapp.com',
  projectId: 'treinos-281f6',
  storageBucket: 'treinos-281f6.firebasestorage.app',
  messagingSenderId: '528978962520',
  appId: '1:528978962520:web:5f9d6d3c47cc7dfd1dc22d',
  measurementId: 'G-3JLFCNR7CN'
};
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
