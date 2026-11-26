import { normalizeEditable } from './editable-avatar.js';

export const LOOKS = [
  ['sastre', 'Sastre', {
    shape: 0.84, height: 1.05, jaw: 0.28, hair: 'short04', hairTint: '#422c24',
    top: 'shirt', topColor: '#e0d5bb', bottomColor: '#343e4a', shoeColor: '#312822',
  }],
  ['urbano', 'Urbano', {
    shape: 0.58, muscle: 0.28, nose: 0.24, skin: '#ac806c', hair: 'afro01', hairTint: '#342522',
    top: 'hoodie', topColor: '#71897d', bottomColor: '#343d49', shoes: 'boots', shoeColor: '#514236',
  }],
  ['atelier', 'Atelier', {
    shape: -0.9, height: 0.98, jaw: -0.33, lips: 0.30, skin: '#f9d3bb', hair: 'bob01', hairTint: '#603c2b',
    eyeColor: '#59726a', top: 'dress', topColor: '#9d6e70', shoeColor: '#4a3036',
  }],
  ['activo', 'Activo', {
    shape: -0.74, muscle: 0.58, nose: 0.16, skin: '#c49279', hair: 'ponytail01', hairTint: '#302421',
    top: 'tshirt', topColor: '#a5a7d0', bottom: 'shorts', bottomColor: '#435b60', shoeColor: '#aaa298',
  }],
  ['relajado', 'Relajado', {
    shape: 0.66, weight: 0.48, age: 0.39, skin: '#efc1aa', hair: 'short02', hairTint: '#887967',
    top: 'tshirt', topColor: '#c19b76', bottomColor: '#647b93', shoeColor: '#382c26',
  }],
  ['creativo', 'Creativo', {
    shape: -0.6, cheeks: 0.36, eyes: 0.2, age: 0.2, skin: '#dbad92',
    hair: 'braid01', hairTint: '#764939', eyeColor: '#647c59',
    top: 'shirt', topColor: '#a5a5bd', bottom: 'skirt', bottomColor: '#484860', shoes: 'boots', shoeColor: '#453942',
  }],
].map(([id, label, avatar]) => ({ id, label, avatar: normalizeEditable(avatar) }));

export const PALETTES = {
  skin: [
    ['#ffffff', 'Porcelana'], ['#ffe1cf', 'Claro'], ['#efc1aa', 'Arena'],
    ['#dbad92', 'Beige'], ['#c49279', 'Cálido'], ['#a57d66', 'Canela'],
    ['#8a6251', 'Castaño'], ['#694b40', 'Profundo'],
  ],
  eyeColor: [
    ['#58392e', 'Café oscuro'], ['#80583c', 'Miel'], ['#978253', 'Avellana'],
    ['#627757', 'Verde'], ['#5e8597', 'Azul'], ['#9daba9', 'Gris'],
  ],
  hairTint: [
    ['#2b2220', 'Negro'], ['#513925', 'Castaño'], ['#775436', 'Café claro'],
    ['#a56a43', 'Cobrizo'], ['#d6bb87', 'Rubio'], ['#a8a2a1', 'Plata'], ['#724a63', 'Ciruela'],
  ],
  fabric: [
    ['#e0d5bb', 'Marfil'], ['#bbaa8e', 'Arena'], ['#a26456', 'Ladrillo'],
    ['#71897d', 'Salvia'], ['#7e9eb6', 'Azul'], ['#796781', 'Ciruela'], ['#454448', 'Grafito'],
  ],
};
