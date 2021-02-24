import 'core-js/stable';
// // FOR ASYNC POLIFILLING ASYNC FUNCTION
import 'regenerator-runtime/runtime';
import 'leaflet';

import icons from 'url:../svg/sprite.svg';
import logoIcon from 'url:../img/icon.png';
import * as model from './model.js';

// APPLICATION ARCHITECTURE
const containerMap = document.querySelector('.map');
const sidebar = document.querySelector('.side-bar');
const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const containerMenu = document.querySelector('.menu');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const btnClose = document.querySelector('.error__btn--close');
const windowError = document.querySelector('.error-window');
const overlay = document.querySelector('.overlay');
const textError = document.querySelector('.error__text');

class App {
  _map;
  _mapEvent;
  _workouts = [];
  _mapZoomLevel = 13;
  _editChecker = false;
  _selectedWorkout;
  _selectedWorkoutEl;

  constructor() {
    this._getPosition();
    this._defaultElevationField();
    this._workouts = model.getLocalStorage();
    this._renderWorkoutInSequence();

    form.addEventListener('submit', this._controlWokrout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    // prettier-ignore
    containerWorkouts.addEventListener('click', this._moveToPopupOnList.bind(this));
    containerMap.addEventListener('click', this._moveToPopupOnMap.bind(this));
    sidebar.addEventListener('click', this._closeMenuOnClickOutside.bind(this));
    sidebar.addEventListener('click', this._renderMenu.bind(this));
    containerWorkouts.addEventListener('click', this._controlMenu.bind(this));
    btnClose.addEventListener('click', this._closeErrorMsg);
    overlay.addEventListener('click', this._closeErrorMsg);
  }

  /// GET WORKOUT DATA IN SEQUENCE (IN ORDER TO USE THE SORT FUNCTION BUT IT GIVES HORRIBLE LOADING TIME) (IF USE FOREACH IT WILL GIVE MUCH BETTER PERFORMANCE BUT THE LISTS ARE UNORDERED)
  async _renderWorkoutInSequence() {
    for (const work of this._workouts) {
      await this._renderWorkout(work);
    }
  }
  // GET POSITION FROM GEO API
  _getPosition() {
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(this._loadMap.bind(this), () =>
        // prettier-ignore
        this._displayErrorMsg('Fail to load your position. </br>Please allow location access of this site to access your location🗺')
      );
  }

  // LOAD MAP FROM LEAFLET LIBRARY
  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;
    const coords = [latitude, longitude];

    this._map = L.map('map').setView(coords, this._mapZoomLevel);

    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this._map);

    // SHOW FORM BY CLICKING ON MAP
    this._map.on('click', this._showForm.bind(this));

    // RENDER MARKER AFTER LOADING A MAP
    this._workouts.forEach((work) => this._renderWorkoutMarker(work));

    // ZOOM TO FIT ALL WORKOUT MARKERS
    if (this._workouts.length === [].length) return;

