// Expense & Budget Visualizer — app logic

// ── Constants ────────────────────────────────────────────────────────────────
const STARTING_BUDGET = 2_000_000;
const STORAGE_KEY = 'expense_transactions';
const CUSTOM_CATEGORIES_KEY = 'expense_custom_categories';
const DARK_MODE_KEY = 'expense_dark_mode';

// ── Custom category colors (in order) ────────────────────────────────────────
const CUSTOM_CATEGORY_COLORS = ['#A49132', '#000000', '#F675B3', '#FF812D', '#438BFF'];

// ── In-memory state ──────────────────────────────────────────────────────────
let transactions = [];
let customCategories = []; // array of { name, color }

// ── Helpers ──────────────────────────────────────────────────────────────────
function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Date.now() + '-' + Math.random();
}

// ── Persistence ──────────────────────────────────────────────────────────────
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    transactions = raw ? JSON.parse(raw) : [];
  } catch (_) {
    transactions = [];
  }
  try {
    const rawCats = localStorage.getItem(CUSTOM_CATEGORIES_KEY);
    customCategories = rawCats ? JSON.parse(rawCats) : [];
  } catch (_) {
    customCategories = [];
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  } catch (_) {
    // write errors are silently ignored; in-memory state remains valid
  }
}

function saveCustomCategories() {
  try {
    localStorage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify(customCategories));
  } catch (_) {}
}

