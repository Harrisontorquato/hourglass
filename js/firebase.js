import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, deleteUser, reload, sendPasswordResetEmail} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-analytics.js";

//os valores estão zerados para voce poder colocar a sua propia apiKey

const firebaseConfig = {
    apiKey:            "",
    authDomain:        "",
    projectId:         "",
    storageBucket:     "",
    messagingSenderId: "",
    appId:             "",
    measurementId:     ""
};

const app      = initializeApp(firebaseConfig);
const auth     = getAuth(app);
const analytics = getAnalytics(app);

export { auth, analytics, signOut, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, deleteUser, reload, sendPasswordResetEmail};