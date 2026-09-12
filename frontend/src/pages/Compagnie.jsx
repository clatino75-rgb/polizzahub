import EntityManager from "@/components/EntityManager";

const config = {
  endpoint: "/registry/compagnie",
  title: "Compagnie",
  subtitle: "Compagnie di emissione collegabili alle polizze.",
  testid: "compagnie",
  addLabel: "Nuova Compagnia",
  columns: [
    { key: "nome", label: "Compagnia" },
    { key: "telefono", label: "Telefono" },
    { key: "email", label: "Email" },
    { key: "indirizzo", label: "Indirizzo" },
  ],
  fields: [
    { key: "nome", label: "Nome compagnia" },
    { key: "indirizzo", label: "Indirizzo" },
    { key: "email", label: "Email", type: "email" },
    { key: "telefono", label: "Telefono" },
    { key: "note", label: "Note", type: "textarea", full: true },
  ],
};

export default function Compagnie() {
  return <EntityManager config={config} />;
}
