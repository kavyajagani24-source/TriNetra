import { readFileSync, writeFileSync } from 'fs';
let content = readFileSync('src/data/mock.ts', 'utf8');

const reps = [
  ['lat: 12.9598, lng: 77.6485', 'lat: 19.065, lng: 72.868'],
  ['lat: 12.943, lng: 77.628', 'lat: 19.040, lng: 72.847'],
  ['lat: 12.9749, lng: 77.6165', 'lat: 19.056, lng: 72.845'],
  ['lat: 12.928, lng: 77.617', 'lat: 19.032, lng: 72.852'],
  ['lat: 12.9705, lng: 77.6405', 'lat: 19.062, lng: 72.900'],
  ['lat: 12.9598, lng: 77.645', 'lat: 19.103, lng: 72.888'],
  ['lat: 12.925, lng: 77.645', 'lat: 19.025, lng: 72.875'],
  ['lat: 12.932, lng: 77.598', 'lat: 19.082, lng: 72.843'],
  ['lat: 12.9755, lng: 77.705', 'lat: 19.090, lng: 72.880'],
  ['road: "Outer Ring Road"', 'road: "Western Express Highway"'],
  ['ward: "PWD Ward 4"', 'ward: "BMC Ward 4"'],
  ['road: "Koramangala Inner Ring Road"', 'road: "Mahim Causeway"'],
  ['ward: "BBMP East"', 'ward: "BMC West"'],
  ['road: "MG Road"', 'road: "Linking Road, Bandra"'],
  ['ward: "PWD Ward 1"', 'ward: "BMC Ward 1"'],
  ['road: "Hosur Road"', 'road: "LBS Marg, Kurla"'],
  ['road: "100 Ft Road, Indiranagar"', 'road: "Eastern Express Highway, Chembur"'],
  ['road: "Old Airport Road"', 'road: "Jogeshwari-Vikhroli Link Road"'],
  ['ward: "PWD Ward 7"', 'ward: "BMC Ward 7"'],
  ['road: "Sarjapur Road"', 'road: "Sion-Panvel Expressway"'],
  ['ward: "PWD Ward 9"', 'ward: "BMC Ward 9"'],
  ['road: "Bannerghatta Road"', 'road: "SV Road, Andheri West"'],
  ['ward: "PWD Ward 12"', 'ward: "BMC Ward 12"'],
  ['road: "Whitefield Main Road"', 'road: "Andheri-Kurla Road"'],
];

for (const [from, to] of reps) {
  content = content.split(from).join(to);
}

writeFileSync('src/data/mock.ts', content, 'utf8');
console.log('Done — Mumbai coords applied to mock.ts');
