// Configuração pública do Firebase (não é segredo — a segurança é feita pelas Firestore Rules)
const firebaseConfig = {
  apiKey: "AIzaSyBGQE8G1kJfPYc3_aDf3anPMtNbkyM3tVA",
  authDomain: "hosjiujitsu-app.firebaseapp.com",
  projectId: "hosjiujitsu-app",
  storageBucket: "hosjiujitsu-app.firebasestorage.app",
  messagingSenderId: "436034974836",
  appId: "1:436034974836:web:952ff3d16793ad22b50d21"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

const FAIXAS = ["Branca", "Cinza", "Amarela", "Laranja", "Verde", "Azul", "Roxa", "Marrom", "Preta"];
