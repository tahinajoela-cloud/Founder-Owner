import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, updateDoc, deleteDoc, getDoc, addDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// --- CONFIGURATION ---
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

// --- AUTHENTICATION (LOGIN / LOGOUT) ---
const loginBtn = document.getElementById('login-btn');
if (loginBtn) {
    loginBtn.addEventListener('click', () => {
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        
        if (!emailInput || !passwordInput) {
            alert("Tsy hita ny boaty fampidirana mailaka na tenimiafina!");
            return;
        }

        const email = emailInput.value.trim();
        const pass = passwordInput.value;

        if (!email || !pass) {
            alert("Fenoy azafady ny mailaka sy ny tenimiafina!");
            return;
        }

        signInWithEmailAndPassword(auth, email, pass)
            .catch(e => alert("Diso ny fidirana: " + e.message));
    });
}

const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => signOut(auth));
}

// --- STATE MONITOR (REHEFA MIHOVA NY STATUS) ---
onAuthStateChanged(auth, async (user) => {
    const loginSection = document.getElementById('login-section');
    const adminDashboard = document.getElementById('admin-dashboard');

    if (user) {
        try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists() && userDoc.data().role === 'admin') {
                if (loginSection) loginSection.style.display = 'none';
                if (adminDashboard) adminDashboard.style.display = 'block';
                loadStudents();
            } else {
                alert("Tsy mahazo miditra! Tsy manana andraikitra (role: admin) ity kaonty ity.");
                signOut(auth);
            }
        } catch (e) {
            alert("Nisy olana teo am-panamarinana ny mombamomba anao: " + e.message);
            signOut(auth);
        }
    } else {
        if (loginSection) loginSection.style.display = 'block';
        if (adminDashboard) adminDashboard.style.display = 'none';
    }
});

// --- SYNC GOOGLE SHEETS TO FIRESTORE ---
const syncBtn = document.getElementById('sync-btn');
if (syncBtn) {
    syncBtn.addEventListener('click', async () => {
        const logsDiv = document.getElementById('logs');
        
        const SPREADSHEET_ID = "12t10gKm1GgiCpRoEJ_-WpLsf2AzmM0YhxwLzGMeCoNc"; 
        const API_KEY = "AIzaSyBSxzxE1RTzQPKBzjMwV66HhB9vJXsqqlM"; 
        const SHEET_NAME = "Sheet1"; 

        syncBtn.disabled = true;
        if (logsDiv) logsDiv.innerHTML = "Mifandray amin'ny Google Sheets API...";

        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_NAME}!A:Z?key=${API_KEY}`;

        try {
            const response = await fetch(url);
            const resData = await response.json();

            if (!response.ok) throw new Error(resData.error?.message || "Error fetch");
            
            const rows = resData.values;
            if (!rows || rows.length <= 1) {
                if (logsDiv) logsDiv.innerText = "❌ Tsy misy data hita ao amin'ny Google Sheets.";
                return;
            }

            const headers = rows[0].map(h => h.trim()); 
            if (logsDiv) logsDiv.innerHTML = `Nahita andalana ${rows.length - 1}. Manomboka mampitovy...`;

            let successCount = 0;

            for (let i = 1; i < rows.length; i++) {
                if (!rows[i] || rows[i].length === 0) continue; 

                const rowData = {};
                headers.forEach((h, idx) => {
                    rowData[h] = rows[i][idx] ? rows[i][idx].trim() : "";
                });

                const niveau = rowData.Niveau || "Unknown";
                const phoneticTitle = rowData.PhoneticTitle || rowData.HebrewTitle || `lesson_${i}`;
                const safeTitle = phoneticTitle.replace(/[^a-zA-Z0-9]/g, "_");
                
                // Id miavaka tsara mampiasa ny laharan'ny andalana mba ho lasa daholo ny rows rehetra
                const customId = `${niveau}_${safeTitle}_row${String(i).padStart(4, '0')}`;
                
                try {
                    await setDoc(doc(db, "lessons", customId), {
                        ...rowData,
                        rowIndex: i,
                        timestamp: new Date()
                    });
                    successCount++;
                    if (logsDiv) logsDiv.innerHTML += `<br>✅ Vita (${successCount}/${rows.length - 1}): ${safeTitle}`;
                } catch (docError) {
                    console.error(`Error teo amin'ny andalana ${i}:`, docError);
                    if (logsDiv) logsDiv.innerHTML += `<br><span style="color:red;">❌ Tsy lasa ny andalana ${i}: ${docError.message}</span>`;
                }
            }
            alert("Vita soa aman-tsara ny fampitoviana!");
            if (logsDiv) logsDiv.innerHTML += `<br><br><b>Done! Lesona ${successCount} no tafiditra soa aman-tsara.</b>`;
        } catch (error) {
            if (logsDiv) logsDiv.innerText = "❌ Nisy olana: " + error.message;
        } finally {
            syncBtn.disabled = false;
        }
    });
}

