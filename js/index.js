// Je garde l'adresse et la clé publique du projet utilisées par le navigateur.
const SUPABASE_URL = "https://hxgylzfctfeelzetfnwj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4Z3lsemZjdGZlZWx6ZXRmbndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxNzM0MDIsImV4cCI6MjEwNTc0OTQwMn0.4frUb93cHbh5qhhtv9i317HrCNj6MfFrENVXTY154IQ";

// Je crée le client qui me permet de communiquer avec Supabase.
const sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});

// Je mets à jour l'heure affichée avec le format français.
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

// Je choisis le lundi de la semaine affichée, en ouvrant la suivante vendredi à 20 h.
function getCurrentMonday() {
  const date = new Date();
  const day = date.getDay();

  // Je passe à la semaine suivante le vendredi soir et pendant tout le week-end.
  if ((day === 5 && date.getHours() >= 20) || day === 6 || day === 0) {
    date.setDate(date.getDate() + ((8 - day) % 7));
  }

  const adjustedDay = date.getDay();
  const daysSinceMonday = (adjustedDay + 6) % 7;

  date.setDate(date.getDate() - daysSinceMonday);
  date.setHours(12, 0, 0, 0);
  return date;
}

// Je formate la date en heure locale pour l'enregistrer sans décalage de fuseau.
function formatDateForDatabase(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Je garde en mémoire le lundi choisi pour l'affichage et l'inscription.
const currentMonday = getCurrentMonday();
const formattedMonday = currentMonday.toLocaleDateString('fr-FR', {
  day: 'numeric',
  month: 'long'
});

document.getElementById('weekBadge').textContent = `Semaine du ${formattedMonday}`;
updateClock();
// Je vérifie régulièrement si la semaine a changé pendant que la page est ouverte.
setInterval(() => {
  updateClock();

  if (getCurrentMonday().getTime() !== currentMonday.getTime()) {
    window.location.reload();
  }
}, 30000);

// Je relie chaque jour à son libellé et à son décalage depuis le lundi.
const dayConfig = [
  { key: 'monday', name: 'Lundi', dayIndex: 1, offset: 0 },
  { key: 'tuesday', name: 'Mardi', dayIndex: 2, offset: 1 },
  { key: 'wednesday', name: 'Mercredi', dayIndex: 3, offset: 2 },
  { key: 'thursday', name: 'Jeudi', dayIndex: 4, offset: 3 },
  { key: 'friday', name: 'Vendredi', dayIndex: 5, offset: 4 }
];

// Je bloque les jours passés ou clôturés, sauf quand j'affiche déjà la semaine suivante.
function configureDays() {
  const now = new Date();
  const currentDayOfWeek = now.getDay();
  const currentHour = now.getHours();
  const isWeekend = currentDayOfWeek === 6 || currentDayOfWeek === 0;
  const isNextWeekOpen = isWeekend || (currentDayOfWeek === 5 && currentHour >= 20);

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

    if (!isNextWeekOpen && (isPast || isTodayLocked || isWeekend)) {
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

// Je coche uniquement les jours qui restent disponibles.
document.getElementById('selectAllBtn').addEventListener('click', (event) => {
  event.preventDefault();
  document.querySelectorAll('.day-cb').forEach((checkbox) => {
    if (!checkbox.disabled) checkbox.checked = true;
  });
});

// Je vide la sélection sans réactiver les jours qui sont déjà clôturés.
document.getElementById('clearAllBtn').addEventListener('click', (event) => {
  event.preventDefault();
  document.querySelectorAll('.day-cb').forEach((checkbox) => {
    if (!checkbox.disabled) checkbox.checked = false;
  });
});

const form = document.getElementById('lunchForm');
const submitBtn = document.getElementById('submitBtn');
const statusBox = document.getElementById('statusBox');
const reservationTicket = document.getElementById('reservationTicket');

// Je vérifie la sélection puis j'envoie l'inscription à Supabase.
form.addEventListener('submit', async (event) => {
  event.preventDefault();

  // Je laisse les champs cachés servir de piège aux robots.
  if (document.getElementById('website').value) return;

  // Je refuse une inscription qui ne contient aucun jour de repas.
  const activeCheckedDays = Array.from(document.querySelectorAll('.day-cb:checked'));
  if (activeCheckedDays.length === 0) {
    showStatus('Sélectionne au moins un jour disponible.', false);
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Enregistrement en cours...';

  // Je prépare les données avec les noms de colonnes attendus par la base.
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
    // Je crée une ligne d'inscription dans la table dédiée.
    const { error } = await sbClient
      .from('registrations')
      .insert(payload);

    if (error) {
      // Je traduis l'erreur d'unicité en message plus compréhensible.
      if (error.code === '23505') {
        throw new Error('Cette inscription existe déjà pour cette semaine.');
      }

      throw error;
    }

    // Je ne montre le ticket qu'après avoir reçu la confirmation de l'enregistrement.
    displayReservationTicket(payload, new Date());
  } catch (error) {
    // Je montre une erreur utile et je la garde dans la console pour le diagnostic.
    console.error(error);
    const details = error?.message || "Erreur inconnue";
    showStatus(`Erreur lors de l'enregistrement : ${details}`, false);
  } finally {
    // Je réactive le bouton, que l'enregistrement ait réussi ou échoué.
    submitBtn.disabled = false;
    submitBtn.textContent = 'Valider mon inscription';
  }
});

// Je compose le ticket à partir des données enregistrées et de l'heure de confirmation.
function displayReservationTicket(payload, validatedAt) {
  const weekEnd = new Date(currentMonday);
  weekEnd.setDate(weekEnd.getDate() + 4);

  const reservedDays = dayConfig
    .filter((day) => payload[day.key])
    .map((day) => day.name);
  const formattedDate = validatedAt.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const formattedTime = validatedAt.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit'
  }).replace(':', 'h');

  document.getElementById('ticketStudentName').textContent = payload.student_name;
  document.getElementById('ticketStudentFirstName').textContent = payload.student_first_name;
  document.getElementById('ticketStudentClass').textContent = payload.student_class;
  document.getElementById('ticketWeek').textContent = `Du ${currentMonday.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long'
  })} au ${weekEnd.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })}`;
  document.getElementById('ticketDays').textContent = reservedDays.join(', ');
  document.getElementById('ticketValidatedAt').textContent = `Validé le ${formattedDate} à ${formattedTime}`;

  // Je remplace le formulaire par le ticket et je place le focus sur son titre.
  form.hidden = true;
  reservationTicket.hidden = false;
  document.getElementById('ticketTitle').focus();
}

// Je centralise l'affichage des messages de confirmation et d'erreur.
function showStatus(message, isSuccess) {
  statusBox.textContent = message;
  statusBox.className = `status-msg ${isSuccess ? 'status-success' : 'status-error'}`;
  statusBox.style.display = 'block';
}