// ── Formatting ────────────────────────────────────────────────────────────────
function formatRupiah(amount) {
  // Format as Rp1.000.000 — dot thousands separator, no decimals
  return 'Rp' + Math.floor(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// ── Balance Rendering ─────────────────────────────────────────────────────────
function renderBalance() {
  const totalExpense = transactions.reduce((sum, t) => sum + t.amount, 0);
  const totalBalance = STARTING_BUDGET - totalExpense;
  const overBudget = totalExpense > STARTING_BUDGET;

  const balanceEl = document.getElementById('balance-amount');
  const deductedEl = document.getElementById('balance-deducted');
  balanceEl.textContent = formatRupiah(totalBalance);
  deductedEl.textContent = '- ' + formatRupiah(totalExpense);

  balanceEl.classList.toggle('over-budget', overBudget);
  deductedEl.classList.toggle('over-budget', overBudget);
}

// ── Div-input helpers ─────────────────────────────────────────────────────────

/** Get text value from either a real input or a contenteditable div */
function getFieldValue(formEl, name) {
  const input = formEl.querySelector('input[name="' + name + '"]');
  if (input) return input.value;
  const div = formEl.querySelector('[data-name="' + name + '"]');
  return div ? div.textContent.trim() : '';
}

/** Set text value on either a real input or a contenteditable div */
function setFieldValue(formEl, name, value) {
  const input = formEl.querySelector('input[name="' + name + '"]');
  if (input) { input.value = value; return; }
  const div = formEl.querySelector('[data-name="' + name + '"]');
  if (div) div.textContent = value;
}

// ── Form Validation ───────────────────────────────────────────────────────────

/**
 * Clears all inline validation messages within a form element.
 * @param {HTMLFormElement} formEl
 */
function clearValidation(formEl) {
  formEl.querySelectorAll('.validation-msg').forEach(el => {
    el.textContent = '';
  });
}

/**
 * Validates the input form fields and shows inline error messages.
 * @param {HTMLFormElement} formEl
 * @returns {{ valid: boolean, errors: { item?: string, amount?: string, category?: string } }}
 */
function validateForm(formEl) {
  clearValidation(formEl);

  const itemError     = formEl.querySelector('[id$="item-error"]');
  const amountError   = formEl.querySelector('[id$="amount-error"]');
  const categoryError = formEl.querySelector('[id$="category-error"]');

  const errors = {};

  const itemValue = getFieldValue(formEl, 'item');
  if (!itemValue) {
    errors.item = 'Item name is required.';
    if (itemError) itemError.textContent = errors.item;
  }

  const rawAmount = getFieldValue(formEl, 'amount');
  const parsedAmount = parseFloat(rawAmount);
  if (!rawAmount) {
    errors.amount = 'Amount is required.';
    if (amountError) amountError.textContent = errors.amount;
  } else if (isNaN(parsedAmount)) {
    errors.amount = 'Amount has to be a number.';
    if (amountError) amountError.textContent = errors.amount;
  } else if (parsedAmount <= 0) {
    errors.amount = 'Amount must be greater than 0.';
    if (amountError) amountError.textContent = errors.amount;
  }

  const catDropdown = formEl.querySelector('.cat-dropdown');
  const categoryValue = catDropdown ? getCatDropdownValue(catDropdown) : '';
  if (!categoryValue) {
    errors.category = 'Please select a category.';
    if (categoryError) categoryError.textContent = errors.category;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

// ── Transaction Management ────────────────────────────────────────────────────

/**
 * Creates a new transaction and adds it to the in-memory list,
 * then persists and re-renders the UI.
 * @param {string} item
 * @param {number} amount
 * @param {string} category
 */
function addTransaction(item, amount, category) {
  const transaction = {
    id: generateId(),
    item: item.trim(),
    amount: Number(amount),
    category,
  };
  transactions.push(transaction);
  saveState();
  renderAll();
}

/**
 * Removes the transaction with the given id from the in-memory list,
 * then persists and re-renders the UI.
 * @param {string} id
 */
function deleteTransaction(id) {
  transactions = transactions.filter(function(t) { return t.id !== id; });
  saveState();
  renderAll();
}

/**
 * Resets all fields in a form to empty / default values.
 * @param {HTMLFormElement} formEl
 */
function clearForm(formEl) {
  formEl.querySelectorAll('input').forEach(function(input) { input.value = ''; });
  formEl.querySelectorAll('[data-name]').forEach(function(div) {
    if (!div.classList.contains('cat-dropdown')) div.textContent = '';
  });
  const catDropdown = formEl.querySelector('.cat-dropdown');
  if (catDropdown) setCatDropdownValue(catDropdown, '');
  clearValidation(formEl);
}

// ── Form Submit Wiring ────────────────────────────────────────────────────────

/**
 * Shared submit handler for both #input-form and #modal-form.
 * @param {Event} e
 * @param {{ isModal?: boolean }} options
 */
function handleFormSubmit(e, { isModal = false } = {}) {
  e.preventDefault();
  const formEl = e.currentTarget;
  const result = validateForm(formEl);

  if (!result.valid) return;

  const item     = getFieldValue(formEl, 'item');
  const amount   = parseFloat(getFieldValue(formEl, 'amount'));
  const catDropdown = formEl.querySelector('.cat-dropdown');
  const category = getCatDropdownValue(catDropdown);

  addTransaction(item, amount, category);
  clearForm(formEl);

  if (isModal) {
    closeModal();
  }
}

document.getElementById('input-form').addEventListener('submit', e => handleFormSubmit(e));
document.getElementById('modal-form').addEventListener('submit', e => handleFormSubmit(e, { isModal: true }));

// ── Transaction List Rendering ────────────────────────────────────────────────

/**
 * Rebuilds the transaction list DOM from the in-memory transactions array.
 * Each row contains: item name, amount as negative Rupiah, category label,
 * and a delete "X" button with data-id set to the transaction id.
 * Also updates #total-expense-amount with the current total.
 */
function renderList() {
  const listEl = document.getElementById('transaction-list');
  const totalExpenseEl = document.getElementById('total-expense-amount');

  listEl.innerHTML = '';

  transactions.forEach(function(t, index) {
    const li = document.createElement('li');
    li.className = 'transaction-item';

    const numSpan = document.createElement('span');
    numSpan.className = 'transaction-num';
    numSpan.textContent = index + 1;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'transaction-name';
    nameSpan.textContent = t.item;

    const amountSpan = document.createElement('span');
    amountSpan.className = 'transaction-amount';
    amountSpan.textContent = '-' + formatRupiah(t.amount);

    const categorySpan = document.createElement('span');
    categorySpan.className = 'transaction-category';
    categorySpan.textContent = t.category;
    categorySpan.style.color = getAllCategoryColors()[t.category] || '#000000';

    const deleteBtn = document.createElement('div');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = 'X';
    deleteBtn.setAttribute('data-id', t.id);
    deleteBtn.setAttribute('role', 'button');
    deleteBtn.setAttribute('tabindex', '0');
    deleteBtn.setAttribute('aria-label', 'Delete ' + t.item);
    const deleteHandler = (function(id) {
      return function() {
        showConfirmDialog(
          'Are you sure you want to delete this entry?',
          function() { deleteTransaction(id); },
          function() { /* dismiss — no-op */ }
        );
      };
    })(t.id);
    deleteBtn.addEventListener('click', deleteHandler);
    deleteBtn.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); deleteHandler(); }
    });

    li.appendChild(numSpan);
    li.appendChild(nameSpan);
    li.appendChild(amountSpan);
    li.appendChild(categorySpan);
    li.appendChild(deleteBtn);

    listEl.appendChild(li);
  });

  const totalExpense = transactions.reduce(function(sum, t) { return sum + t.amount; }, 0);
  totalExpenseEl.textContent = '-' + formatRupiah(totalExpense);
  totalExpenseEl.classList.toggle('over-budget', totalExpense > STARTING_BUDGET);
}

