import { useState } from "react";
import EntityManager from "@/components/EntityManager";
import CompagniaDetailDialog from "@/components/CompagniaDetailDialog";

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
  const [detailId, setDetailId] = useState(null);
  return (
    <>
      <EntityManager config={config} onView={(it) => setDetailId(it.id)} />
      <CompagniaDetailDialog id={detailId} open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)} />
    </>
  );
}
