import type { City, GeoPoint, Place } from "@/types/common";
import { float } from "./seed";

/**
 * Real pickup/drop-off points (approximate coordinates) so rides land on the
 * map where they should. `airport` marks the surcharge zone.
 */
type Spot = { name: string; address: string; lat: number; lng: number; airport?: boolean };

const LISBOA: Spot[] = [
  { name: "Aeroporto Humberto Delgado", address: "Alameda das Comunidades Portuguesas, 1700-111 Lisboa", lat: 38.7742, lng: -9.1342, airport: true },
  { name: "Praça do Comércio", address: "Praça do Comércio, 1100-148 Lisboa", lat: 38.7075, lng: -9.1364 },
  { name: "Rossio", address: "Praça Dom Pedro IV, 1100-200 Lisboa", lat: 38.7139, lng: -9.1394 },
  { name: "Marquês de Pombal", address: "Praça Marquês de Pombal, 1250-160 Lisboa", lat: 38.7253, lng: -9.15 },
  { name: "Saldanha", address: "Praça Duque de Saldanha, 1050-094 Lisboa", lat: 38.7347, lng: -9.145 },
  { name: "Gare do Oriente", address: "Av. Dom João II, 1990-233 Lisboa", lat: 38.7678, lng: -9.099 },
  { name: "Centro Colombo", address: "Av. Lusíada 1500, 1500-392 Lisboa", lat: 38.7553, lng: -9.1883 },
  { name: "Mosteiro dos Jerónimos", address: "Praça do Império, 1400-206 Lisboa", lat: 38.6979, lng: -9.2068 },
  { name: "Cais do Sodré", address: "Praça Duque da Terceira, 1200-161 Lisboa", lat: 38.706, lng: -9.1446 },
  { name: "Sé de Lisboa", address: "Largo da Sé, 1100-585 Lisboa", lat: 38.7097, lng: -9.1325 },
  { name: "Bairro Alto", address: "Rua da Atalaia 120, 1200-041 Lisboa", lat: 38.7124, lng: -9.145 },
  { name: "Chiado", address: "Largo do Chiado, 1200-108 Lisboa", lat: 38.7108, lng: -9.1418 },
  { name: "Avenida da Liberdade", address: "Av. da Liberdade 180, 1250-146 Lisboa", lat: 38.7197, lng: -9.1453 },
  { name: "Campo Pequeno", address: "Campo Pequeno, 1000-082 Lisboa", lat: 38.7425, lng: -9.1456 },
  { name: "Alvalade", address: "Av. da Igreja 40, 1700-239 Lisboa", lat: 38.753, lng: -9.144 },
  { name: "Entrecampos", address: "Av. da República 101, 1050-190 Lisboa", lat: 38.748, lng: -9.1485 },
  { name: "Estádio José Alvalade", address: "Rua Prof. Fernando da Fonseca, 1600-616 Lisboa", lat: 38.7612, lng: -9.1609 },
  { name: "Estádio da Luz", address: "Av. Eusébio da Silva Ferreira, 1500-313 Lisboa", lat: 38.7527, lng: -9.1847 },
  { name: "Amoreiras", address: "Av. Eng. Duarte Pacheco, 1070-103 Lisboa", lat: 38.724, lng: -9.162 },
  { name: "Campo de Ourique", address: "Rua Ferreira Borges 70, 1350-130 Lisboa", lat: 38.7175, lng: -9.165 },
  { name: "Santa Apolónia", address: "Av. Infante Dom Henrique, 1100-105 Lisboa", lat: 38.714, lng: -9.1225 },
  { name: "Oceanário", address: "Esplanada Dom Carlos I, 1990-005 Lisboa", lat: 38.7633, lng: -9.0937 },
  { name: "LX Factory", address: "Rua Rodrigues de Faria 103, 1300-501 Lisboa", lat: 38.7034, lng: -9.1784 },
  { name: "Hospital de Santa Maria", address: "Av. Prof. Egas Moniz, 1649-035 Lisboa", lat: 38.749, lng: -9.161 },
  { name: "Cidade Universitária", address: "Alameda da Universidade, 1649-004 Lisboa", lat: 38.752, lng: -9.158 },
  { name: "Areeiro", address: "Praça Francisco Sá Carneiro, 1000-159 Lisboa", lat: 38.7425, lng: -9.1335 },
  { name: "Arroios", address: "Rua Morais Soares 30, 1900-341 Lisboa", lat: 38.733, lng: -9.135 },
  { name: "Martim Moniz", address: "Praça Martim Moniz, 1100-341 Lisboa", lat: 38.716, lng: -9.136 },
  { name: "Benfica", address: "Estrada de Benfica 500, 1500-104 Lisboa", lat: 38.748, lng: -9.2 },
  { name: "Lumiar", address: "Alameda das Linhas de Torres 150, 1750-142 Lisboa", lat: 38.772, lng: -9.159 },
  { name: "Telheiras", address: "Rua Prof. Francisco Gentil 10, 1600-625 Lisboa", lat: 38.76, lng: -9.166 },
  { name: "Restelo", address: "Av. Ilha da Madeira 12, 1400-203 Lisboa", lat: 38.703, lng: -9.215 },
  { name: "Algés", address: "Rua Damião de Góis 8, 1495-055 Algés", lat: 38.702, lng: -9.229 },
  { name: "Oeiras", address: "Av. Salvador Allende 20, 2780-163 Oeiras", lat: 38.6913, lng: -9.3109 },
  { name: "Cascais", address: "Av. Valbom 6, 2750-508 Cascais", lat: 38.7008, lng: -9.4206 },
  { name: "Cristo Rei", address: "Santuário de Cristo Rei, 2800-058 Almada", lat: 38.6787, lng: -9.1713 },
  { name: "Amadora", address: "Av. Conde Castro Guimarães 15, 2700-213 Amadora", lat: 38.7579, lng: -9.2245 },
  { name: "Odivelas", address: "Rua Guilherme Gomes Fernandes 5, 2675-372 Odivelas", lat: 38.793, lng: -9.183 },
];

