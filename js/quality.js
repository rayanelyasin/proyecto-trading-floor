// Calidad gráfica por dispositivo. «auto» elige según el equipo; el jugador puede forzar alta, media o baja.
// Cambiar la calidad recarga la página para reconstruir el motor con los nuevos valores.
export const QUALITY_LABELS = { auto: 'Auto', alta: 'Alta', media: 'Media', baja: 'Baja' };
const TIERS = {
  alta: { name: 'alta', pixelRatio: 2, shadowMap: 2048, shadowRadius: 4, antialias: true, physical: true, transmission: true, anisotropy: 8, bump: true, contactShadows: true, accents: true },
  media: { name: 'media', pixelRatio: 1.5, shadowMap: 1024, shadowRadius: 3, antialias: true, physical: true, transmission: false, anisotropy: 4, bump: true, contactShadows: true, accents: true },
  baja: { name: 'baja', pixelRatio: 1, shadowMap: 512, shadowRadius: 2, antialias: false, physical: false, transmission: false, anisotropy: 2, bump: false, contactShadows: false, accents: false },
};
export function qualityChoice() {
  try { const v = localStorage.getItem('pulso:quality'); if (v && QUALITY_LABELS[v]) return v; } catch { /* sin almacenamiento */ }
  return 'auto';
}
export function setQualityChoice(value) {
  try { localStorage.setItem('pulso:quality', value); } catch { /* ignorar */ }
}
function autoTier() {
  const coarse = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  const memory = navigator.deviceMemory ?? (coarse ? 4 : 8), cores = navigator.hardwareConcurrency ?? (coarse ? 4 : 8);
  if (coarse) return memory <= 3 || cores <= 4 ? 'baja' : 'media';
  return memory <= 4 || cores <= 4 ? 'media' : 'alta';
}
export function quality() {
  const choice = qualityChoice();
  return TIERS[choice === 'auto' ? autoTier() : choice];
}
