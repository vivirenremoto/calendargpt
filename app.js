const monthNames = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const calendarTitle = document.getElementById('calendarTitle');
const calendarGrid = document.getElementById('calendarGrid');
const monthSelect = document.getElementById('monthSelect');
const yearInput = document.getElementById('yearInput');
const selectedDateTitle = document.getElementById('selectedDateTitle');
const noteForm = document.getElementById('noteForm');
const noteInput = document.getElementById('noteInput');
const notesList = document.getElementById('notesList');

const connectionStatus = document.getElementById('connectionStatus');

const state = {
  currentDate: new Date(),
  selectedKey: null,
  notes: {},
  supabase: null,
  connected: false
};

function keyFromDate(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseKey(key) {
  const [year, month, day] = key.split('-').map(Number);
  return { year, month: month - 1, day };
}

function toMonthRange(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const start = keyFromDate(year, month, 1);
  const end = keyFromDate(year, month, new Date(year, month + 1, 0).getDate());
  return { start, end };
}

function setStatus(text, isError = false) {
  connectionStatus.textContent = text;
  connectionStatus.style.color = isError ? '#b91c1c' : '#166534';
}


function populateMonthSelect() {
  monthNames.forEach((name, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = name;
    monthSelect.appendChild(option);
  });
}

function getMonthInfo(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weekdayOffset = (firstOfMonth.getDay() + 6) % 7;
  return { year, month, daysInMonth, weekdayOffset };
}

function renderCalendar() {
  const { year, month, daysInMonth, weekdayOffset } = getMonthInfo(state.currentDate);

  calendarTitle.textContent = `${monthNames[month]} ${year}`;
  monthSelect.value = String(month);
  yearInput.value = String(year);

  calendarGrid.innerHTML = '';

  for (let i = 0; i < weekdayOffset; i += 1) {
    const empty = document.createElement('div');
    empty.className = 'day-cell empty';
    calendarGrid.appendChild(empty);
  }

  const today = new Date();
  const todayKey = keyFromDate(today.getFullYear(), today.getMonth(), today.getDate());

  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = keyFromDate(year, month, day);
    const noteCount = (state.notes[key] || []).length;

    const btn = document.createElement('button');
    btn.className = 'day-cell';
    btn.type = 'button';
    btn.dataset.key = key;
    btn.innerHTML = `<span class="date">${day}</span>${noteCount ? `<span class="note-count">${noteCount} nota(s)</span>` : ''}`;

    if (key === todayKey) btn.classList.add('today');
    if (key === state.selectedKey) btn.classList.add('selected');

    btn.addEventListener('click', () => {
      state.selectedKey = key;
      renderCalendar();
      renderNotes();
    });

    calendarGrid.appendChild(btn);
  }
}

function renderNotes() {
  notesList.innerHTML = '';

  if (!state.selectedKey) {
    selectedDateTitle.textContent = 'Selecciona un día para ver y crear notas';
    return;
  }

  const { year, month, day } = parseKey(state.selectedKey);
  selectedDateTitle.textContent = `Notas para ${day} de ${monthNames[month]} de ${year}`;

  const items = state.notes[state.selectedKey] || [];
  if (!items.length) {
    const emptyItem = document.createElement('li');
    emptyItem.textContent = 'No hay notas todavía para este día.';
    notesList.appendChild(emptyItem);
    return;
  }

  items.forEach((noteRow) => {
    const li = document.createElement('li');
    li.className = 'note-item';

    const text = document.createElement('span');
    text.textContent = noteRow.content;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = 'Eliminar';
    removeBtn.addEventListener('click', async () => {
      if (!state.connected) {
        alert('Debes conectar Supabase antes de eliminar notas.');
        return;
      }

      const { error } = await state.supabase
        .from('notes')
        .delete()
        .eq('id', noteRow.id);

      if (error) {
        alert(`No se pudo eliminar la nota: ${error.message}`);
        return;
      }

      await loadMonthNotes();
      renderNotes();
    });

    li.append(text, removeBtn);
    notesList.appendChild(li);
  });
}

async function loadMonthNotes() {
  if (!state.connected) {
    state.notes = {};
    renderCalendar();
    return;
  }

  const { start, end } = toMonthRange(state.currentDate);
  const { data, error } = await state.supabase
    .from('notes')
    .select('id, note_date, content, created_at')
    .gte('note_date', start)
    .lte('note_date', end)
    .order('created_at', { ascending: true });

  if (error) {
    setStatus(`Error consultando notas: ${error.message}`, true);
    return;
  }

  state.notes = {};
  data.forEach((row) => {
    if (!state.notes[row.note_date]) {
      state.notes[row.note_date] = [];
    }
    state.notes[row.note_date].push(row);
  });

  renderCalendar();
}

async function jumpToSelectedDate() {
  const month = Number(monthSelect.value);
  const year = Number(yearInput.value);
  if (Number.isNaN(month) || Number.isNaN(year)) return;
  state.currentDate = new Date(year, month, 1);
  await loadMonthNotes();
}

async function connectSupabase(url, anonKey) {
  state.supabase = window.supabase.createClient(url, anonKey);

  const { error } = await state.supabase
    .from('notes')
    .select('id', { head: true, count: 'exact' })
    .limit(1);

  if (error) {
    state.connected = false;
    setStatus(`No se pudo conectar: ${error.message}`, true);
    return;
  }

  state.connected = true;
  setStatus('Conectado a Supabase ✅');
  await loadMonthNotes();
  renderNotes();
}

document.getElementById('prevMonth').addEventListener('click', async () => {
  const year = state.currentDate.getFullYear();
  const month = state.currentDate.getMonth();
  state.currentDate = new Date(year, month - 1, 1);
  await loadMonthNotes();
  renderNotes();
});

document.getElementById('nextMonth').addEventListener('click', async () => {
  const year = state.currentDate.getFullYear();
  const month = state.currentDate.getMonth();
  state.currentDate = new Date(year, month + 1, 1);
  await loadMonthNotes();
  renderNotes();
});

document.getElementById('goToDate').addEventListener('click', async () => {
  await jumpToSelectedDate();
  renderNotes();
});

document.getElementById('todayBtn').addEventListener('click', async () => {
  state.currentDate = new Date();
  await loadMonthNotes();
  renderNotes();
});


noteForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!state.connected) {
    alert('Debes conectar Supabase antes de guardar notas.');
    return;
  }

  if (!state.selectedKey) {
    alert('Primero selecciona un día en el calendario.');
    return;
  }

  const value = noteInput.value.trim();
  if (!value) return;

  const { error } = await state.supabase
    .from('notes')
    .insert({ note_date: state.selectedKey, content: value });

  if (error) {
    if (error.message && error.message.toLowerCase().includes('row-level security')) {
      alert('No se pudo guardar por RLS. Ejecuta SUPABASE_SETUP.sql en Supabase para crear políticas de insert/select/delete para anon.');
    } else {
      alert(`No se pudo guardar la nota: ${error.message}`);
    }
    return;
  }

  noteInput.value = '';
  await loadMonthNotes();
  renderNotes();
});

populateMonthSelect();
renderCalendar();
renderNotes();

const appConfig = window.APP_CONFIG || {};
if (appConfig.supabaseUrl && appConfig.supabaseAnonKey) {
  setStatus('Conectando automáticamente...');
  connectSupabase(appConfig.supabaseUrl, appConfig.supabaseAnonKey);
} else {
  setStatus('Falta configuración. Edita config.js con tu URL y Anon Key de Supabase.', true);
}