const PORTO: Spot[] = [
  { name: "Aeroporto Francisco Sá Carneiro", address: "4470-558 Maia", lat: 41.2481, lng: -8.6814, airport: true },
  { name: "Avenida dos Aliados", address: "Av. dos Aliados, 4000-064 Porto", lat: 41.1486, lng: -8.611 },
  { name: "Estação de São Bento", address: "Praça Almeida Garrett, 4000-069 Porto", lat: 41.1456, lng: -8.6106 },
  { name: "Ribeira", address: "Cais da Ribeira, 4050-510 Porto", lat: 41.1407, lng: -8.6131 },
  { name: "Casa da Música", address: "Av. da Boavista 604, 4149-071 Porto", lat: 41.1589, lng: -8.6307 },
  { name: "Estádio do Dragão", address: "Via Futebol Clube do Porto, 4350-415 Porto", lat: 41.1618, lng: -8.5836 },
  { name: "Campanhã", address: "Largo da Estação, 4300-173 Porto", lat: 41.1486, lng: -8.5856 },
  { name: "Foz do Douro", address: "Av. do Brasil 100, 4150-153 Porto", lat: 41.15, lng: -8.676 },
  { name: "Matosinhos", address: "Av. da República 600, 4450-242 Matosinhos", lat: 41.1844, lng: -8.6963 },
  { name: "Boavista", address: "Rotunda da Boavista, 4050-115 Porto", lat: 41.158, lng: -8.643 },
  { name: "Hospital de São João", address: "Alameda Prof. Hernâni Monteiro, 4200-319 Porto", lat: 41.181, lng: -8.601 },
  { name: "Cais de Gaia", address: "Av. Diogo Leite, 4400-111 Vila Nova de Gaia", lat: 41.137, lng: -8.613 },
  { name: "Mercado do Bolhão", address: "Rua Formosa, 4000-214 Porto", lat: 41.1497, lng: -8.6058 },
  { name: "Trindade", address: "Rua da Trindade, 4000-541 Porto", lat: 41.1525, lng: -8.6093 },
  { name: "Serralves", address: "Rua Dom João de Castro 210, 4150-417 Porto", lat: 41.1597, lng: -8.6598 },
  { name: "NorteShopping", address: "Rua Sara Afonso 105, 4460-841 Senhora da Hora", lat: 41.181, lng: -8.653 },
  { name: "Asprela", address: "Rua Dr. Roberto Frias, 4200-465 Porto", lat: 41.178, lng: -8.597 },
];

const FARO: Spot[] = [
  { name: "Aeroporto de Faro", address: "8006-901 Faro", lat: 37.0144, lng: -7.9659, airport: true },
  { name: "Sé de Faro", address: "Largo da Sé, 8000-138 Faro", lat: 37.0128, lng: -7.9346 },
  { name: "Estação de Faro", address: "Largo da Estação, 8000-152 Faro", lat: 37.019, lng: -7.94 },
  { name: "Universidade do Algarve", address: "Campus de Gambelas, 8005-139 Faro", lat: 37.044, lng: -7.972 },
  { name: "Forum Algarve", address: "EN125 km 103, 8009-020 Faro", lat: 37.027, lng: -7.95 },
  { name: "Praia de Faro", address: "Av. Nascente, 8005-520 Faro", lat: 37.006, lng: -7.995 },
  { name: "Olhão", address: "Av. 5 de Outubro, 8700-304 Olhão", lat: 37.026, lng: -7.841 },
  { name: "Loulé", address: "Praça da República, 8100-270 Loulé", lat: 37.138, lng: -8.023 },
  { name: "Albufeira", address: "Largo Eng. Duarte Pacheco, 8200-146 Albufeira", lat: 37.089, lng: -8.25 },
  { name: "Marina de Vilamoura", address: "Marina de Vilamoura, 8125-409 Quarteira", lat: 37.075, lng: -8.119 },
];

export const SPOTS: Record<City, Spot[]> = { LISBOA, PORTO, FARO };

/** City centres for idle driver dots on the live map. */
export const CITY_CENTRE: Record<City, GeoPoint> = {
  LISBOA: { lat: 38.7223, lng: -9.1393 },
  PORTO: { lat: 41.1579, lng: -8.6291 },
  FARO: { lat: 37.0194, lng: -7.9322 },
};

/** Share of activity per city. */
export const CITY_WEIGHTS = [
  ["LISBOA", 65],
  ["PORTO", 25],
  ["FARO", 10],
] as const satisfies readonly (readonly [City, number])[];

/** A spot with a little jitter (±~150 m) so pins don't stack. */
export function placeAt(spot: Spot, city: City): Place & { airport: boolean } {
  return {
    address: spot.address,
    city,
    lat: round6(spot.lat + float(-0.0013, 0.0013)),
    lng: round6(spot.lng + float(-0.0016, 0.0016)),
    airport: Boolean(spot.airport),
  };
}

/** A point scattered around a city centre (idle drivers). */
export function nearCentre(city: City, spreadKm = 4): GeoPoint {
  const c = CITY_CENTRE[city];
  const d = spreadKm / 111;
  return { lat: round6(c.lat + float(-d, d)), lng: round6(c.lng + float(-d * 1.3, d * 1.3)) };
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

export { haversineKm, heading, lerpPoint } from "./geo";