// --- STUDENT MANAGEMENT ---
async function loadStudents() {
    const list = document.getElementById("student-list");
    if (!list) return;
    list.innerHTML = "";
    
    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        querySnapshot.forEach((docSnap) => {
            const d = docSnap.data();
            const levels = d.allowedLevels ? d.allowedLevels.join(",") : "";
            const row = document.createElement("tr");
            row.className = "student-row";
            row.innerHTML = `
                <td class="name">${d.name || ''}</td>
                <td class="email">${d.email || ''}</td>
                <td><input type="text" value="${d.deviceId || ''}" id="dev-${docSnap.id}"></td>
                <td><input type="text" value="${levels}" id="lvl-${docSnap.id}"></td>
                <td>
                    <button class="btn-save" id="save-${docSnap.id}">Tahirizina</button>
                    <button class="btn-del" id="del-${docSnap.id}">Fafana</button>
                </td>
            `;
            list.appendChild(row);

            document.getElementById(`save-${docSnap.id}`).addEventListener('click', () => updateStudent(docSnap.id));
            document.getElementById(`del-${docSnap.id}`).addEventListener('click', () => deleteStudent(docSnap.id));
        });
    } catch (e) {
        console.error("Tsy afaka naka mpianatra:", e);
    }
}

async function updateStudent(id) {
    const devInput = document.getElementById(`dev-${id}`);
    const lvlInput = document.getElementById(`lvl-${id}`);
    
    const newDeviceId = devInput ? devInput.value.trim() : "";
    const newLevels = lvlInput ? lvlInput.value.split(",").map(s => s.trim()).filter(s => s !== "") : [];
    
    try {
        await updateDoc(doc(db, "users", id), { deviceId: newDeviceId, allowedLevels: newLevels });
        alert("Voatahiry ny fanovana!");
        loadStudents();
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

// --- FIKAROHANA MPIANATRA (SEARCH BOX) ---
const searchInput = document.getElementById("search-input");
if (searchInput) {
    searchInput.addEventListener("input", () => {
        const q = searchInput.value.toLowerCase();
        document.querySelectorAll(".student-row").forEach(r => {
            const text = r.innerText.toLowerCase();
            r.style.display = text.includes(q) ? "" : "none";
        });
    });
}

// --- MAMPIDITRA MPIANATRA ---
const addStudentBtn = document.getElementById('add-student-btn');
if (addStudentBtn) {
    addStudentBtn.addEventListener('click', async () => {
        const nameInput = document.getElementById('new-student-name');
        const emailInput = document.getElementById('new-student-email');
        const levelsInput = document.getElementById('new-student-levels');

        const name = nameInput ? nameInput.value.trim() : "";
        const email = emailInput ? emailInput.value.trim() : "";
        const levels = levelsInput ? levelsInput.value.split(",").map(s => s.trim()).filter(s => s !== "") : [];

        if (!name || !email) {
            alert("Fenoy ny anarana sy ny mailaka!");
            return;
        }

        try {
            await addDoc(collection(db, "users"), { name, email, role: "student", allowedLevels: levels });
            alert("Tafiditra ny mpianatra!");
            if (nameInput) nameInput.value = "";
            if (emailInput) emailInput.value = "";
            if (levelsInput) levelsInput.value = "";
            loadStudents();
        } catch (e) { alert("Error: " + e.message); }
    });
}