// ── Confirm Dialog ────────────────────────────────────────────────────────────

/**
 * Shows the reusable confirm dialog with a message and YES/NO buttons.
 * Uses one-time event listeners to avoid stacking handlers.
 * @param {string} message - Text to display in the dialog
 * @param {Function} onYes - Called when the user clicks YES
 * @param {Function} [onNo] - Called when the user clicks NO (optional)
 */
function showConfirmDialog(message, onYes, onNo) {
  const dialog = document.getElementById('confirm-dialog');
  const msgEl  = document.getElementById('confirm-message');
  const yesBtn = document.getElementById('confirm-yes');
  const noBtn  = document.getElementById('confirm-no');

  msgEl.textContent = message;
  // Always make dialog interactive regardless of body pointer-events
  dialog.style.pointerEvents = 'auto';
  dialog.style.userSelect = 'auto';
  dialog.removeAttribute('hidden');

  function hideDialog() {
    dialog.setAttribute('hidden', '');
  }

  function handleYes() {
    hideDialog();
    onYes();
  }

  function handleNo() {
    hideDialog();
    if (typeof onNo === 'function') onNo();
  }

  yesBtn.addEventListener('click', handleYes, { once: true });
  noBtn.addEventListener('click', handleNo, { once: true });
}

// ── Chart.js Integration ──────────────────────────────────────────────────────

const CATEGORY_COLORS = {
  Food:      '#32A452',
  Fun:       '#615c9b',
  Transport: '#A43232',
};

/** Returns merged color map including custom categories */
function getAllCategoryColors() {
  const map = Object.assign({}, CATEGORY_COLORS);
  customCategories.forEach(function(c) { map[c.name] = c.color; });
  return map;
}

let chart = null;

/**
 * Creates the Chart.js pie chart instance on the #expense-chart canvas.
 * If Chart.js failed to load from CDN, shows the #chart-fallback text instead.
 * The chart is initialized with empty data; renderChart() populates it.
 */
function initChart() {
  if (typeof Chart === 'undefined') {
    const fallback = document.getElementById('chart-fallback');
    if (fallback) fallback.removeAttribute('hidden');
    return;
  }

  const canvas = document.getElementById('expense-chart');
  chart = new Chart(canvas, {
    type: 'pie',
    data: {
      labels: [],
      datasets: [{
        data: [],
        backgroundColor: [],
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            boxWidth: 10,
            boxHeight: 10,
            padding: 16,
            color: '#000000',
          },
        },
        tooltip: {
          backgroundColor: '#ffffff',
          borderColor: '#365C77',
          borderWidth: 1,
          padding: 10,
          titleColor: '#000000',
          bodyColor: '#000000',
          displayColors: false,
          callbacks: {
            title: function(contexts) {
              return contexts[0] ? (contexts[0].label || '') : '';
            },
            label: function(context) {
              const amount = context.parsed || 0;
              return '-' + formatRupiah(amount);
            },
          },
        },
      },
    },
  });
}

/**
 * Updates the Chart.js instance with current category totals.
 * If chart is null (Chart.js failed to load), returns early.
 * Filters out categories with zero total before updating.
 */