    const allCoords = this._workouts.map((workout) => workout.coords);
    this._map.fitBounds(allCoords, { padding: [150, 150] });
  }

  // DESCRIPTION FROM DATE AND TYPE OF WORKOUT
  _setDescription(workout) {
    if (workout.type === 'running')
      return `${workout.type.replace(
        workout.type[0],
        workout.type[0].toUpperCase()
      )} on ${workout.dateDescription}`;

    if (workout.type === 'cycling')
      return `${workout.type.replace(
        workout.type[0],
        workout.type[0].toUpperCase()
      )} on ${workout.dateDescription}`;
  }

  // SHOW NEW FORM WHEN EDIT FORM IS OPENED AND CLEAR INPUT FIELDS
  _showBrandNewForm(mapE) {
    this._showForm(mapE);
    this._editChecker = false;
  }

  _showForm(mapE) {
    form.classList.remove('hidden');
    this._clearInputFields();
    inputDistance.focus();
    // mapE = EVENT TO GET LOCATION FROM LEAFLET MAP
    this._mapEvent = mapE;
  }

  _showEditForm(workout) {
    // CONVERT WORKOUT COORDS ARRAY TO OBJECT TO FIT MAP EVENT FORMAT
    const coords = workout.coords;
    const objCoords = {
      latlng: {
        lat: coords[0],
        lng: coords[1],
      },
    };

    this._showForm(objCoords);

    inputType.value = workout.type;
    inputDistance.value = workout.distance;
    inputDuration.value = workout.duration;

    if (inputType.value === 'running') inputCadence.value = workout.cadence;
    if (inputType.value === 'cycling')
      inputElevation.value = workout.elevationGain;

    this._editChecker = true;
  }

  _hideForm() {
    // CLEAR INPUT FIELDS
    this._clearInputFields();

    // TRICK TO PREVENT ANIMATION
    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _clearInputFields() {
    inputDuration.value = inputDistance.value = inputCadence.value = inputElevation.value =
      '';
  }

  _closeErrorMsg() {
    overlay.classList.add('hidden');
    windowError.classList.add('hidden');
  }

  _displayErrorMsg(
    msg = `⚠️ Characters or Symbols and Negative Numbers are NOT allowed for inputs.⚠️ <br />
  Only Positive Numbers are permitted unless elevation field. <br />
  On elevation input, Negative number is good to put!😄`
  ) {
    textError.innerHTML = msg;
    overlay.classList.remove('hidden');
    windowError.classList.remove('hidden');
  }

  _controlWokrout(e) {
    e.preventDefault();

    if (this._editChecker === false) {
      this._newWorkout();
    }
    if (this._editChecker === true) {
      this._editWorkout(this._selectedWorkout);
      this._editChecker = false;
    }
  }

  _editWorkout(workout) {
    const type = inputType.value;
    const duration = +inputDuration.value;
    const distance = +inputDistance.value;
    const cadence = +inputCadence.value;
    const elevation = +inputElevation.value;

    // VALIDATION HELPER FUNCTION
    const isNumber = (...inputs) =>
      inputs.every((input) => Number.isFinite(input));
    const isPositive = (...inputs) => inputs.every((input) => input > 0);

    // SET INPUT VALUE IN LOCAL STORAGE
    workout.type = type;
    workout.duration = duration;
    workout.distance = distance;

    if (type === 'running') {
      if (
        !isNumber(duration, distance, cadence) ||
        !isPositive(duration, distance, cadence)
      )
        return this._displayErrorMsg();

      workout.cadence = cadence;
      workout.pace = duration / distance;
    }
    if (type === 'cycling') {
      if (
        !isNumber(duration, distance, elevation) ||
        !isPositive(duration, distance)
      )
        return this._displayErrorMsg();

      workout.elevationGain = elevation;
      workout.speed = distance / (duration / 60);
    }

    this._hideForm();
    model.setLocalStorage(this._workouts);

    location.reload();
  }

  _newWorkout() {
    // GET DATA FROM FORM
    const type = inputType.value;
    const duration = +inputDuration.value;
    const distance = +inputDistance.value;
    const cadence = +inputCadence.value;
    const elevation = +inputElevation.value;
    const { lat, lng } = this._mapEvent.latlng;

    let workout;

    // VALIDATION HELPER FUNCTION
    const isNumber = (...inputs) =>
      inputs.every((input) => Number.isFinite(input));
    const isPositive = (...inputs) => inputs.every((input) => input > 0);

    // IF WORKOUT IS RUNNING, CREATE RUNNING OBJECT
    if (type === 'running') {
      // CHECK IF DATA IS VALID
      if (
        !isNumber(duration, distance, cadence) ||
        !isPositive(duration, distance, cadence)
      )
        return this._displayErrorMsg();

      workout = new model.Running([lat, lng], distance, duration, cadence);
    }

    // IF WORKOUT IS CYCLING, CREATE CYCLING OBJECT
    if (type === 'cycling') {
      // CHECK IF DATA IS VALID
      if (
        !isNumber(duration, distance, elevation) ||
        !isPositive(duration, distance)
      )
        return this._displayErrorMsg();

      workout = new model.Cycling([lat, lng], distance, duration, elevation);
    }

    // ADD NEW OBJECT TO WORKOUTS ARRAY
    this._workouts.push(workout);

    // RENDER WORKOUT ON MAP AS A MARKER
    this._renderWorkoutMarker(workout);

    // RENDER WORKOUT ON LIST
    this._renderWorkout(workout);

    // HIDE FORM + clear input fields
    this._hideForm();
    // SET WORKOUT TO LOCAL STORAGE
    console.log(this._workouts);
    model.setLocalStorage(this._workouts);
  }

  async _renderWorkout(workout) {
    const data = await model.getGeoCode(workout);
    const weather = await model.showWeatherIcon(workout);

    // APPLICABLE HTML FOR BOTH
    let html = `
      <li class="workout workout__${workout.type}" data-id="${workout.id}">
          <div class="menu menu__hidden">
            <ul class="menu__list">
              <li class="menu__item menu__item--edit">
                <svg class="menu__icon">
                  <use xlink:href="${icons}#icon-pencil"></use>
                </svg>
                <span>Edit form</span>
              </li>
              <li class="menu__item menu__item--delete">
                <svg class="menu__icon">
                  <use xlink:href="${icons}#icon-trash"></use>
                </svg>
                <span>Delete this list</span>
              </li>
              <li class="menu__item menu__item--clear">
                <svg class="menu__icon">
                  <use xlink:href="${icons}#icon-trash"></use>
                </svg>
                <span>Clear all lists</span>
              </li>
              <li class="menu__item menu__item--sort">
                <svg class="menu__icon">
                  <use xlink:href="${icons}#icon-chevron-down"></use>
                </svg>
                <span>Sort by</span><span class="menu__sort--text">(km, date)</span>
              </li>
            </ul>
          </div>

          <h2 class="workout__title">${this._setDescription(workout)}${
      data ? ',' : ''
    }
          ${data ?? ''} <img class="workout__weather" src="${weather}"/>

          </h2>
          <svg class="workout__icon">
            <use xlink:href="${icons}#icon-dots-three-horizontal"></use>
          </svg>
          <div class="workout__details">
            <span class="workout__imoji workout__imoji--type">${
              workout.type === 'running' ? '🏃‍♂' : '🚴‍♀️'
            }</span>
            <span class="workout__value workout__value--distance">${
              workout.distance
            }</span>
            <span class="workout__unit">km</span>
          </div>
          <div class="workout__details">
            <span class="workout__imoji">⏱</span>
            <span class="workout__value workout__value--duration">${
              workout.duration
            }</span>
            <span class="workout__unit">min</span>
          </div>
    `;

    // HTML FOR RUNNING
    if (workout.type === 'running') {
      html += `
          <div class="workout__details">
            <span class="workout__imoji">⚡️</span>
            <span class="workout__value workout__value--pace">${workout.pace.toFixed(
              1
            )}</span>
            <span class="workout__unit">min/km</span>
          </div>
          <div class="workout__details">
            <span class="workout__imoji">🦶🏼</span>
            <span class="workout__value workout__value--cadence">${
              workout.cadence
            }</span>
            <span class="workout__unit">spm</span>
          </div>
        </li>
      `;
    }

    // HTML FOR CYCLING
    if (workout.type === 'cycling') {
      html += `
          <div class="workout__details">
            <span class="workout__imoji">⚡️</span>
            <span class="workout__value workout__value--speed">${workout.speed.toFixed(
              1
            )}</span>
            <span class="workout__unit">min/km</span>
          </div>
          <div class="workout__details">
            <span class="workout__imoji">⛰</span>
            <span class="workout__value workout__value--elevation">${
              workout.elevationGain
            }</span>
            <span class="workout__unit">m</span>
          </div>
        </li>
      `;
    }

    form.insertAdjacentHTML('afterend', html);
  }

  _renderWorkoutMarker(workout) {
    const myIcon = L.icon({
      iconUrl: logoIcon,
      iconSize: [46, 46],
      iconAnchor: [22, 94],
      popupAnchor: [0, -90],
      className: `${workout.id}`,
    });

    L.marker(workout.coords, { icon: myIcon })
      .addTo(this._map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup ${workout.id}`,
        })
      )
      .setPopupContent(this._setDescription(workout))
      .openPopup();
  }

  // CLICK ON OUTSIDE OF MENU, CLOSE MENU
  _closeMenuOnClickOutside(e) {
    if (e.target.closest('.menu__item') !== null) return;

    this._closeMenu();
  }

  _closeMenu() {
    const menus = sidebar.querySelectorAll('.menu');

    menus.forEach((menu) => {
      if (menu.classList.contains('menu__hidden')) return;
      menu.classList.add('menu__hidden');
      menu.style.display = 'none';
    });
  }

  // CLICK ON THREE DOTS ICON RENDER POP-UP MENU
  _renderMenu(e) {
    if (e.target.tagName !== 'svg' && e.target.tagName !== 'use') return;

    const menu = e.target.closest('.workout').querySelector('.menu');
    menu.style.display = 'block';
    setTimeout(() => menu.classList.remove('menu__hidden'), 10);
  }

  // SET DEFAULT FIELD (PREVENTING FROM SMALL BUG)
  _defaultElevationField() {
    if (inputType.value === 'running') {
      inputCadence.closest('.form__row').classList.remove('form__row--hidden');
      inputElevation.closest('.form__row').classList.add('form__row--hidden');
    }

    if (inputType.value === 'cycling') {
      inputCadence.closest('.form__row').classList.add('form__row--hidden');
      //prettier-ignore
      inputElevation.closest('.form__row').classList.remove('form__row--hidden');
    }
  }

  _toggleElevationField() {
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
  }
  // CLICK ON LIST MOVE MAP TO THE CORRESPONDING POP-UP
  _moveToPopupOnList(e) {
    const workoutEl = e.target.closest('.workout');

    if (!workoutEl) return;

    const workout = this._workouts.find(
      (work) => work.id === workoutEl.dataset.id
    );

    this._map.setView(workout.coords, this._mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });
  }

  // CLICK POP-UP CONTENT ON MAP  MOVE MAP TO THE CORRESPONDING POP-UP
  _moveToPopupOnMap(e) {
    const popup = e.target.closest('.leaflet-popup');

    if (!popup) return;

    // leaflet-popup running-popup 3201455437 leaflet-zoom-animated
    const selectedWorkout = this._workouts.find(
      (work) =>
        `leaflet-popup ${work.type}-popup ${work.id} leaflet-zoom-animated` ===
        popup.className
    );

    this._map.setView(selectedWorkout.coords, this._mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });
  }

  // CONTROL MENU
  _controlMenu(e) {
    const menuItem = e.target.closest('.menu__item');

    if (menuItem === null) return; // Guard clause

    this._selectedWorkoutEl = e.target.closest('.workout');
    const { id } = this._selectedWorkoutEl.dataset;

    this._selectedWorkout = this._workouts.find((workout) => workout.id === id);

    // CLICK ON EDIT BUTTON, SHOW EDIT FORM & CLOSE MENU & TOGGLE EDIT CHECKER
    if (menuItem.classList.contains('menu__item--edit')) {
      this._showEditForm(this._selectedWorkout);
      this._defaultElevationField();
      this._editChecker = true;

      if (this._editChecker) {
        this._map.on('click', this._showBrandNewForm.bind(this));
      }
    }
    // CLICK ON DELETE BUTTON, DELETE THE WORKOUT
    if (menuItem.classList.contains('menu__item--delete'))
      this._deleteWorkout(e);

    // CLICK ON CLEAR BUTTON, CLEAR ALL
    if (menuItem.classList.contains('menu__item--clear'))
      model.clearLocalStorage();

    // CLICK ON SORT BUTTON, SORT LISTS BY DISTANCE
    if (menuItem.classList.contains('menu__item--sort')) {
      this._sortWorkout(this._selectedWorkout);
    }

    this._closeMenu();
  }

  _sortWorkout(workout) {
    workout.sortToggle ? this._sortByDate() : this._sortByDistance();

    model.setLocalStorage(this._workouts);
    location.reload();
  }

  _sortByDistance() {
    this._workouts.sort((a, b) => a.distance - b.distance);

    this._workouts.forEach((workout) => (workout.sortToggle = true));
  }

  _sortByDate() {
    this._workouts.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    this._workouts.forEach((workout) => (workout.sortToggle = false));
  }

  // DELETE LIST FROM LOCAL STORAGE, WORKOUT ARRAY AND RELOAD PAGE
  _deleteWorkout(e) {
    const workoutEl = e.target.closest('.workout');
    const { id } = workoutEl.dataset;
    const type = this._workouts.find((work) => work.id === id).type;
    const popup = [...document.querySelectorAll('.leaflet-popup')];
    const marker = [...document.querySelectorAll('.leaflet-marker-icon')];

    const selectedPopup = popup.find(
      (pop) =>
        pop.className ===
        `leaflet-popup ${type}-popup ${id} leaflet-zoom-animated`
    );
    const selectedMarker = marker.find(
      (mark) =>
        mark.className ===
        `leaflet-marker-icon ${id} leaflet-zoom-animated leaflet-interactive`
    );

    // DELETE POPUP, MARKER AND WORKOUT FROM LIST (TRICK)
    selectedPopup.style.display = 'none';
    selectedMarker.style.display = 'none';
    workoutEl.style.display = 'none';
    // DELETE SLECTED WORKOUT FROM THE WORKOUTS ARR
    this._workouts = this._workouts.filter((work) => work.id !== id);
    model.setLocalStorage(this._workouts);
  }
}

const app = new App();
