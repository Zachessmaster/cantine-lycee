// Je réutilise le projet Supabase de la page d'inscription.
const SUPABASE_URL = "https://hxgylzfctfeelzetfnwj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4Z3lsemZjdGZlZWx6ZXRmbndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxNzM0MDIsImV4cCI6MjEwNTc0OTQwMn0.4frUb93cHbh5qhhtv9i317HrCNj6MfFrENVXTY154IQ";

// Je crée le client qui gère la connexion et la lecture des inscriptions.
const sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let allRegistrations = [];

// Je calcule le lundi affiché, avec la même bascule du vendredi à 20 h que l'inscription.
function getCurrentMonday() {
  const date = new Date();
  const day = date.getDay();

  // Je prends la semaine suivante vendredi soir et pendant le week-end.
  if ((day === 5 && date.getHours() >= 20) || day === 6 || day === 0) {
    date.setDate(date.getDate() + ((8 - day) % 7));
  }

  const daysSinceMonday = (date.getDay() + 6) % 7;

  date.setDate(date.getDate() - daysSinceMonday);
  date.setHours(12, 0, 0, 0);

  // Je construis une date locale pour ne pas subir de décalage UTC.
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const monday = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${monday}`;
}

const currentWeekStart = getCurrentMonday();
// Je recharge le tableau si la semaine change pendant que l'administration reste ouverte.
setInterval(() => {
  if (getCurrentMonday() !== currentWeekStart) {
    window.location.reload();
  }
}, 30000);

// Je limite les résultats aux classes actuellement gérées dans cette page.
const currentClasses = new Set([
  '1STMG1', '1STMG2', '1STMG3', '1STMG4',
  'TSTMG1', 'TSTMG2', 'TSTMG3', 'TSTMG4',
  'CG1A', 'CG1B', 'CG1C', 'CG2A', 'CG2B',
  'GPME1', 'GPME2',
  'NDRC1', 'NDRC2',
  'DCG1', 'DCG2'
]);
// Je garde les noms des jours pour préparer le fichier exporté.
const dayNames = {
  monday: 'Lundi',
  tuesday: 'Mardi',
  wednesday: 'Mercredi',
  thursday: 'Jeudi',
  friday: 'Vendredi'
};

// Je repère le jour courant pour l'export des élèves qui mangent aujourd'hui.
function getCurrentDayKey() {
  return {
    1: 'monday',
    2: 'tuesday',
    3: 'wednesday',
    4: 'thursday',
    5: 'friday'
  }[new Date().getDay()] || null;
}

const currentDayKey = getCurrentDayKey();

// Je récupère les éléments de connexion que je vais manipuler dans les événements.
const loginForm = document.getElementById('loginForm');
const loginView = document.getElementById('loginView');
const dashboardView = document.getElementById('dashboardView');
const loginError = document.getElementById('loginError');
const submitBtn = loginForm.querySelector('button[type="submit"]');

// Je contrôle les identifiants avec Supabase avant d'afficher le tableau de bord.
loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginError.style.display = 'none';
  submitBtn.disabled = true;
  submitBtn.textContent = 'Connexion en cours...';

  const email = document.getElementById('adminEmail').value.trim();
  const password = document.getElementById('adminPassword').value;

  try {
    // Je demande à Supabase d'ouvrir la session de l'intendance.
    const { error } = await sbClient.auth.signInWithPassword({ email, password });

    if (error) {
      showLoginError(`Erreur : ${error.message}`);
      resetSubmitButton();
      return;
    }

    await initDashboard();
  } catch {
    showLoginError("Erreur de connexion. Vérifie l'accès réseau.");
    resetSubmitButton();
  }
});

// Je ferme la session puis je reviens à l'écran de connexion.
document.getElementById('logoutBtn').addEventListener('click', async () => {
  await sbClient.auth.signOut();
  dashboardView.style.display = 'none';
  loginView.style.display = 'block';
  resetSubmitButton();
});

// Je centralise l'affichage des erreurs de connexion.
function showLoginError(message) {
  loginError.textContent = message;
  loginError.style.display = 'block';
}

// Je remets le bouton dans son état normal après une tentative de connexion.
function resetSubmitButton() {
  submitBtn.disabled = false;
  submitBtn.textContent = 'Se connecter';
}

// Je charge les inscriptions de la semaine et je prépare leur affichage.
async function initDashboard() {
  loginView.style.display = 'none';
  dashboardView.style.display = 'block';
  document.getElementById('weekInfo').textContent = `Semaine débutant le ${currentWeekStart}`;

  const { data, error } = await sbClient
    // Je ne récupère que les colonnes utiles à l'affichage du tableau.
    .from('registrations')
    .select(`
      student_name,
      student_first_name,
      student_class,
      week_start,
      monday,
      tuesday,
      wednesday,
      thursday,
      friday
    `)
    // Je filtre sur la semaine choisie puis je trie pour faciliter la lecture.
    .eq('week_start', currentWeekStart)
    .order('student_class', { ascending: true })
    .order('student_name', { ascending: true });

  if (error) {
    alert(`Erreur lors de la lecture des données : ${error.message}`);
    return;
  }

  // Je garde uniquement les classes connues avant de remplir les filtres et le tableau.
  allRegistrations = (data || []).filter((registration) =>
    currentClasses.has(registration.student_class)
  );
  populateClassFilter();
  renderTable();
}

// Je reconstruis la liste des classes selon le jour sélectionné.
function populateClassFilter() {
  const classSelect = document.getElementById('filterClass');
  const previousClass = classSelect.value;
  const selectedDay = document.getElementById('filterDay').value;
  classSelect.replaceChildren();

  const allClassesOption = document.createElement('option');
  allClassesOption.value = 'all';
  allClassesOption.textContent = 'Toutes les classes';
  classSelect.appendChild(allClassesOption);

  const classes = [...new Set(
    allRegistrations
      .filter((registration) => selectedDay === 'all'
        || registration[selectedDay] === true)
      .map((registration) => registration.student_class)
      .filter(Boolean)
  )].sort();

  classes.forEach((className) => {
    const option = document.createElement('option');
    option.value = className;
    option.textContent = className;
    classSelect.appendChild(option);
  });

  classSelect.value = classes.includes(previousClass) ? previousClass : 'all';
}

// Je combine les filtres du jour et de la classe sans modifier les données originales.
function getFilteredData() {
  const selectedDay = document.getElementById('filterDay').value;
  const selectedClass = document.getElementById('filterClass').value;

  return allRegistrations.filter((registration) => {
    const matchesDay = selectedDay === 'all'
      || registration[selectedDay] === true;
    const matchesClass = selectedClass === 'all'
      || registration.student_class === selectedClass;

    return matchesDay && matchesClass;
  });
}

// Je récupère les inscrits dont la case du jour courant est cochée.
function getTodayData() {
  if (!currentDayKey) return [];
  return allRegistrations.filter((registration) => registration[currentDayKey] === true);
}

// Je crée une cellule et j'ajoute le texte sans interpréter son contenu comme du HTML.
function addCell(row, value, className = '', strong = false) {
  const cell = document.createElement('td');
  if (className) cell.className = className;

  if (strong) {
    const name = document.createElement('strong');
    name.textContent = value;
    cell.appendChild(name);
  } else {
    cell.textContent = value;
  }

  row.appendChild(cell);
}

// Je dessine le tableau à partir des résultats filtrés.
function renderTable() {
  const tbody = document.getElementById('studentsTableBody');
  const filtered = getFilteredData();
  tbody.replaceChildren();
  document.getElementById('countBadge').textContent = filtered.length;

  filtered.forEach((registration) => {
    const row = document.createElement('tr');

    addCell(row, registration.student_name || '', '', true);
    addCell(row, registration.student_first_name || '');
    addCell(row, registration.student_class || '');
    addCell(row, registration.monday ? '✓' : '-', 'col-center');
    addCell(row, registration.tuesday ? '✓' : '-', 'col-center');
    addCell(row, registration.wednesday ? '✓' : '-', 'col-center');
    addCell(row, registration.thursday ? '✓' : '-', 'col-center');
    addCell(row, registration.friday ? '✓' : '-', 'col-center');

    tbody.appendChild(row);
  });
}

// Je restaure la session si l'intendance s'était déjà connectée.
async function restoreSession() {
  const { data } = await sbClient.auth.getSession();
  if (data.session) await initDashboard();
}

// Je rafraîchis les options et le tableau quand un filtre change.
document.getElementById('filterDay').addEventListener('change', () => {
  populateClassFilter();
  renderTable();
});
document.getElementById('filterClass').addEventListener('change', renderTable);

// Je prépare un fichier Excel avec les inscrits du jour courant.
document.getElementById('exportBtn').addEventListener('click', () => {
  const dataToExport = getTodayData();
  const currentDay = currentDayKey || 'aucun-service';
  const dayLabel = currentDayKey ? dayNames[currentDayKey] : 'Jour';

  // Je transforme chaque inscription en ligne avec les colonnes voulues dans Excel.
  const rows = dataToExport.map((registration) => ({
    Nom: registration.student_name,
    Prénom: registration.student_first_name,
    Classe: registration.student_class,
    [dayLabel]: 'OUI'
  }));

  // Je crée la feuille et le classeur, puis je déclenche le téléchargement.
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Inscrits');
  XLSX.writeFile(workbook, `cantine_${currentWeekStart}_${currentDay}.xlsx`);
});

restoreSession();