function renderChart() {
  if (chart === null) return;

  const colorMap = getAllCategoryColors();
  const allCategories = Object.keys(colorMap);

  const labels = [];
  const data = [];
  const colors = [];

  allCategories.forEach(function(category) {
    const total = transactions
      .filter(function(t) { return t.category === category; })
      .reduce(function(sum, t) { return sum + t.amount; }, 0);
    if (total > 0) {
      labels.push(category);
      data.push(total);
      colors.push(colorMap[category]);
    }
  });

  chart.data.labels = labels;
  chart.data.datasets[0].data = data;
  chart.data.datasets[0].backgroundColor = colors;
  chart.update();
}

// ── renderAll ─────────────────────────────────────────────────────────────────
function renderAll() {
  renderBalance();
  renderList();
  renderChart();
}

// ── Modal open / close ────────────────────────────────────────────────────────

function openModal() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.removeAttribute('hidden');
  document.body.style.pointerEvents = 'none';
  document.body.style.userSelect = 'none';
  if (overlay) {
    overlay.style.pointerEvents = 'auto';
    overlay.style.userSelect = 'auto';
  }
  // Keep confirm dialog interactive too
  const confirmDialog = document.getElementById('confirm-dialog');
  if (confirmDialog) {
    confirmDialog.style.pointerEvents = 'auto';
    confirmDialog.style.userSelect = 'auto';
  }
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.setAttribute('hidden', '');
  // Restore full interactivity to the page
  document.body.style.pointerEvents = '';
  document.body.style.userSelect = '';
}

document.getElementById('add-btn').addEventListener('click', openModal);

// ── Modal overlay background click (Req 8.6, 8.7, 8.8, 8.9) ─────────────────
(function() {
  const overlay = document.getElementById('modal-overlay');
  overlay.addEventListener('click', function(e) {
    // Only trigger when clicking the overlay background itself, not the form container
    if (e.target !== overlay) return;

    const modalForm = document.getElementById('modal-form');
    const hasValue =
      getFieldValue(modalForm, 'item') !== '' ||
      getFieldValue(modalForm, 'amount') !== '' ||
      getCatDropdownValue(modalForm.querySelector('.cat-dropdown')) !== '';

    if (!hasValue) {
      closeModal();
    } else {
      showConfirmDialog(
        'ARE YOU SURE? THE ENTRY HASN\'T BEEN SUBMITTED',
        function onYes() { closeModal(); clearForm(modalForm); },
        function onNo() { /* dismiss dialog, keep modal open */ }
      );
    }
  });
})();

// ── Category div-dropdown ─────────────────────────────────────────────────────

const BUILT_IN_CATEGORIES = ['Food', 'Transport', 'Fun'];

/**
 * Get the selected category value from a cat-dropdown element.
 * Returns '' if nothing selected (placeholder showing).
 */
function getCatDropdownValue(dropEl) {
  return dropEl.dataset.value || '';
}

/** Set the displayed value on a cat-dropdown */
function setCatDropdownValue(dropEl, value) {
  const valSpan = dropEl.querySelector('.cat-dropdown-value');
  if (!value) {
    valSpan.textContent = valSpan.dataset.placeholder || 'Select Category';
    valSpan.classList.add('is-placeholder');
    delete dropEl.dataset.value;
  } else {
    valSpan.textContent = value;
    valSpan.classList.remove('is-placeholder');
    dropEl.dataset.value = value;
  }
}

/** Open a cat-dropdown panel */
function openCatDropdown(dropEl) {
  const panel = dropEl.querySelector('.cat-dropdown-panel');
  panel.removeAttribute('hidden');
  dropEl.setAttribute('aria-expanded', 'true');
}

/** Close a cat-dropdown panel */
function closeCatDropdown(dropEl) {
  const panel = dropEl.querySelector('.cat-dropdown-panel');
  panel.setAttribute('hidden', '');
  dropEl.setAttribute('aria-expanded', 'false');
}

/** Close all open dropdowns except optionally one */
function closeAllCatDropdowns(except) {
  document.querySelectorAll('.cat-dropdown').forEach(function(d) {
    if (d !== except) closeCatDropdown(d);
  });
}

/**
 * Rebuild the options inside a dropdown panel.
 * Keeps built-in options, syncs custom categories, and re-renders the add row.
 */
