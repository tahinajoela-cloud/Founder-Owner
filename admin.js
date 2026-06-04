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

// --- AUTH ---
document.getElementById('login-btn').addEventListener('click', () => {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    signInWithEmailAndPassword(auth, email, pass).catch(e => alert("Diso: " + e.message));
});

document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().role === 'admin') {
            document.getElementById('login-section').style.display = 'none';
            document.getElementById('admin-dashboard').style.display = 'block';
            loadStudents();
        } else {
            alert("Tsy mahazo miditra!");
            signOut(auth);
        }
    } else {
        document.getElementById('login-section').style.display = 'block';
        document.getElementById('admin-dashboard').style.display = 'none';
    }
});

document.getElementById('sync-btn').addEventListener('click', async () => {
    const syncBtn = document.getElementById('sync-btn');
    const logsDiv = document.getElementById('logs');
    
    const SPREADSHEET_ID = "12t10gKm1GgiCpRoEJ_-WpLsf2AzmM0YhxwLzGMeCoNc"; 
    const API_KEY = "AIzaSyBSxzxE1RTzQPKBzjMwV66HhB9vJXsqqlM"; 
    const SHEET_NAME = "Sheet1"; 

    syncBtn.disabled = true;
    logsDiv.innerHTML = "Mifandray amin'ny Google Sheets API...";

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_NAME}!A:Z?key=${API_KEY}`;

    try {
        const response = await fetch(url);
        const resData = await response.json();

        if (!response.ok) throw new Error(resData.error.message);
        
        const rows = resData.values;
        const headers = rows[0].map(h => h.trim()); 
        
        logsDiv.innerText = `Nahita andalana ${rows.length - 1}. Manomboka...`;

        for (let i = 1; i < rows.length; i++) {
            const rowData = {};
            headers.forEach((h, idx) => rowData[h] = rows[i][idx] ? rows[i][idx].trim() : "");

            if (!rowData.PhoneticTitle && !rowData.Niveau) continue;

            const safeTitle = (rowData.PhoneticTitle || rowData.HebrewTitle || `lesson_${i}`).replace(/[^a-zA-Z0-9]/g, "_");
            const customId = `${rowData.Niveau}_${safeTitle}_row${String(i).padStart(4, '0')}`;
            
            await setDoc(doc(db, "lessons", customId), {
                ...rowData,
                rowIndex: i,
                timestamp: new Date()
            });
        }
        alert("Vita soa aman-tsara ny fampitoviana!");
        logsDiv.innerText = "✅ Vita ny Sync!";
    } catch (error) {
        logsDiv.innerText = "❌ Nisy olana: " + error.message;
    } finally {
        syncBtn.disabled = false;
    }
});

// --- STUDENT MANAGEMENT ---
async function loadStudents() {
    const querySnapshot = await getDocs(collection(db, "users"));
    const list = document.getElementById("student-list");
    list.innerHTML = "";
    
    querySnapshot.forEach((doc) => {
        const d = doc.data();
        const levels = d.allowedLevels ? d.allowedLevels.join(",") : "";
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${d.name || ''}</td>
            <td>${d.email || ''}</td>
            <td><input type="text" value="${d.deviceId || ''}" id="dev-${doc.id}"></td>
            <td><input type="text" value="${levels}" id="lvl-${doc.id}"></td>
            <td>
                <button class="btn-save" id="save-${doc.id}">Tahirizina</button>
                <button class="btn-del" id="del-${doc.id}">Fafana</button>
            </td>
        `;
        list.appendChild(row);

        document.getElementById(`save-${doc.id}`).addEventListener('click', () => updateStudent(doc.id));
        document.getElementById(`del-${doc.id}`).addEventListener('click', () => deleteStudent(doc.id));
    });
}

async function updateStudent(id) {
    const newDeviceId = document.getElementById(`dev-${id}`).value;
    const newLevels = document.getElementById(`lvl-${id}`).value.split(",").map(s => s.trim());
    try {
        await updateDoc(doc(db, "users", id), { deviceId: newDeviceId, allowedLevels: newLevels });
        alert("Voatahiry ny fanovana!");
    } catch (e) { alert("Error: " + e.message); }
}

async function deleteStudent(id) {
    if (confirm("Hofafana marina ve ity mpianatra ity?")) {
        try {
            await deleteDoc(doc(db, "users", id));
            loadStudents();
        } catch (e) { alert("Error: " + e.message); }
    }
}

document.getElementById('add-student-btn').addEventListener('click', async () => {
    const name = document.getElementById('new-student-name').value;
    const email = document.getElementById('new-student-email').value;
    const levels = document.getElementById('new-student-levels').value.split(",").map(s => s.trim());
    try {
        await addDoc(collection(db, "users"), { name, email, role: "student", allowedLevels: levels });
        alert("Tafiditra ny mpianatra!");
        loadStudents();
    } catch (e) { alert("Error: " + e.message); }
});