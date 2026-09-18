import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, NewRequestButton, TopBar } from "@/components/art-de-vie/app-shell";
import { Filters, RequestCard } from "@/components/art-de-vie/cards";
import { requests } from "@/data/art-de-vie";
const filters=["Toutes","Nouvelle","En cours","Confirmée","Terminée","Annulée"];
export const Route=createFileRoute("/demandes")({head:()=>({meta:[{title:"Mes demandes — Art de Vie"},{name:"description",content:"Suivez toutes vos demandes de conciergerie."},{property:"og:title",content:"Mes demandes — Art de Vie"},{property:"og:description",content:"Suivez toutes vos demandes de conciergerie."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary_large_image"}]}),component:Page});
function Page(){const [active,setActive]=useState("Toutes");const list=active==="Toutes"?requests:requests.filter(r=>r.status===active);return <AppShell><TopBar title="Mes demandes" action={<NewRequestButton/>}/><Filters values={filters} active={active} onChange={setActive}/><div className="mt-6 grid gap-4 md:grid-cols-2">{list.map(r=><RequestCard key={r.id} item={r}/>)}</div></AppShell>}
