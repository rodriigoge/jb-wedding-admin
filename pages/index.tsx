import Head from "next/head";
import { AdminDashboard } from "@/components/AdminDashboard";

export default function HomePage() {
  return (
    <>
      <Head>
        <title>Lista de Presença | Admin J&B</title>
        <meta name="description" content="Painel privado de controle das confirmações de presença do casamento J&B." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <AdminDashboard />
    </>
  );
}
