// ============================================================
// CONFIGURAÇÃO DO FIREBASE
// ============================================================
// Substitua os valores abaixo pelos dados do SEU projeto Firebase.
// Você encontra esses dados em:
// Console do Firebase > Configurações do projeto > Seus aplicativos > SDK setup and configuration
// ============================================================

const firebaseConfig = {
    apiKey: "AIzaSyBV3pB-TUH7ykiSK9YfzNGycGrT6ikad8M",
    authDomain: "financepro-5f8e4.firebaseapp.com",
    projectId: "financepro-5f8e4",
    storageBucket: "financepro-5f8e4.firebasestorage.app",
    messagingSenderId: "768705330483",
    appId: "1:768705330483:web:55d6d8a63b667f82a8d246"
};

// Inicializa o Firebase
firebase.initializeApp(firebaseConfig);

// Referências globais usadas em script.js
const db = firebase.firestore();
const auth = firebase.auth();
