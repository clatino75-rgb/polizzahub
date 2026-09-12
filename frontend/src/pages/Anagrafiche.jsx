import EntityManager from "@/components/EntityManager";

const config = {
  endpoint: "/registry/anagrafiche",
  title: "Anagrafiche",
  subtitle: "Clienti, contraenti e proprietari. Le nuove polizze vengono collegate automaticamente.",
  testid: "anagrafiche",
  addLabel: "Nuova Anagrafica",
  columns: [
    { key: "nome", label: "Nome / Ragione sociale" },
    { key: "cf_piva", label: "CF / P.IVA" },
    { key: "tipo", label: "Tipo" },
    { key: "telefono", label: "Telefono" },
    { key: "email", label: "Email" },
  ],
  fields: [
    { key: "nome", label: "Nome / Ragione sociale" },
    { key: "cf_piva", label: "Codice Fiscale / P.IVA" },
    { key: "tipo", label: "Tipo", type: "select", options: ["", "Contraente", "Proprietario", "Cliente"] },
    { key: "indirizzo", label: "Indirizzo" },
    { key: "email", label: "Email", type: "email" },
    { key: "telefono", label: "Telefono" },
    { key: "note", label: "Note", type: "textarea", full: true },
  ],
};

export default function Anagrafiche() {
  return <EntityManager config={config} />;
}
