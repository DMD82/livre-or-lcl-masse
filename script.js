// === À CONFIGURER ===
// Remplacez cette URL par celle de votre déploiement Google Apps Script
// (Déployer > Nouveau déploiement > Application Web > URL se terminant par /exec)
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyBSrO2Qp_0Nhgd40w2Th2PWI4HkFdwzDg81n8B9LgW65P5GSdMuOr06VyyvJw5MsQ/exec';

const MAX_PHOTOS = 3;
const MAX_PHOTO_SIZE_MB = 5;

const form = document.getElementById('goldenBookForm');
const submitBtn = document.getElementById('submitBtn');
const statusEl = document.getElementById('formStatus');
const photoInput = document.getElementById('photos');
const photoHint = document.getElementById('photoHint');

// Horodatage de chargement de la page : sert de piège anti-robot temporel
// (un envoi trop rapide après le chargement est très probablement automatisé)
const pageLoadedAt = Date.now();
const MIN_FILL_TIME_MS = 4000;

photoInput.addEventListener('change', () => {
  const files = Array.from(photoInput.files || []);
  if (files.length > MAX_PHOTOS) {
    photoHint.textContent = `Merci de sélectionner au maximum ${MAX_PHOTOS} photos.`;
    photoInput.value = '';
    return;
  }
  const tooLarge = files.find(f => f.size > MAX_PHOTO_SIZE_MB * 1024 * 1024);
  if (tooLarge) {
    photoHint.textContent = `« ${tooLarge.name} » dépasse ${MAX_PHOTO_SIZE_MB} Mo. Merci de choisir une photo plus légère.`;
    photoInput.value = '';
    return;
  }
  photoHint.textContent = files.length
    ? `${files.length} photo(s) sélectionnée(s).`
    : '';
});

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]); // strip data: prefix
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function setStatus(message, kind) {
  statusEl.textContent = message;
  statusEl.className = 'form-status' + (kind ? ' ' + kind : '');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  setStatus('', '');

  // Piège à robots : le champ honeypot doit rester vide
  const honeypot = form.querySelector('#site').value;
  if (honeypot) {
    // On ne prévient pas le robot : on affiche un faux succès et on n'envoie rien.
    setStatus('Merci, votre message a bien été transmis.', 'success');
    form.reset();
    return;
  }

  // Piège temporel : un envoi trop rapide est suspect
  if (Date.now() - pageLoadedAt < MIN_FILL_TIME_MS) {
    setStatus('Merci de prendre un instant avant d\'envoyer votre message.', 'error');
    return;
  }

  const prenom = form.prenom.value.trim();
  const nom = form.nom.value.trim();
  const email = form.email.value.trim();
  const message = form.message.value.trim();
  const autorisation = form.autorisation.checked;

  if (!prenom || !nom || !message || !autorisation) {
    setStatus('Merci de compléter tous les champs obligatoires et de cocher la case d\'autorisation.', 'error');
    return;
  }

  submitBtn.disabled = true;
  setStatus('Envoi en cours…', '');

  try {
    const files = Array.from(photoInput.files || []);
    const photos = await Promise.all(files.map(async (f) => ({
      filename: f.name,
      mimeType: f.type,
      data: await fileToBase64(f),
    })));

    const payload = {
      prenom, nom, email, message,
      autorisation: true,
      photos,
      submittedAt: new Date().toISOString(),
    };

    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // évite le préflight CORS
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => null);

    if (result && result.status === 'ok') {
      setStatus('Merci ! Votre message a bien été transmis et rejoindra le livre d\'or du LCL Masse.', 'success');
      form.reset();
      photoHint.textContent = '';
    } else {
      throw new Error(result && result.message ? result.message : 'Réponse inattendue du serveur.');
    }
  } catch (err) {
    console.error(err);
    setStatus('Une erreur est survenue lors de l\'envoi. Merci de réessayer dans un instant, ou de nous contacter directement.', 'error');
  } finally {
    submitBtn.disabled = false;
  }
});