function rebuildDropdownPanel(dropEl) {
  const panel = dropEl.querySelector('.cat-dropdown-panel');
  const colorMap = getAllCategoryColors();

  // Remove all existing options and add-row (keep nothing)
  panel.innerHTML = '';

  // Built-in options
  BUILT_IN_CATEGORIES.forEach(function(name) {
    panel.appendChild(makeCatOption(name, colorMap[name], dropEl));
  });

  // Custom category options
  customCategories.forEach(function(c, idx) {
    const optEl = makeCatOption(c.name, c.color, dropEl);
    // Add delete button for custom categories
    const delBtn = document.createElement('button');
    delBtn.className = 'cat-custom-delete';
    delBtn.textContent = '×';
    delBtn.setAttribute('aria-label', 'Delete ' + c.name);
    delBtn.addEventListener('mousedown', function(e) {
      e.stopPropagation();
      e.preventDefault();
      customCategories.splice(idx, 1);
      saveCustomCategories();
      // If this category was selected, clear it
      document.querySelectorAll('.cat-dropdown').forEach(function(d) {
        if (getCatDropdownValue(d) === c.name) setCatDropdownValue(d, '');
      });
      rebuildAllDropdownPanels();
      renderAll();
    });
    optEl.appendChild(delBtn);
    panel.appendChild(optEl);
  });

  // Add row
  const addRow = document.createElement('div');
  addRow.className = 'cat-add-row' + (customCategories.length >= 5 ? ' is-max' : '');

  if (customCategories.length < 5) {
    const label = document.createElement('span');
    label.textContent = '+ Add a New Category';
    addRow.appendChild(label);

    addRow.addEventListener('mousedown', function(e) {
      e.stopPropagation();
      e.preventDefault();
      if (addRow.querySelector('.cat-new-input')) return;

      // Replace label with input div
      addRow.innerHTML = '';
      const inp = document.createElement('div');
      inp.className = 'cat-new-input';
      inp.contentEditable = 'true';
      inp.setAttribute('data-placeholder', 'Category name…');
      inp.setAttribute('role', 'textbox');
      inp.setAttribute('spellcheck', 'false');
      addRow.appendChild(inp);
      setTimeout(function() { inp.focus(); }, 0);

      // Stop all key events from bubbling to the dropdown handler
      inp.addEventListener('keydown', function(ev) {
        ev.stopPropagation();
        if (ev.key === 'Enter') {
          ev.preventDefault();
          const name = inp.textContent.trim();
          if (!name) return;
          if (customCategories.some(function(c) { return c.name.toLowerCase() === name.toLowerCase(); })) {
            inp.style.borderBottomColor = 'red';
            return;
          }
          const newCat = { name: name, color: CUSTOM_CATEGORY_COLORS[customCategories.length] };
          customCategories.push(newCat);
          saveCustomCategories();
          rebuildAllDropdownPanels();
          // Auto-select the new category in this dropdown
          setCatDropdownValue(dropEl, name);
          closeCatDropdown(dropEl);
        }
        if (ev.key === 'Escape') {
          rebuildAllDropdownPanels();
        }
      });

      inp.addEventListener('blur', function() {
        setTimeout(rebuildAllDropdownPanels, 150);
      });
    });
  } else {
    addRow.textContent = 'Max 5 custom categories reached.';
  }

  panel.appendChild(addRow);

  // Mark currently selected option
  const currentVal = getCatDropdownValue(dropEl);
  if (currentVal) {
    panel.querySelectorAll('.cat-option').forEach(function(opt) {
      opt.classList.toggle('is-selected', opt.dataset.value === currentVal);
    });
  }
}

function makeCatOption(name, color, dropEl) {
  const opt = document.createElement('div');
  opt.className = 'cat-option';
  opt.dataset.value = name;
  opt.setAttribute('role', 'option');

  const dot = document.createElement('span');
  dot.className = 'cat-option-dot';
  dot.style.backgroundColor = color || '#888';

  const label = document.createElement('span');
  label.textContent = name;

  opt.appendChild(dot);
  opt.appendChild(label);

  opt.addEventListener('mousedown', function(e) {
    e.preventDefault();
    setCatDropdownValue(dropEl, name);
    closeCatDropdown(dropEl);
    // Clear validation error
    const wrap = dropEl.closest('.input-wrap');
    if (wrap) {
      const errEl = wrap.querySelector('[id$="category-error"]');
      if (errEl) errEl.textContent = '';
    }
  });

  return opt;
}

