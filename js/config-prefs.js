'use strict';

const CONFIG_PREFS_KEYS = {
  verbs:   'dansk-verb-config-prefs',
  nouns:   'dansk-noun-config-prefs',
  numbers: 'dansk-number-config-prefs',
  time:    'dansk-time-config-prefs',
};

function loadConfigPrefs(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function saveConfigPrefs(key, prefs) {
  try {
    localStorage.setItem(key, JSON.stringify(prefs));
  } catch (e) {
    // ignore quota / private-mode errors
  }
}

function setRadioValue(name, value) {
  const input = document.querySelector(`input[type="radio"][name="${name}"][value="${CSS.escape(value)}"]`);
  if (!input || input.disabled) {
    return false;
  }
  input.checked = true;
  const group = input.closest('.radio-group');
  if (group) {
    group.querySelectorAll('.radio-option').forEach(o => o.classList.remove('selected'));
  }
  const option = input.closest('.radio-option');
  if (option) {
    option.classList.add('selected');
  }
  return true;
}

function setCheckboxValues(name, values) {
  const valueSet = new Set(values);
  document.querySelectorAll(`input[type="checkbox"][name="${name}"]`).forEach(input => {
    input.checked = valueSet.has(input.value);
    const option = input.closest('.checkbox-option');
    if (option) {
      option.classList.toggle('selected', input.checked);
    }
  });
}

function getRadioValue(name) {
  const el = document.querySelector(`input[type="radio"][name="${name}"]:checked`);
  return el ? el.value : null;
}

function getCheckboxValues(name) {
  return [...document.querySelectorAll(`input[type="checkbox"][name="${name}"]:checked`)]
    .map(el => el.value);
}

function initRadioGroups(onChange) {
  document.querySelectorAll('.radio-group').forEach(group => {
    group.querySelectorAll('.radio-option:not(.disabled)').forEach(opt => {
      opt.addEventListener('click', () => {
        const radio = opt.querySelector('input[type="radio"]');
        if (!radio || radio.disabled) {
          return;
        }
        radio.checked = true;
        group.querySelectorAll('.radio-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        if (onChange) {
          onChange(radio.name, radio.value);
        }
      });
    });
  });
}

function applyCommonExercisePrefs(prefs, fields) {
  if (!prefs) {
    return;
  }
  fields.forEach(field => {
    const { name, key } = typeof field === 'string' ? { name: field, key: field } : field;
    if (prefs[key] != null) {
      setRadioValue(name, prefs[key]);
    }
  });
}
