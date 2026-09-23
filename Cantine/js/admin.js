const SUPABASE_URL = "https://hxgylzfctfeelzetfnwj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4Z3lsemZjdGZlZWx6ZXRmbndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxNzM0MDIsImV4cCI6MjEwNTc0OTQwMn0.4frUb93cHbh5qhhtv9i317HrCNj6MfFrENVXTY154IQ";

const sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let allRegistrations = [];

function getCurrentMonday() {
  const date = new Date();
  const day = date.getDay();
  const daysSinceMonday = (day + 6) % 7;

  date.setDate(date.getDate() - daysSinceMonday);
  date.setHours(12, 0, 0, 0);

  return date.toISOString().slice(0, 10);
}

const currentWeekStart = getCurrentMonday();
const currentClasses = new Set([
  '1STMG1', '1STMG2', '1STMG3', '1STMG4',
  'TSTMG1', 'TSTMG2', 'TSTMG3', 'TSTMG4',
  'CG1A', 'CG1B', 'CG1C', 'CG2A', 'CG2B',
  'GPME1', 'GPME2',
  'NDRC1', 'NDRC2',
  'DCG1', 'DCG2'
]);
const dayNames = {
  monday: 'Lundi',
  tuesday: 'Mardi',
  wednesday: 'Mercredi',
  thursday: 'Jeudi',
  friday: 'Vendredi'
};

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

const loginForm = document.getElementById('loginForm');
const loginView = document.getElementById('loginView');
const dashboardView = document.getElementById('dashboardView');
const loginError = document.getElementById('loginError');
const submitBtn = loginForm.querySelector('button[type="submit"]');

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginError.style.display = 'none';
  submitBtn.disabled = true;
  submitBtn.textContent = 'Connexion en cours...';

  const email = document.getElementById('adminEmail').value.trim();
  const password = document.getElementById('adminPassword').value;

  try {
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

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await sbClient.auth.signOut();
  dashboardView.style.display = 'none';
  loginView.style.display = 'block';
  resetSubmitButton();
});

function showLoginError(message) {
  loginError.textContent = message;
  loginError.style.display = 'block';
}

function resetSubmitButton() {
  submitBtn.disabled = false;
  submitBtn.textContent = 'Se connecter';
}

async function initDashboard() {
  loginView.style.display = 'none';
  dashboardView.style.display = 'block';
  document.getElementById('weekInfo').textContent = `Semaine débutant le ${currentWeekStart}`;

  const { data, error } = await sbClient
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
    .eq('week_start', currentWeekStart)
    .order('student_class', { ascending: true })
    .order('student_name', { ascending: true });

  if (error) {
    alert(`Erreur lors de la lecture des données : ${error.message}`);
    return;
  }

  allRegistrations = (data || []).filter((registration) =>
    currentClasses.has(registration.student_class)
  );
  populateClassFilter();
  renderTable();
}

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

function getTodayData() {
  if (!currentDayKey) return [];
  return allRegistrations.filter((registration) => registration[currentDayKey] === true);
}

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

async function restoreSession() {
  const { data } = await sbClient.auth.getSession();
  if (data.session) await initDashboard();
}

document.getElementById('filterDay').addEventListener('change', () => {
  populateClassFilter();
  renderTable();
});
document.getElementById('filterClass').addEventListener('change', renderTable);

document.getElementById('exportBtn').addEventListener('click', () => {
  const dataToExport = getTodayData();
  const currentDay = currentDayKey || 'aucun-service';
  const dayLabel = currentDayKey ? dayNames[currentDayKey] : 'Jour';

  const rows = dataToExport.map((registration) => ({
    Nom: registration.student_name,
    Prénom: registration.student_first_name,
    Classe: registration.student_class,
    [dayLabel]: 'OUI'
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Inscrits');
  XLSX.writeFile(workbook, `cantine_${currentWeekStart}_${currentDay}.xlsx`);
});

restoreSession();