function rebuildAllDropdownPanels() {
  document.querySelectorAll('.cat-dropdown').forEach(rebuildDropdownPanel);
}

/** Wire click/keyboard behaviour for a cat-dropdown */
function wireCatDropdown(dropEl) {
  rebuildDropdownPanel(dropEl);
  setCatDropdownValue(dropEl, ''); // start as placeholder

  dropEl.addEventListener('mousedown', function(e) {
    // Don't toggle if click was inside the panel
    if (e.target.closest('.cat-dropdown-panel')) return;
    e.preventDefault();
    const isOpen = dropEl.getAttribute('aria-expanded') === 'true';
    closeAllCatDropdowns(dropEl);
    if (isOpen) {
      closeCatDropdown(dropEl);
    } else {
      openCatDropdown(dropEl);
      dropEl.focus();
    }
  });

  dropEl.addEventListener('keydown', function(e) {
    const isOpen = dropEl.getAttribute('aria-expanded') === 'true';
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (isOpen) closeCatDropdown(dropEl); else openCatDropdown(dropEl);
    }
    if (e.key === 'Escape') closeCatDropdown(dropEl);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) openCatDropdown(dropEl);
      const opts = Array.from(dropEl.querySelectorAll('.cat-option'));
      const cur = opts.findIndex(function(o) { return o.classList.contains('is-focused'); });
      opts.forEach(function(o) { o.classList.remove('is-focused'); });
      let next = e.key === 'ArrowDown' ? cur + 1 : cur - 1;
      if (next < 0) next = opts.length - 1;
      if (next >= opts.length) next = 0;
      if (opts[next]) opts[next].classList.add('is-focused');
    }
    if (e.key === 'Enter') {
      const focused = dropEl.querySelector('.cat-option.is-focused');
      if (focused) {
        setCatDropdownValue(dropEl, focused.dataset.value);
        closeCatDropdown(dropEl);
      }
    }
  });

  // Close when focus leaves the dropdown
  dropEl.addEventListener('focusout', function(e) {
    if (!dropEl.contains(e.relatedTarget)) {
      setTimeout(function() {
        if (!dropEl.contains(document.activeElement)) closeCatDropdown(dropEl);
      }, 100);
    }
  });
}

// Close dropdowns when clicking outside
document.addEventListener('mousedown', function(e) {
  if (!e.target.closest('.cat-dropdown')) closeAllCatDropdowns();
});

// ── Dark Mode ─────────────────────────────────────────────────────────────────

function applyDarkMode(dark) {
  document.body.classList.toggle('dark', dark);
  const btn = document.getElementById('dark-mode-btn');
  if (btn) btn.textContent = dark ? '☀️' : '🌙';
  // Update chart legend text color
  if (chart) {
    chart.options.plugins.legend.labels.color = dark ? '#E8F0F7' : '#000000';
    chart.update();
  }
  try { localStorage.setItem(DARK_MODE_KEY, dark ? '1' : '0'); } catch (_) {}
}

// ── Live amount validation ────────────────────────────────────────────────────
function wireAmountValidation(formEl) {
  const amountDiv = formEl.querySelector('[data-name="amount"]');
  const amountError = formEl.querySelector('[id$="amount-error"]');
  if (!amountDiv || !amountError) return;

  amountDiv.addEventListener('input', function() {
    const raw = amountDiv.textContent.trim();
    if (raw === '') {
      amountError.textContent = '';
      return;
    }
    const parsed = parseFloat(raw);
    if (isNaN(parsed)) {
      amountError.textContent = 'Amount has to be a number.';
    } else if (parsed <= 0) {
      amountError.textContent = 'Amount must be greater than 0.';
    } else {
      amountError.textContent = '';
    }
  });
}

// ── Page Load ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  loadState();
  initChart();

  // Dark mode
  const savedDark = localStorage.getItem(DARK_MODE_KEY) === '1';
  applyDarkMode(savedDark);
  document.getElementById('dark-mode-btn').addEventListener('click', function() {
    applyDarkMode(!document.body.classList.contains('dark'));
  });

  // Category dropdowns
  document.querySelectorAll('.cat-dropdown').forEach(wireCatDropdown);

  renderAll();
  wireAmountValidation(document.getElementById('input-form'));
  wireAmountValidation(document.getElementById('modal-form'));
});
