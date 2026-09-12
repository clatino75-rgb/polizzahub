import { useState } from "react";
import EntityManager from "@/components/EntityManager";
import CollaboratoreDetailDialog from "@/components/CollaboratoreDetailDialog";

const config = {
  endpoint: "/registry/collaboratori",
  title: "Collaboratori",
  subtitle: "Collaboratori dell'agenzia, collegabili alle polizze.",
  testid: "collaboratori",
  addLabel: "Nuovo Collaboratore",
  columns: [
    { key: "nome", label: "Nome" },
    { key: "ruolo", label: "Ruolo" },
    { key: "telefono", label: "Telefono" },
    { key: "email", label: "Email" },
  ],
  fields: [
    { key: "nome", label: "Nome e cognome" },
    { key: "ruolo", label: "Ruolo" },
    { key: "email", label: "Email", type: "email" },
    { key: "telefono", label: "Telefono" },
    { key: "note", label: "Note", type: "textarea", full: true },
  ],
};

export default function Collaboratori() {
  const [detailId, setDetailId] = useState(null);
  return (
    <>
      <EntityManager config={config} onView={(it) => setDetailId(it.id)} />
      <CollaboratoreDetailDialog id={detailId} open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)} />
    </>
  );
}
