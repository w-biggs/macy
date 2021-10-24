const medicationTables = document.querySelectorAll('table.medication');

const hideEditAdd = function hideEditAdd() {
  const editButtons = document.querySelectorAll('button.edit');

  editButtons.forEach((editButton) => {
    editButton.setAttribute('hidden', true);
  })

  const deleteButtons = document.querySelectorAll('button.delete');

  deleteButtons.forEach((deleteButton) => {
    deleteButton.setAttribute('hidden', true);
  })

  const addButtons = document.querySelectorAll('.add-medication');

  addButtons.forEach((addButton) => {
    addButton.setAttribute('hidden', true);
  })

  document.getElementById('newmemberbutton').setAttribute('hidden', true);
};

const nameInput = function nameInput(value = '') {
  const nameInput = document.createElement('input');
  nameInput.setAttribute('type', 'text');
  nameInput.setAttribute('name', 'name');
  nameInput.id = 'name';
  nameInput.classList.add('uk-input');
  nameInput.value = value;
  return nameInput;
};

const timeInput = function timeInput(value = '') {
  const timeInput = document.createElement('input');
  timeInput.setAttribute('type', 'time');
  timeInput.setAttribute('name', 'time');
  timeInput.id = 'time';
  timeInput.classList.add('uk-input', 'uk-form-width-small');
  timeInput.value = value;
  return timeInput;
};

const saveButton = function saveButton(medId = '', profileId = '') {
  const medButton = document.createElement('button');
  medButton.classList.add('uk-button', 'uk-button-text', 'save');
  medButton.textContent = 'save';
  if (medId) {
    medButton.dataset.medid = medId;
  }
  medButton.dataset.profileid = profileId;
  medButton.addEventListener('click', (event) => {
    event.preventDefault;
    const name = document.getElementById('name').value;
    const time = document.getElementById('time').value;
    const [hh, mm] = time.split(':');
    const minutes = (parseInt(hh, 10) * 60) + parseInt(mm, 10);
    const medId = medButton.dataset.medid ?? '';
    console.log(name, minutes, medId);
    medButton.parentElement.textContent = 'saving...';
    const request = fetch('/save/medication', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-cache',
      body: JSON.stringify({
        name,
        time: minutes,
        medId,
        profileId: medButton.dataset.profileid
      })
    })
    .then(response => response.json())
    .then(data => {
      console.log('Success:', data);
      window.location.reload();
    })
    .catch((error) => {
      console.error('Error:', error);
    });
  });
  return medButton;
};

const editRow = function editRow(row) {
  const nameCell = row.querySelector('.medication-name');
  const name = nameCell.textContent.trim();
  nameCell.textContent = '';
  nameCell.appendChild(nameInput(name));

  const timeCell = row.querySelector('.medication-time');
  const timeDate = timeCell.dataset.time24h;
  timeCell.textContent = '';
  timeCell.appendChild(timeInput(timeDate));

  const buttonCell = row.querySelector('.medication-button');
  const medId = buttonCell.querySelector('button').dataset.medid;
  const profileId = buttonCell.querySelector('button').dataset.profileid;
  buttonCell.textContent = '';
  buttonCell.appendChild(saveButton(medId, profileId));
};

medicationTables.forEach((table) => {
  const rows = table.querySelectorAll('tbody tr');
  rows.forEach((row) => {  
    const editButton = row.querySelector('button.edit');
    if (editButton) {
      editButton.addEventListener('click', (event) => {
        event.preventDefault;
        hideEditAdd();
        editRow(row);
      });
    }
    const deleteButton = row.querySelector('button.delete');
    if (deleteButton) {
      deleteButton.addEventListener('click', (event) => {
        event.preventDefault;
        hideEditAdd();
        const request = fetch('/delete/medication', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-cache',
          body: JSON.stringify({
            medId: deleteButton.dataset.medid,
            profileId: deleteButton.dataset.profileid
          })
        })
        .then(response => response.json())
        .then(data => {
          console.log('Success:', data);
          window.location.reload();
        })
        .catch((error) => {
          console.error('Error:', error);
        });
      });
    }
  });

  const addButton = table.querySelector('.add-medication');
  addButton.addEventListener('click', (event) => {
    event.preventDefault;
    hideEditAdd();
    
    const newRow = document.createElement('tr');
    const nameCell = document.createElement('td');
    nameCell.classList.add('uk-width-medium', 'medication-name');
    nameCell.appendChild(nameInput());
    newRow.appendChild(nameCell);

    const timeCell = document.createElement('td');
    timeCell.classList.add('medication-time')
    timeCell.appendChild(timeInput());
    newRow.appendChild(timeCell);

    const buttonCell = document.createElement('td');
    buttonCell.classList.add('medication-button');
    buttonCell.appendChild(saveButton('', addButton.dataset.profileid));
    newRow.appendChild(buttonCell);

    const tableBody = table.querySelector('tbody');
    tableBody.appendChild(newRow);
  });
});

const newMemberButton = document.getElementById('newmemberbutton');
newMemberButton.addEventListener('click', (event) => {
  event.preventDefault();
  hideEditAdd();

  const name = document.getElementById('membername').value;
  const request = fetch('/save/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-cache',
    body: JSON.stringify({
      name,
      userId: newMemberButton.dataset.userid
    })
  })
  .then(response => response.json())
  .then(data => {
    console.log('Success:', data);
    window.location.reload();
  })
  .catch((error) => {
    console.error('Error:', error);
  });
});