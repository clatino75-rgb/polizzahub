// Central config: all policy fields with labels, grouped into sections.
export const FIELD_SECTIONS = [
  {
    title: "Dati Polizza",
    icon: "FileText",
    fields: [
      { key: "numero_polizza", label: "Numero Polizza", type: "text" },
      { key: "compagnia_emissione", label: "Compagnia di Emissione", type: "text" },
      { key: "agenzia_emissione", label: "Agenzia di Emissione", type: "text" },
      { key: "tipo_polizza", label: "Tipo di Polizza", type: "text" },
      { key: "ramo_polizza", label: "Ramo di Polizza", type: "text" },
    ],
  },
  {
    title: "Anagrafica Contraente",
    icon: "User",
    fields: [
      { key: "contraente_nome", label: "Contraente", type: "text" },
      { key: "contraente_cf_piva", label: "Codice Fiscale / P.IVA", type: "text" },
      { key: "contraente_indirizzo", label: "Indirizzo", type: "text" },
    ],
  },
  {
    title: "Anagrafica Proprietario",
    icon: "Users",
    fields: [
      { key: "proprietario_nome", label: "Proprietario", type: "text" },
      { key: "proprietario_cf_piva", label: "Codice Fiscale / P.IVA", type: "text" },
      { key: "proprietario_indirizzo", label: "Indirizzo", type: "text" },
    ],
  },
  {
    title: "Date & Frazionamento",
    icon: "CalendarClock",
    fields: [
      { key: "data_effetto", label: "Data di Effetto", type: "date" },
      { key: "data_scadenza", label: "Data di Scadenza", type: "date" },
      { key: "frazionamento", label: "Frazionamento", type: "select",
        options: ["", "Annuale", "Semestrale", "Trimestrale", "Mensile"] },
    ],
  },
  {
    title: "Dettaglio Premi",
    icon: "Euro",
    fields: [
      { key: "premio_netto_annuale", label: "Premio Netto Annuale", type: "text" },
      { key: "premio_lordo_annuale", label: "Premio Lordo Annuale", type: "text" },
      { key: "premio_netto_semestrale", label: "Premio Netto Semestrale", type: "text", semestrale: true },
      { key: "premio_lordo_semestrale", label: "Premio Lordo Semestrale", type: "text", semestrale: true },
    ],
  },
  {
    title: "Specifiche RCA / Veicolo",
    icon: "Car",
    fields: [
      { key: "targa", label: "Targa", type: "text" },
      { key: "data_immatricolazione", label: "Data Immatricolazione", type: "date" },
      { key: "data_voltura", label: "Data Voltura", type: "date" },
      { key: "scatola_nera", label: "Scatola Nera / Box", type: "select", options: ["", "Sì", "No"] },
    ],
  },
  {
    title: "Note",
    icon: "StickyNote",
    fields: [{ key: "note", label: "Note", type: "textarea", full: true }],
  },
];

export const ALL_FIELDS = FIELD_SECTIONS.flatMap((s) => s.fields);

export const FIELD_LABEL = Object.fromEntries(ALL_FIELDS.map((f) => [f.key, f.label]));

export function emptyPolicy() {
  const o = {};
  ALL_FIELDS.forEach((f) => (o[f.key] = ""));
  o.anagrafica_id = "";
  o.compagnia_id = "";
  o.collaboratore_id = "";
  o.proprietario_anagrafica_id = "";
  o.garanzie = [];
  return o;
}
