const SUPABASE_URL = "https://hxgylzfctfeelzetfnwj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4Z3lsemZjdGZlZWx6ZXRmbndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxNzM0MDIsImV4cCI6MjEwNTc0OTQwMn0.4frUb93cHbh5qhhtv9i317HrCNj6MfFrENVXTY154IQ";

const sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function updateClock() {
  const now = new Date();
  const options = {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit'
  };

  document.getElementById('liveClock').textContent = now.toLocaleDateString('fr-FR', options);
}

function getCurrentMonday() {
  const date = new Date();
  const day = date.getDay();
  const daysSinceMonday = (day + 6) % 7;

  date.setDate(date.getDate() - daysSinceMonday);
  date.setHours(12, 0, 0, 0);
  return date;
}

function formatDateForDatabase(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const currentMonday = getCurrentMonday();
const formattedMonday = currentMonday.toLocaleDateString('fr-FR', {
  day: 'numeric',
  month: 'long'
});

document.getElementById('weekBadge').textContent = `Semaine du ${formattedMonday}`;
updateClock();
setInterval(updateClock, 30000);

const dayConfig = [
  { key: 'monday', name: 'Lundi', dayIndex: 1, offset: 0 },
  { key: 'tuesday', name: 'Mardi', dayIndex: 2, offset: 1 },
  { key: 'wednesday', name: 'Mercredi', dayIndex: 3, offset: 2 },
  { key: 'thursday', name: 'Jeudi', dayIndex: 4, offset: 3 },
  { key: 'friday', name: 'Vendredi', dayIndex: 5, offset: 4 }
];

function configureDays() {
  const now = new Date();
  const currentDayOfWeek = now.getDay();
  const currentHour = now.getHours();
  const isWeekend = currentDayOfWeek === 6 || currentDayOfWeek === 0;

  dayConfig.forEach((item) => {
    const dateOfItem = new Date(currentMonday);
    dateOfItem.setDate(currentMonday.getDate() + item.offset);

    const dayNum = String(dateOfItem.getDate()).padStart(2, '0');
    const monthNum = String(dateOfItem.getMonth() + 1).padStart(2, '0');
    const dateStr = `${dayNum}/${monthNum}`;

    const labelElement = document.getElementById(`label-${item.key}`);
    const checkbox = document.getElementById(`cb-${item.key}`);
    const container = document.getElementById(`container-${item.key}`);

    labelElement.textContent = `${item.name} ${dateStr}`;

    const isPast = currentDayOfWeek > item.dayIndex && !isWeekend;
    const isTodayLocked = currentDayOfWeek === item.dayIndex && currentHour >= 8;

    if (isPast || isTodayLocked || isWeekend) {
      checkbox.disabled = true;
      container.classList.add('disabled');

      const lockTag = document.createElement('span');
      lockTag.className = 'day-lock-tag';
      lockTag.textContent = isTodayLocked ? 'Clôturé (8h)' : 'Passé';
      labelElement.appendChild(lockTag);
    }
  });
}

configureDays();

document.getElementById('selectAllBtn').addEventListener('click', (event) => {
  event.preventDefault();
  document.querySelectorAll('.day-cb').forEach((checkbox) => {
    if (!checkbox.disabled) checkbox.checked = true;
  });
});

document.getElementById('clearAllBtn').addEventListener('click', (event) => {
  event.preventDefault();
  document.querySelectorAll('.day-cb').forEach((checkbox) => {
    if (!checkbox.disabled) checkbox.checked = false;
  });
});

const form = document.getElementById('lunchForm');
const submitBtn = document.getElementById('submitBtn');
const statusBox = document.getElementById('statusBox');

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (document.getElementById('website').value) return;

  const activeCheckedDays = Array.from(document.querySelectorAll('.day-cb:checked'));
  if (activeCheckedDays.length === 0) {
    showStatus('Sélectionne au moins un jour disponible.', false);
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Enregistrement en cours...';

  const payload = {
    student_name: document.getElementById('studentName').value.trim().toUpperCase(),
    student_first_name: document.getElementById('studentFirstName').value.trim(),
    student_class: document.getElementById('studentClass').value,
    week_start: formatDateForDatabase(currentMonday),
    monday: document.getElementById('cb-monday').checked,
    tuesday: document.getElementById('cb-tuesday').checked,
    wednesday: document.getElementById('cb-wednesday').checked,
    thursday: document.getElementById('cb-thursday').checked,
    friday: document.getElementById('cb-friday').checked
  };

  try {
    const { error } = await sbClient
      .from('registrations')
      .insert(payload);

    if (error) {
      if (error.code === '23505') {
        throw new Error('Cette inscription existe déjà pour cette semaine.');
      }

      throw error;
    }

    showStatus('Inscription enregistrée avec succès !', true);
    form.reset();
    document.querySelectorAll('.day-cb').forEach((checkbox) => {
      if (!checkbox.disabled) checkbox.checked = false;
    });
  } catch (error) {
    console.error(error);
    const details = error?.message || "Erreur inconnue";
    showStatus(`Erreur lors de l'enregistrement : ${details}`, false);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Valider mon inscription';
  }
});

function showStatus(message, isSuccess) {
  statusBox.textContent = message;
  statusBox.className = `status-msg ${isSuccess ? 'status-success' : 'status-error'}`;
  statusBox.style.display = 'block';
}
