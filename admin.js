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

// --- SYNC GOOGLE SHEETS TO FIRESTORE ---
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
        if (!rows || rows.length <= 1) {
            logsDiv.innerText = "❌ Tsy misy data hita ao amin'ny Google Sheets.";
            return;
        }

        const headers = rows[0].map(h => h.trim()); 
        logsDiv.innerHTML = `Nahita andalana ${rows.length - 1}. Manomboka mampitovy...`;

        let successCount = 0;

        for (let i = 1; i < rows.length; i++) {
            if (!rows[i] || rows[i].length === 0) continue; // Dinganina raha misy andalana banga tanteraka

            const rowData = {};
            headers.forEach((h, idx) => {
                rowData[h] = rows[i][idx] ? rows[i][idx].trim() : "";
            });

            // Antoka fa tsy ho fotsy ny fanalahidy (ID) na dia misy banga aza ny sheets
            const niveau = rowData.Niveau || "Unknown";
            const phoneticTitle = rowData.PhoneticTitle || rowData.HebrewTitle || `lesson_${i}`;
            const safeTitle = phoneticTitle.replace(/[^a-zA-Z0-9]/g, "_");
            
            // Ny customId dia manambatra ny Niveau, ny lohateny ary ny laharan'ny andalana (row index) mba tsy hisy andalana mifandona na mifafa
            const customId = `${niveau}_${safeTitle}_row${String(i).padStart(4, '0')}`;
            
            try {
                await setDoc(doc(db, "lessons", customId), {
                    ...rowData,
                    rowIndex: i,
                    timestamp: new Date()
                });
                successCount++;
                logsDiv.innerHTML += `<br>✅ Vita (${successCount}/${rows.length - 1}): ${safeTitle}`;
            } catch (docError) {
                console.error(`Error teo amin'ny andalana ${i}:`, docError);
                logsDiv.innerHTML += `<br><span style="color:red;">❌ Tsy lasa ny andalana ${i}: ${docError.message}</span>`;
            }
        }
        alert("Vita soa aman-tsara ny fampitoviana!");
        logsDiv.innerHTML += `<br><br><b>Done! Lesona ${successCount} no tafiditra.</b>`;
    } catch (error) {
        logsDiv.innerText = "❌ Nisy olana: " + error.message;
    } finally {
        syncBtn.disabled = false;
    }
});

// --- STUDENT MANAGEMENT ---
window.loadStudents = async () => {
    const list = document.getElementById("student-list");
    list.innerHTML = "";
    
    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        querySnapshot.forEach((doc) => {
            const d = doc.data();
            const levels = d.allowedLevels ? d.allowedLevels.join(",") : "";
            const row = document.createElement("tr");
            row.className = "student-row";
            row.innerHTML = `
                <td class="name">${d.name || ''}</td>
                <td class="email">${d.email || ''}</td>
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
    } catch (e) {
        console.error("Tsy afaka naka mpianatra:", e);
    }
};

window.updateStudent = async (id) => {
    const newDeviceId = document.getElementById(`dev-${id}`).value;
    const newLevels = document.getElementById(`lvl-${id}`).value.split(",").map(s => s.trim());
    try {
        await updateDoc(doc(db, "users", id), { deviceId: newDeviceId, allowedLevels: newLevels });
        alert("Voatahiry ny fanovana!");
        loadStudents();
    } catch (e) { alert("Error: " + e.message); }
};

window.deleteStudent = async (id) => {
    if (confirm("Hofafana marina ve ity mpianatra ity?")) {
        try {
            await deleteDoc(doc(db, "users", id));
            loadStudents();
        } catch (e) { alert("Error: " + e.message); }
    }
};

window.filterTable = () => {
    const q = document.getElementById("search-input").value.toLowerCase();
    document.querySelectorAll(".student-row").forEach(r => {
        const text = r.innerText.toLowerCase();
        r.style.display = text.includes(q) ? "" : "none";
    });
};

document.getElementById('add-student-btn').addEventListener('click', async () => {
    const name = document.getElementById('new-student-name').value;
    const email = document.getElementById('new-student-email').value;
    const levelsInput = document.getElementById('new-student-levels');
    const levels = levelsInput ? levelsInput.value.split(",").map(s => s.trim()) : [];
    try {
        await addDoc(collection(db, "users"), { name, email, role: "student", allowedLevels: levels });
        alert("Tafiditra ny mpianatra!");
        loadStudents();
    } catch (e) { alert("Error: " + e.message); }
});
