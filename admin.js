import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, updateDoc, deleteDoc, getDoc, addDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyC2RWM8RfT5D1HytYuawfwYjNXOBch63ic",
    authDomain: "halashon-ivryt-shaliach.firebaseapp.com",
    projectId: "halashon-ivryt-shaliach",
    storageBucket: "halashon-ivryt-shaliach.firebasestorage.app",
    messagingSenderId: "1032741613734",
    appId: "1:1032741613734:web:b440a3bab2e43a2d198467"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// AUTH
document.getElementById('login-btn').addEventListener('click', () => {
    signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value)
    .catch(e => alert("Diso: " + e.message));
});

document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().role === 'admin') {
            document.getElementById('login-section').style.display = 'none';
            document.getElementById('admin-dashboard').style.display = 'block';
            loadStudents();
        } else { alert("Tsy mahazo miditra!"); signOut(auth); }
    } else {
        document.getElementById('login-section').style.display = 'block';
        document.getElementById('admin-dashboard').style.display = 'none';
    }
});

// SYNC
document.getElementById('sync-btn').addEventListener('click', async () => {
    const logsDiv = document.getElementById('logs');
    logsDiv.innerHTML = "Mifandray...";
    try {
        const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/12t10gKm1GgiCpRoEJ_-WpLsf2AzmM0YhxwLzGMeCoNc/values/Sheet1!A:Z?key=AIzaSyBSxzxE1RTzQPKBzjMwV66HhB9vJXsqqlM`);
        const data = await res.json();
        const rows = data.values;
        const headers = rows[0].map(h => h.trim());
        for (let i = 1; i < rows.length; i++) {
            const rowData = {};
            headers.forEach((h, idx) => rowData[h] = rows[i][idx] ? rows[i][idx].trim() : "");
            const safeTitle = (rowData.PhoneticTitle || `lesson_${i}`).replace(/[^a-zA-Z0-9]/g, "_");
            await setDoc(doc(db, "lessons", `${rowData.Niveau}_${safeTitle}`), { ...rowData });
            logsDiv.innerHTML += `<br>v Vita: ${safeTitle}`;
        }
    } catch (e) { logsDiv.innerHTML = "x Diso: " + e.message; }
});

// STUDENT MGMT
window.loadStudents = async () => {
    const list = document.getElementById("student-list");
    list.innerHTML = "";
    const snap = await getDocs(collection(db, "users"));
    snap.forEach((doc) => {
        const d = doc.data();
        const row = document.createElement("tr");
        row.className = "student-row";
        row.innerHTML = `<td class="name">${d.name||''}</td><td class="email">${d.email||''}</td>
        <td><input type="text" value="${d.deviceId||''}" id="dev-${doc.id}"></td>
        <td><input type="text" value="${d.allowedLevels?.join(',')||''}" id="lvl-${doc.id}"></td>
        <td><button class="btn-save" onclick="updateStudent('${doc.id}')">Tahirizina</button>
        <button class="btn-del" onclick="deleteStudent('${doc.id}')">Fafana</button></td>`;
        list.appendChild(row);
    });
};

window.updateStudent = async (id) => {
    await updateDoc(doc(db, "users", id), { deviceId: document.getElementById(`dev-${id}`).value, allowedLevels: document.getElementById(`lvl-${id}`).value.split(",") });
    alert("Voatahiry!");
};

window.deleteStudent = async (id) => {
    if (confirm("Fafana?")) { await deleteDoc(doc(db, "users", id)); loadStudents(); }
};

window.filterTable = () => {
    const q = document.getElementById("search-input").value.toLowerCase();
    document.querySelectorAll(".student-row").forEach(r => {
        const text = r.innerText.toLowerCase();
        r.style.display = text.includes(q) ? "" : "none";
    });
};

document.getElementById('add-student-btn').addEventListener('click', async () => {
    await addDoc(collection(db, "users"), { name: document.getElementById('new-student-name').value, email: document.getElementById('new-student-email').value, role: "student" });
    loadStudents();
});
